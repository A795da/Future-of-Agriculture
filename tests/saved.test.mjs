// Saved choices (localStorage, this browser only): good data round-trips,
// broken or tampered data falls back to the defaults.
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { loadSaved, saveLocal, forgetSaved, isFarm, isFieldShape, isProvinceId } = await import("../web/src/data/saved.js");
const { DEFAULT_FARM, withNewPart } = await import("../web/src/scoring/defaults.js");

test("a farm with parts and second crops round-trips", () => {
  const farm = withNewPart({ ...DEFAULT_FARM, parts: [{ ...DEFAULT_FARM.parts[0], second: { 0: "maize" } }] });
  saveLocal("farm", farm);
  assert.deepEqual(loadSaved("farm", isFarm, null), farm);
});

test("broken or tampered data falls back to the default", () => {
  store.set("fieldshift-v1-farm", "{not json");
  assert.equal(loadSaved("farm", isFarm, "default"), "default");
  saveLocal("farm", { ...DEFAULT_FARM, parts: [] });
  assert.equal(loadSaved("farm", isFarm, "default"), "default");
  saveLocal("farm", { ...DEFAULT_FARM, activePart: "nope" });
  assert.equal(loadSaved("farm", isFarm, "default"), "default");
  saveLocal("field", { mode: "draw", verts: [[1, "x"]], closed: false, pin: null });
  assert.equal(loadSaved("field", isFieldShape, null), null);
  saveLocal("province", "<script>");
  assert.equal(loadSaved("province", isProvinceId, "konya"), "konya");
});

test("forget removes every saved choice", () => {
  saveLocal("farm", DEFAULT_FARM);
  saveLocal("field", { mode: "pin", verts: [], closed: false, pin: [37.9, 32.5] });
  forgetSaved();
  assert.equal(loadSaved("farm", isFarm, null), null);
  assert.equal(loadSaved("field", isFieldShape, null), null);
});
