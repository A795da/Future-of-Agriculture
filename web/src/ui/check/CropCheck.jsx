// Crop check tab: "Would this crop work here?" / "Bu ürün mantıklı mı?"
// Free text → crop id in code (aliases.js); the verdict comes from runCropCheck.

import { useEffect, useMemo, useState } from "react";
import { matchCrop } from "../../scoring/aliases.js";
import { runCropCheck } from "../../scoring/cropCheck.js";
import { displayName, shortName } from "../../scoring/names.js";
import { VERDICT_LABELS, checkSummary } from "../../explain/templates.js";
import EvidenceList from "../components/EvidenceList.jsx";
import { previousFromRotation } from "../../scoring/defaults.js";
import AiSummary from "../components/AiSummary.jsx";
import { checkFacts } from "../../explain/payload.js";

const SEASONS = 3;
const EXAMPLES = ["nohut", "ayçiçek", "mısır", "sugar beet"];

export default function CropCheck({ tables, features, inputs, status, place, lang }) {
  const crops = tables.cropTable.crops;
  const cropsById = useMemo(() => Object.fromEntries(crops.map((c) => [c.id, c])), [crops]);
  const nameOf = (id) => (id === "fallow" ? "fallow" : shortName(cropsById[id]));

  const [text, setText] = useState("");
  const [previous, setPrevious] = useState(() => previousFromRotation(inputs.current, SEASONS));
  const [prevTouched, setPrevTouched] = useState(false);
  useEffect(() => {
    if (!prevTouched) setPrevious(previousFromRotation(inputs.current, SEASONS));
  }, [inputs.current, prevTouched]);

  const query = text.split(" · ")[0]; // a datalist pick reads "Sunflower · Ayçiçeği"
  const { crop, matches } = useMemo(() => matchCrop(query, crops), [query, crops]);

  const result = useMemo(() => {
    if (!crop || !features) return null;
    // Blanks end the history: seasons after a gap are ignored.
    const blank = previous.indexOf("");
    const prev = blank < 0 ? previous : previous.slice(0, blank);
    try {
      return runCropCheck({
        cropId: crop.id,
        previous: prev,
        features,
        cropTable: tables.cropTable,
        ruleTable: tables.ruleTable,
        nutrientTable: tables.nutrientTable,
        farmer: { irrigation: inputs.irrigation, never_grow: inputs.never },
        dataStatus: { power: true, soil: false },
      });
    } catch (e) {
      return { error: e.message };
    }
  }, [crop, features, previous, tables, inputs.irrigation, inputs.never]);

  const summary = result && !result.error ? checkSummary(result, nameOf) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const facts = useMemo(() => (summary ? checkFacts(result, nameOf, summary) : null), [result, summary]);

  const setSeason = (k, id) => {
    setPrevTouched(true);
    setPrevious((p) => p.map((x, i) => (i === k ? id : x)));
  };

  return (
    <div className="check">
      <label className="field-label" htmlFor="crop-q">
        Which crop are you thinking of? <span className="muted">(Turkish or English)</span>
      </label>
      <input
        id="crop-q"
        className="crop-q"
        list="crop-names"
        value={text}
        placeholder="e.g. nohut, ayçiçek, wheat"
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      <datalist id="crop-names">
        {crops.map((c) => (
          <option key={c.id} value={`${displayName(c)} · ${c.name_tr}`} />
        ))}
      </datalist>
      {!text && (
        <div className="chips examples">
          <span className="muted">Try:</span>
          {EXAMPLES.map((x) => (
            <button key={x} className="chip-btn" onClick={() => setText(x)}>
              {x}
            </button>
          ))}
        </div>
      )}

      <fieldset className="prev">
        <legend>What was in the field before?</legend>
        <div className="years">
          {previous.map((id, k) => (
            <label key={k} className="year">
              <span>{k === 0 ? "Last season" : `${k + 1} seasons ago`}</span>
              <select value={id} onChange={(e) => setSeason(k, e.target.value)}>
                <option value="">— don't know —</option>
                <option value="fallow">Fallow (nadas)</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {displayName(c)} · {c.name_tr}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="note">
          {prevTouched ? (
            <button className="link" onClick={() => setPrevTouched(false)}>Fill from my current rotation again</button>
          ) : (
            "Filled from your current rotation (assuming it repeats). Change it if it was different."
          )}
        </p>
      </fieldset>

      {text && !crop && matches.length > 1 && (
        <div className="chips">
          <span className="muted">Did you mean:</span>
          {matches.slice(0, 6).map((c) => (
            <button key={c.id} className="chip-btn" onClick={() => setText(`${displayName(c)} · ${c.name_tr}`)}>
              {displayName(c)} · {c.name_tr}
            </button>
          ))}
        </div>
      )}
      {text && !crop && matches.length === 0 && (
        <div className="not-found">
          <p>
            <strong>"{query}"</strong> is not in our crop list yet. These are the crops we can check:
          </p>
          <div className="chips">
            {crops.map((c) => (
              <button key={c.id} className="chip-btn" onClick={() => setText(`${displayName(c)} · ${c.name_tr}`)}>
                {displayName(c)}
              </button>
            ))}
          </div>
        </div>
      )}

      {crop && status === "loading" && <p className="muted">Loading 20 years of NASA climate data…</p>}
      {crop && status === "error" && <p className="warn">Could not load climate data for this place.</p>}
      {result?.error && <p className="warn">Crop check failed: {result.error}</p>}
      {result && !result.error && status === "ready" && (
        <article className={`verdict-card v-${result.verdict}`}>
          <header className="rot-head">
            <span className="rot-tag">
              {displayName(crop)} · {place}
            </span>
            <span className={`conf conf-${result.confidence}`} title="How much to trust this result">
              {result.confidence} confidence
            </span>
          </header>
          <div className="verdict">
            <span className="verdict-badge">{VERDICT_LABELS[result.verdict].en}</span>
            <span className="verdict-tr">{VERDICT_LABELS[result.verdict].tr}</span>
          </div>
          <p className="summary">{summary}</p>
          {facts && <AiSummary kind="check" facts={facts} lang={lang} />}

          <h4>Evidence</h4>
          <EvidenceList reasons={result.reasons} />

          <h4>
            {result.previous.length ? `Better after ${nameOf(result.previous[0])}` : "Other crops that fit here"}
          </h4>
          {result.alternatives.length ? (
            <div className="chips">
              {result.alternatives.map((id) => (
                <button key={id} className="chip-btn alt" onClick={() => setText(`${displayName(cropsById[id])} · ${cropsById[id].name_tr}`)}>
                  {displayName(cropsById[id])}
                </button>
              ))}
            </div>
          ) : (
            <p className="note">No crop on our list does clearly better here after that season.</p>
          )}

          {result.risks.length > 0 && (
            <>
              <h4>Risks to check locally</h4>
              <ul className="risks">
                {result.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
          <details className="gaps">
            <summary>What we don't know ({result.gaps.length})</summary>
            <ul>
              {result.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </details>
          <p className="note">The verdict comes from fixed rules and NASA data, not from AI. A local agronomist should confirm it.</p>
        </article>
      )}
    </div>
  );
}
