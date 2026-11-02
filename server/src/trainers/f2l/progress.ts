// Repository for F2L progress. The only module that touches F2L's tables.
import type { DatabaseSync } from "node:sqlite";
import { LINK_KINDS, type Catalog, type LinkKind } from "../../../../packages/core/catalog/f2l.ts";
import { InvalidRequest } from "../../http.ts";
import {
  ALG_STATUSES,
  MAX_NOTE_LENGTH,
  MAX_USER_ALG_LENGTH,
  MAX_VIDEO_URL_LENGTH,
  type AlgRef,
  type AlgState,
  type AlgStatus,
  type Note,
  type NoteFollows,
  type PatchAlgBody,
  type PutNoteBody,
  type PutProgressBody,
  type PutUserAlgBody,
  type PutVideoBody,
  type SlotCaseProgress,
  type UserAlg,
  type VideoLink,
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
  /** Comma-separated link kinds, '' for none. */
  follows: string;
  text: string;
  created_at: string;
  updated_at: string;
}

interface VideoRow {
  alg_kind: AlgRef["kind"];
  alg_id: string;
  slot_case_id: string;
  url: string;
  updated_at: string;
}

interface UserAlgRow {
  id: string;
  slot_case_id: string;
  moves: string;
  created_at: string;
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
  follows: row.follows ? (row.follows.split(",") as NoteFollows) : [],
  text: row.text,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toVideo = (row: VideoRow): VideoLink => ({
  alg: { kind: row.alg_kind, id: row.alg_id },
  slotCaseId: row.slot_case_id,
  url: row.url,
  updatedAt: row.updated_at,
});

const toUserAlg = (row: UserAlgRow): UserAlg => ({
  id: row.id,
  slotCaseId: row.slot_case_id,
  moves: row.moves,
  createdAt: row.created_at,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function progressRepository(db: DatabaseSync, catalog: Catalog) {
  const slotCaseIds = new Set(catalog.slotCases.map((sc) => sc.id));
  const catalogAlgSlotCase = new Map(catalog.algs.map((a) => [a.id, a.slotCaseId]));
  /** slot-case id -> its catalog algs' moves, to turn away a user alg the catalog already has. */
  const catalogMoves = new Map<string, Set<string>>();
  for (const a of catalog.algs) catalogMoves.set(a.slotCaseId, (catalogMoves.get(a.slotCaseId) ?? new Set()).add(a.moves));

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
    INSERT INTO notes (id, alg_kind, alg_id, slot_case_id, follows, text, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      follows = excluded.follows,
      text = excluded.text,
      updated_at = excluded.updated_at`);
  const removeNote = db.prepare("DELETE FROM notes WHERE id = ?");

  const selectAllVideos = db.prepare("SELECT * FROM video_links ORDER BY slot_case_id, updated_at");
  const selectVideo = db.prepare("SELECT * FROM video_links WHERE alg_kind = ? AND alg_id = ?");
  const upsertVideo = db.prepare(`
    INSERT INTO video_links (alg_kind, alg_id, slot_case_id, url, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (alg_kind, alg_id) DO UPDATE SET
      url = excluded.url,
      updated_at = excluded.updated_at`);
  const removeVideo = db.prepare("DELETE FROM video_links WHERE alg_kind = ? AND alg_id = ?");

  const selectAllUserAlgs = db.prepare("SELECT * FROM user_algs ORDER BY created_at");
  const selectUserAlg = db.prepare("SELECT * FROM user_algs WHERE id = ?");
  const selectUserAlgByMoves = db.prepare("SELECT id FROM user_algs WHERE slot_case_id = ? AND moves = ?");
  const insertUserAlg = db.prepare("INSERT INTO user_algs (id, slot_case_id, moves, created_at) VALUES (?, ?, ?, ?)");
  const fillUserAlg = db.prepare("UPDATE user_algs SET moves = ? WHERE id = ? AND moves = ''");
  // Deleting a user alg takes what hangs off it along (see deleteUserAlg).
  const removeUserAlgRows = [
    "DELETE FROM user_algs WHERE id = ?",
    "DELETE FROM slot_case_progress WHERE main_alg_kind = 'user' AND main_alg_id = ?",
    "DELETE FROM alg_state WHERE alg_kind = 'user' AND alg_id = ?",
    "DELETE FROM notes WHERE alg_kind = 'user' AND alg_id = ?",
    "DELETE FROM video_links WHERE alg_kind = 'user' AND alg_id = ?",
  ].map((sql) => db.prepare(sql));

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
  /** Throws if the slot-case already has these moves (in the catalog or among yours). */
  function checkNewMoves(slotCaseId: string, moves: string) {
    if (catalogMoves.get(slotCaseId)?.has(moves)) throw new InvalidRequest(`${moves} is already in the catalog for ${slotCaseId}`);
    if (selectUserAlgByMoves.get(slotCaseId, moves)) throw new InvalidRequest(`You already added ${moves} for ${slotCaseId}`);
  }
  function checkSlotCase(slotCaseId: string) {
    if (!slotCaseIds.has(slotCaseId)) throw new InvalidRequest(`Unknown slot-case ${slotCaseId}`);
  }

  return {
    list: (): SlotCaseProgress[] => (selectAll.all() as unknown as ProgressRow[]).map(toProgress),
    listAlgStates: (): AlgState[] => (selectAllAlgStates.all() as unknown as AlgStateRow[]).map(toAlgState),
    listNotes: (): Note[] => (selectAllNotes.all() as unknown as NoteRow[]).map(toNote),
    listVideos: (): VideoLink[] => (selectAllVideos.all() as unknown as VideoRow[]).map(toVideo),
    listUserAlgs: (): UserAlg[] => (selectAllUserAlgs.all() as unknown as UserAlgRow[]).map(toUserAlg),

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
      if (!UUID.test(id)) throw new InvalidRequest("Note id must be a uuid");
      const { alg, follows, text } = parseNoteBody(body);
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
      upsertNote.run(id, alg.kind, alg.id, slotCaseId, follows.join(","), text, existing?.created_at ?? now, now);
      return toNote(selectNote.get(id) as unknown as NoteRow);
    },

    /** Sets an alg's video link; null removes it. */
    putVideo(alg: AlgRef, body: unknown): VideoLink | null {
      const slotCaseId = slotCaseOf(alg);
      if (!slotCaseId) throw new InvalidRequest(`Unknown ${alg.kind} alg ${alg.id}`);
      const { url } = parseVideoBody(body);
      if (!url) {
        removeVideo.run(alg.kind, alg.id);
        return null;
      }
      upsertVideo.run(alg.kind, alg.id, slotCaseId, url, new Date().toISOString());
      return toVideo(selectVideo.get(alg.kind, alg.id) as unknown as VideoRow);
    },

    /**
     * Adds a user alg. Saving the same id with the same alg again returns it unchanged; a
     * different alg under an existing id, or moves the slot-case already has, is refused.
     */
    putUserAlg(id: string, body: unknown): UserAlg {
      if (!UUID.test(id)) throw new InvalidRequest("User alg id must be a uuid");
      const { slotCaseId, moves } = parseUserAlgBody(body);
      checkSlotCase(slotCaseId);
      const existing = selectUserAlg.get(id) as unknown as UserAlgRow | undefined;
      if (existing) {
        if (existing.slot_case_id !== slotCaseId || existing.moves !== moves)
          throw new InvalidRequest(`User alg ${id} already exists with other moves`);
        return toUserAlg(existing);
      }
      if (moves) checkNewMoves(slotCaseId, moves);
      insertUserAlg.run(id, slotCaseId, moves, new Date().toISOString());
      return toUserAlg(selectUserAlg.get(id) as unknown as UserAlgRow);
    },

    /** Fills in a placeholder's moves. Sending the moves it already has returns it unchanged. */
    patchUserAlg(id: string, body: unknown): UserAlg {
      const existing = selectUserAlg.get(id) as unknown as UserAlgRow | undefined;
      if (!existing) throw new InvalidRequest(`Unknown user alg ${id}`);
      const moves = parsePatchUserAlgBody(body);
      if (existing.moves === moves) return toUserAlg(existing);
      if (existing.moves) throw new InvalidRequest(`User alg ${id} already has moves`);
      checkNewMoves(existing.slot_case_id, moves);
      fillUserAlg.run(moves, id);
      return toUserAlg(selectUserAlg.get(id) as unknown as UserAlgRow);
    },

    /** Deletes a user alg along with its main-alg row, status, notes and video link. */
    deleteUserAlg(id: string): null {
      if (!selectUserAlg.get(id)) throw new InvalidRequest(`Unknown user alg ${id}`);
      db.exec("BEGIN");
      try {
        for (const statement of removeUserAlgRows) statement.run(id);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return null;
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
  const { alg, follows, text } = (body ?? {}) as Record<string, unknown>;
  if (
    !Array.isArray(follows) ||
    !follows.every((k) => LINK_KINDS.includes(k as LinkKind)) ||
    new Set(follows).size !== follows.length
  )
    throw new InvalidRequest(`follows must be a list of distinct link kinds (${LINK_KINDS.join(", ")})`);
  if (typeof text !== "string") throw new InvalidRequest("text must be a string");
  if (text.length > MAX_NOTE_LENGTH) throw new InvalidRequest(`text is longer than ${MAX_NOTE_LENGTH} characters`);
  // Kept in LINK_KINDS order, so equal sets are stored the same way.
  return { alg: parseAlgRef(alg, "alg"), follows: LINK_KINDS.filter((k) => follows.includes(k)), text };
}

function parseVideoBody(body: unknown): PutVideoBody {
  const { url, ...rest } = (body ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
  if (url === null) return { url: null };
  if (typeof url !== "string") throw new InvalidRequest("url must be a string or null");
  const trimmed = url.trim();
  if (trimmed.length > MAX_VIDEO_URL_LENGTH) throw new InvalidRequest(`url is longer than ${MAX_VIDEO_URL_LENGTH} characters`);
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidRequest("url must be a valid link");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new InvalidRequest("url must be an http(s) link");
  return { url: parsed.href };
}

/**
 * One move as the app writes them: a face, wide, slice or rotation move, then an
 * optional 2 and/or prime. The app checks on the cube that the alg solves its case; here
 * only the notation is checked.
 */
const MOVE = /^(?:[URFDLB]w?|[urfdlbMESxyz])2?'?$/;

/** Moves as sent: space-separated moves, tidied; empty if `allowEmpty` (a placeholder). */
function parseMoves(moves: unknown, allowEmpty: boolean): string {
  if (typeof moves !== "string") throw new InvalidRequest("moves must be a string");
  if (moves.length > MAX_USER_ALG_LENGTH) throw new InvalidRequest(`moves is longer than ${MAX_USER_ALG_LENGTH} characters`);
  const list = moves.trim().split(/\s+/).filter(Boolean);
  if (!list.length && !allowEmpty) throw new InvalidRequest("moves is empty");
  const bad = list.find((m) => !MOVE.test(m));
  if (bad) throw new InvalidRequest(`Not a move: ${bad}`);
  return list.join(" ");
}

function parseUserAlgBody(body: unknown): PutUserAlgBody {
  const { slotCaseId, moves, ...rest } = (body ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
  if (typeof slotCaseId !== "string") throw new InvalidRequest("slotCaseId must be a string");
  return { slotCaseId, moves: parseMoves(moves, true) };
}

function parsePatchUserAlgBody(body: unknown): string {
  const { moves, ...rest } = (body ?? {}) as Record<string, unknown>;
  const unknownKeys = Object.keys(rest);
  if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
  return parseMoves(moves, false);
}
