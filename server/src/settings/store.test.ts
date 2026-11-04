import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../db.ts";
import { SETTINGS_MIGRATIONS, settingsStore } from "./store.ts";

test("settings are kept per owner and replaced whole", () => {
  const store = settingsStore(openDb(":memory:", SETTINGS_MIGRATIONS));
  store.put("ui.cube", { hints: "all" });
  store.put("f2l", { focusMissing: true });
  store.put("f2l", { focusMissing: false });
  assert.deepEqual(store.list().settings, { f2l: { focusMissing: false }, "ui.cube": { hints: "all" } });
});

test("bad owners and non-objects are refused", () => {
  const store = settingsStore(openDb(":memory:", SETTINGS_MIGRATIONS));
  assert.throws(() => store.put("F2L!", {}), /owner/);
  assert.throws(() => store.put("f2l", [1]), /JSON object/);
  assert.throws(() => store.put("f2l", null), /JSON object/);
});
