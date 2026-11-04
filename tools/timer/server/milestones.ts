// Repository for milestones on the timeline. The only module that touches that table.
import type { DatabaseSync } from "node:sqlite";
import { MAX_MILESTONE_LABEL, type Milestone, type PutMilestoneBody } from "../contract.ts";
import { bodyOf, InvalidRequest } from "../../../server/src/tool.ts";

interface MilestoneRow {
  id: string;
  label: string;
  start_day: string;
  end_day: string | null;
}

const toMilestone = (row: MilestoneRow): Milestone => ({
  id: row.id,
  label: row.label,
  startDay: row.start_day,
  endDay: row.end_day,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function milestonesRepository(db: DatabaseSync) {
  const selectAll = db.prepare("SELECT * FROM milestones ORDER BY start_day, end_day");
  const selectOne = db.prepare("SELECT * FROM milestones WHERE id = ?");
  const upsert = db.prepare(`
    INSERT INTO milestones (id, label, start_day, end_day, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET label = excluded.label, start_day = excluded.start_day, end_day = excluded.end_day`);
  const remove = db.prepare("DELETE FROM milestones WHERE id = ?");

  function checkId(id: string) {
    if (!UUID.test(id)) throw new InvalidRequest("Milestone id must be a uuid");
  }

  return {
    list: (): Milestone[] => (selectAll.all() as unknown as MilestoneRow[]).map(toMilestone),

    /** Creates or replaces a milestone. */
    put(id: string, body: unknown): Milestone {
      checkId(id);
      const { label, startDay, endDay = null } = parseBody(body);
      upsert.run(id, label, startDay, endDay, new Date().toISOString());
      return toMilestone(selectOne.get(id) as unknown as MilestoneRow);
    },

    remove(id: string): null {
      checkId(id);
      remove.run(id);
      return null;
    },
  };
}

function parseBody(body: unknown): PutMilestoneBody {
  const { label, startDay, endDay = null } = bodyOf(body, ["label", "startDay", "endDay"]);
  if (typeof label !== "string" || !label.trim() || label.length > MAX_MILESTONE_LABEL)
    throw new InvalidRequest(`label must be 1 to ${MAX_MILESTONE_LABEL} characters`);
  const isDay = (d: unknown): d is string => typeof d === "string" && DAY.test(d) && !Number.isNaN(Date.parse(d));
  if (!isDay(startDay)) throw new InvalidRequest('startDay must be a day, "2026-09-05"');
  if (endDay !== null && !isDay(endDay)) throw new InvalidRequest('endDay must be a day, "2026-09-06", or null');
  if (endDay !== null && endDay < startDay) throw new InvalidRequest("endDay can't be before startDay");
  return { label: label.trim(), startDay, endDay: endDay === startDay ? null : endDay };
}
