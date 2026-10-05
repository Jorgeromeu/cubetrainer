// Repository for F2L progress. The only module that touches F2L's tables.
import type { DatabaseSync } from "node:sqlite";
import type { Catalog } from "../../../../shared/f2l/catalog.ts";
import { InvalidRequest } from "../../http.ts";
import {
  ALG_STATUSES,
  MAX_NOTE_LENGTH,
  NOTE_SYMMETRIES,
  type AlgRef,
  type AlgState,
  type AlgStatus,
  type Note,
  type NoteSymmetry,
  type PatchAlgBody,
  type PutNoteBody,
  type PutProgressBody,
  type SlotCaseProgress,
} from "../../../../shared/f2l/progress.ts";

interface ProgressRow {
  slot_case_id: string;
  main_alg_kind: AlgRef["kind"];
  main_alg_id: string;
  updated_at: string;
}

interface AlgStateRow {
  alg_kind: AlgRef["kind"];
  alg_id: string;
  slot_case_id: string;
  status: AlgStatus;
  updated_at: string;
}

interface NoteRow {
  id: string;
  alg_kind: AlgRef["kind"];
  alg_id: string;
  slot_case_id: string;
  symmetry: NoteSymmetry;
  text: string;
  created_at: string;
  updated_at: string;
}

const toProgress = (row: ProgressRow): SlotCaseProgress => ({
  slotCaseId: row.slot_case_id,
  mainAlg: { kind: row.main_alg_kind, id: row.main_alg_id },
  updatedAt: row.updated_at,
});

const toAlgState = (row: AlgStateRow): AlgState => ({
  alg: { kind: row.alg_kind, id: row.alg_id },
  slotCaseId: row.slot_case_id,
  status: row.status,
  updatedAt: row.updated_at,
});

const toNote = (row: NoteRow): Note => ({
  id: row.id,
  alg: { kind: row.alg_kind, id: row.alg_id },
  slotCaseId: row.slot_case_id,
  symmetry: row.symmetry,
  text: row.text,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function progressRepository(db: DatabaseSync, catalog: Catalog) {
  const slotCaseIds = new Set(catalog.slotCases.map((sc) => sc.id));
  const catalogAlgSlotCase = new Map(catalog.algs.map((a) => [a.id, a.slotCaseId]));

  const selectAll = db.prepare("SELECT * FROM slot_case_progress ORDER BY slot_case_id");
  const selectOne = db.prepare("SELECT * FROM slot_case_progress WHERE slot_case_id = ?");
  const userAlgSlotCase = db.prepare("SELECT slot_case_id FROM user_algs WHERE id = ?");
  const upsert = db.prepare(`
    INSERT INTO slot_case_progress (slot_case_id, main_alg_kind, main_alg_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (slot_case_id) DO UPDATE SET
      main_alg_kind = excluded.main_alg_kind,
      main_alg_id = excluded.main_alg_id,
      updated_at = excluded.updated_at`);
  const remove = db.prepare("DELETE FROM slot_case_progress WHERE slot_case_id = ?");

  const selectAllAlgStates = db.prepare("SELECT * FROM alg_state ORDER BY slot_case_id, updated_at");
  const selectAlgState = db.prepare("SELECT * FROM alg_state WHERE alg_kind = ? AND alg_id = ?");
  const upsertAlgState = db.prepare(`
    INSERT INTO alg_state (alg_kind, alg_id, slot_case_id, status, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (alg_kind, alg_id) DO UPDATE SET
      status = excluded.status,
      updated_at = excluded.updated_at`);
  const removeAlgState = db.prepare("DELETE FROM alg_state WHERE alg_kind = ? AND alg_id = ?");

  const selectAllNotes = db.prepare("SELECT * FROM notes ORDER BY created_at");
  const selectNote = db.prepare("SELECT * FROM notes WHERE id = ?");
  const upsertNote = db.prepare(`
    INSERT INTO notes (id, alg_kind, alg_id, slot_case_id, symmetry, text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      symmetry = excluded.symmetry,
      text = excluded.text,
      updated_at = excluded.updated_at`);
  const removeNote = db.prepare("DELETE FROM notes WHERE id = ?");

  /** The slot-case an alg belongs to, or undefined if there's no such alg. */
  const slotCaseOf = (ref: AlgRef): string | undefined =>
    ref.kind === "catalog"
      ? catalogAlgSlotCase.get(ref.id)
      : (userAlgSlotCase.get(ref.id) as { slot_case_id: string } | undefined)?.slot_case_id;

  /** Throws unless the slot-case exists and `alg` (if given) belongs to it. */
  function checkAlg(slotCaseId: string, alg: AlgRef) {
    const algSlotCase = slotCaseOf(alg);
    if (!algSlotCase) throw new InvalidRequest(`Unknown ${alg.kind} alg ${alg.id}`);
    if (algSlotCase !== slotCaseId) throw new InvalidRequest(`Alg ${alg.id} belongs to ${algSlotCase}, not ${slotCaseId}`);
  }
  function checkSlotCase(slotCaseId: string) {
    if (!slotCaseIds.has(slotCaseId)) throw new InvalidRequest(`Unknown slot-case ${slotCaseId}`);
  }

  return {
    list: (): SlotCaseProgress[] => (selectAll.all() as unknown as ProgressRow[]).map(toProgress),
    listAlgStates: (): AlgState[] => (selectAllAlgStates.all() as unknown as AlgStateRow[]).map(toAlgState),
    listNotes: (): Note[] => (selectAllNotes.all() as unknown as NoteRow[]).map(toNote),

    /** Sets a slot-case's main alg; null clears it. */
    put(slotCaseId: string, body: unknown): SlotCaseProgress | null {
      checkSlotCase(slotCaseId);
      const { mainAlg } = parseProgressBody(body);
      if (!mainAlg) {
        remove.run(slotCaseId);
        return null;
      }
      checkAlg(slotCaseId, mainAlg);
      upsert.run(slotCaseId, mainAlg.kind, mainAlg.id, new Date().toISOString());
      return toProgress(selectOne.get(slotCaseId) as unknown as ProgressRow);
    },

    /** Sets an alg's status; null clears it. */
    patchAlg(alg: AlgRef, body: unknown): AlgState | null {
      const slotCaseId = slotCaseOf(alg);
      if (!slotCaseId) throw new InvalidRequest(`Unknown ${alg.kind} alg ${alg.id}`);
      const { status } = parsePatchAlgBody(body);
      if (!status) {
        removeAlgState.run(alg.kind, alg.id);
        return null;
      }
      upsertAlgState.run(alg.kind, alg.id, slotCaseId, status, new Date().toISOString());
      return toAlgState(selectAlgState.get(alg.kind, alg.id) as unknown as AlgStateRow);
    },

    /** Creates or updates a note; empty text deletes it. A note can't move to another alg. */
    putNote(id: string, body: unknown): Note | null {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        throw new InvalidRequest("Note id must be a uuid");
      const { alg, symmetry, text } = parseNoteBody(body);
      const slotCaseId = slotCaseOf(alg);
      if (!slotCaseId) throw new InvalidRequest(`Unknown ${alg.kind} alg ${alg.id}`);
      const existing = selectNote.get(id) as unknown as NoteRow | undefined;
      if (existing && (existing.alg_kind !== alg.kind || existing.alg_id !== alg.id))
        throw new InvalidRequest(`Note ${id} belongs to alg ${existing.alg_id}`);
      if (!text.trim()) {
        removeNote.run(id);
        return null;
      }
      const now = new Date().toISOString();
      upsertNote.run(id, alg.kind, alg.id, slotCaseId, symmetry, text, existing?.created_at ?? now, now);
      return toNote(selectNote.get(id) as unknown as NoteRow);
    },
  };
}

function parseAlgRef(value: unknown, field: string): AlgRef {
  const ref = (value ?? {}) as Record<string, unknown>;
  if ((ref.kind !== "catalog" && ref.kind !== "user") || typeof ref.id !== "string")
    throw new InvalidRequest(`${field} must be { kind: "catalog" | "user", id: string }`);
  return { kind: ref.kind, id: ref.id };
}

function parseProgressBody(body: unknown): PutProgressBody {
  const { mainAlg } = (body ?? {}) as Record<string, unknown>;
  return { mainAlg: mainAlg === null ? null : parseAlgRef(mainAlg, "mainAlg (or null)") };
}

/** Validates a route's alg kind + id into an AlgRef. */
export function algRefFrom(kind: string, id: string): AlgRef {
  if (kind !== "catalog" && kind !== "user") throw new InvalidRequest(`Unknown alg kind ${kind}`);
  return { kind, id };
}

function parsePatchAlgBody(body: unknown): PatchAlgBody {
  const { status, ...rest } = (body ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
  if (status !== null && !ALG_STATUSES.includes(status as AlgStatus))
    throw new InvalidRequest(`status must be null or one of ${ALG_STATUSES.join(", ")}`);
  return { status: status as AlgStatus | null };
}

function parseNoteBody(body: unknown): PutNoteBody {
  const { alg, symmetry, text } = (body ?? {}) as Record<string, unknown>;
  if (!NOTE_SYMMETRIES.includes(symmetry as NoteSymmetry))
    throw new InvalidRequest(`symmetry must be one of ${NOTE_SYMMETRIES.join(", ")}`);
  if (typeof text !== "string") throw new InvalidRequest("text must be a string");
  if (text.length > MAX_NOTE_LENGTH) throw new InvalidRequest(`text is longer than ${MAX_NOTE_LENGTH} characters`);
  return { alg: parseAlgRef(alg, "alg"), symmetry: symmetry as NoteSymmetry, text };
}
