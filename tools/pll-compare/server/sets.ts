// Repository for PLL compare's named sets. The only module that touches its tables.
import type { DatabaseSync } from "node:sqlite";
import type { PllCatalog } from "../../../packages/core/catalog/pll.ts";
import {
  BLOCK_COLORS,
  isSticker,
  MAX_CAPTION,
  MAX_SET_CUBES,
  MAX_SET_NAME,
  type Block,
  type CompareCube,
  type CompareSet,
  type PutSetBody,
} from "../contract.ts";
import { InvalidRequest } from "../../../server/src/tool.ts";

interface SetRow {
  id: string;
  name: string;
  cubes: string;
  created_at: string;
  updated_at: string;
}

/** Sets saved before blocks have `marks`: plain marked stickers, now one block in the first colour. */
type StoredCube = CompareCube & { marks?: string[] };
const fromStored = ({ marks, ...cube }: StoredCube): CompareCube =>
  marks?.length && !cube.blocks ? { ...cube, blocks: [{ color: 0, caption: "", stickers: marks }] } : cube;

const toSet = (row: SetRow): CompareSet => ({
  id: row.id,
  name: row.name,
  cubes: (JSON.parse(row.cubes) as StoredCube[]).map(fromStored),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function setsRepository(db: DatabaseSync, catalog: PllCatalog) {
  const caseIds = new Set(catalog.cases.map((c) => c.id));

  const selectAll = db.prepare("SELECT * FROM sets ORDER BY name COLLATE NOCASE");
  const selectOne = db.prepare("SELECT * FROM sets WHERE id = ?");
  const selectByName = db.prepare("SELECT id FROM sets WHERE name = ?");
  const upsert = db.prepare(`
    INSERT INTO sets (id, name, cubes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, cubes = excluded.cubes, updated_at = excluded.updated_at`);
  const remove = db.prepare("DELETE FROM sets WHERE id = ?");

  function checkId(id: string) {
    if (!UUID.test(id)) throw new InvalidRequest("Set id must be a uuid");
  }

  function parseBody(body: unknown): PutSetBody {
    const { name, cubes, ...rest } = (body ?? {}) as Record<string, unknown>;
    const unknownKeys = Object.keys(rest);
    if (unknownKeys.length) throw new InvalidRequest(`Unknown field(s): ${unknownKeys.join(", ")}`);
    if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_SET_NAME)
      throw new InvalidRequest(`name must be 1 to ${MAX_SET_NAME} characters`);
    if (!Array.isArray(cubes) || !cubes.length || cubes.length > MAX_SET_CUBES)
      throw new InvalidRequest(`cubes must be a list of 1 to ${MAX_SET_CUBES} cubes`);
    return { name: name.trim(), cubes: cubes.map(parseCube) };
  }

  function parseCube(cube: unknown): CompareCube {
    const { caseId, variant, turn, blocks, ...rest } = (cube ?? {}) as Record<string, unknown>;
    if (Object.keys(rest).length) throw new InvalidRequest(`Unknown cube field(s): ${Object.keys(rest).join(", ")}`);
    if (typeof caseId !== "string" || !caseIds.has(caseId)) throw new InvalidRequest(`Unknown PLL case ${String(caseId)}`);
    const quarter = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 3;
    if (!quarter(variant) || !quarter(turn)) throw new InvalidRequest("variant and turn must be 0 to 3 quarter turns");
    const parsed = blocks === undefined ? [] : parseBlocks(blocks);
    return { caseId, variant: variant as number, turn: turn as number, ...(parsed.length ? { blocks: parsed } : {}) };
  }

  function parseBlocks(blocks: unknown): Block[] {
    if (!Array.isArray(blocks) || blocks.length > BLOCK_COLORS) throw new InvalidRequest(`blocks must be a list of up to ${BLOCK_COLORS}`);
    const colors = new Set<number>();
    const stickers = new Set<string>();
    return blocks
      .map((block: unknown): Block => {
        const { color, caption, stickers: own, ...rest } = (block ?? {}) as Record<string, unknown>;
        if (Object.keys(rest).length) throw new InvalidRequest(`Unknown block field(s): ${Object.keys(rest).join(", ")}`);
        if (typeof color !== "number" || !Number.isInteger(color) || color < 0 || color >= BLOCK_COLORS || colors.has(color))
          throw new InvalidRequest(`Each block needs its own color, 0 to ${BLOCK_COLORS - 1}`);
        colors.add(color);
        if (typeof caption !== "string" || caption.length > MAX_CAPTION)
          throw new InvalidRequest(`A caption is up to ${MAX_CAPTION} characters`);
        if (!Array.isArray(own) || !own.length)
          throw new InvalidRequest(`A block's stickers are a list of at least one ("e7", "c14", "m2")`);
        for (const sticker of own) {
          if (typeof sticker !== "string" || !isSticker(sticker) || stickers.has(sticker))
            throw new InvalidRequest(`A block's stickers are distinct, each in one block ("e7", "c14", "m2")`);
          stickers.add(sticker);
        }
        return { color, caption: caption.trim(), stickers: (own as string[]).toSorted() };
      })
      .toSorted((a, b) => a.color - b.color);
  }

  return {
    list: (): CompareSet[] => (selectAll.all() as unknown as SetRow[]).map(toSet),

    /** Creates or replaces a set. Its name can't be another set's. */
    put(id: string, body: unknown): CompareSet {
      checkId(id);
      const { name, cubes } = parseBody(body);
      const sameName = selectByName.get(name) as { id: string } | undefined;
      if (sameName && sameName.id !== id) throw new InvalidRequest(`There's already a set called "${name}"`);
      const now = new Date().toISOString();
      upsert.run(id, name, JSON.stringify(cubes), now, now);
      return toSet(selectOne.get(id) as unknown as SetRow);
    },

    remove(id: string): null {
      checkId(id);
      remove.run(id);
      return null;
    },
  };
}
