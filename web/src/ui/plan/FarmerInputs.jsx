// Farmer input: irrigation, current rotation (one crop per year), priorities
// and crops they will never grow. Pure UI; the parent owns the state.

import { displayName as cropName } from "../../scoring/names.js";

const MAX_YEARS = 4;

const PRIORITIES = [
  { key: "water", label: "Save water" },
  { key: "soil", label: "Soil health" },
  { key: "income", label: "Income" },
  { key: "simplicity", label: "Keep it simple" },
];

export default function FarmerInputs({ crops, value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch, touched: true });
  const seq = value.current;

  const setYear = (i, id) => {
    const next = [...seq];
    if (id === "") next.splice(i, 1);
    else next[i] = id;
    set({ current: next.length ? next : ["wheat"] });
  };
  const toggleNever = (id) =>
    set({ never: value.never.includes(id) ? value.never.filter((x) => x !== id) : [...value.never, id] });

  return (
    <div className="inputs">
      <fieldset>
        <legend>Water</legend>
        <div className="seg">
          <button className={value.irrigation === "rainfed" ? "on" : ""} onClick={() => set({ irrigation: "rainfed" })}>
            Rain-fed
          </button>
          <button className={value.irrigation === "irrigated" ? "on" : ""} onClick={() => set({ irrigation: "irrigated" })}>
            Irrigated
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Your current rotation (one main crop per year)</legend>
        <div className="years">
          {seq.map((id, i) => (
            <label key={i} className="year">
              <span>Year {i + 1}</span>
              <select value={id} onChange={(e) => setYear(i, e.target.value)}>
                {i > 0 && <option value="">— remove year —</option>}
                <option value="fallow">Fallow (nadas)</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {cropName(c)} · {c.name_tr}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {seq.length < MAX_YEARS && (
            <button className="add-year" onClick={() => set({ current: [...seq, "fallow"] })}>
              + Add a year
            </button>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>What matters most to you?</legend>
        {PRIORITIES.map((p) => (
          <label key={p.key} className="slider">
            <span>{p.label}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={value.priorities[p.key]}
              onChange={(e) => set({ priorities: { ...value.priorities, [p.key]: +e.target.value } })}
            />
            <output>{value.priorities[p.key]}</output>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Crops you will never grow</legend>
        <div className="chips">
          {crops.map((c) => (
            <button
              key={c.id}
              className={`chip-btn ${value.never.includes(c.id) ? "on" : ""}`}
              aria-pressed={value.never.includes(c.id)}
              onClick={() => toggleNever(c.id)}
            >
              {cropName(c)}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
