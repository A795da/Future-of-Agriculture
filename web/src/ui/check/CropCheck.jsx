// Crop check tab: "Would this crop work here?" / "Bu ürün mantıklı mı?"
// Free text → crop id in code (aliases.js); the verdict comes from runCropCheck.

import { useEffect, useMemo, useState } from "react";
import { matchCrop } from "../../scoring/aliases.js";
import { runCropCheck } from "../../scoring/cropCheck.js";
import { displayName, shortName } from "../../scoring/names.js";
import { checkSummary } from "../../explain/templates.js";
import EvidenceList from "../components/EvidenceList.jsx";
import { previousFromRotation } from "../../scoring/defaults.js";
import AiSummary from "../components/AiSummary.jsx";
import { checkFacts } from "../../explain/payload.js";
import { useLang } from "../../i18n/LangContext.jsx";
import { cropLabel } from "../../i18n/strings.js";
import { checkSummaryTr } from "../../i18n/summaries.js";

const SEASONS = 3;
const EXAMPLES = { en: ["nohut", "ayçiçek", "mısır", "sugar beet"], tr: ["nohut", "ayçiçeği", "mısır", "şeker pancarı"] };

export default function CropCheck({ tables, features, inputs, status, place, localYields = null }) {
  const { lang, t } = useLang();
  const crops = tables.cropTable.crops;
  const cropsById = useMemo(() => Object.fromEntries(crops.map((c) => [c.id, c])), [crops]);
  const nameOf = (id) => (id === "fallow" ? "fallow" : shortName(cropsById[id])); // English, for the AI facts
  const label = (id) => cropLabel(id, cropsById, lang);
  // Option text shows both names so either language matches; the matcher reads the part before " · ".
  const pickText = (c) => (lang === "tr" ? `${cropLabel(c, cropsById, "tr")} · ${displayName(c)}` : `${displayName(c)} · ${c.name_tr}`);

  const [text, setText] = useState("");
  const [previous, setPrevious] = useState(() => previousFromRotation(inputs.current, SEASONS));
  const [prevTouched, setPrevTouched] = useState(false);
  useEffect(() => {
    if (!prevTouched) setPrevious(previousFromRotation(inputs.current, SEASONS));
  }, [inputs.current, prevTouched]);

  const query = text.split(" · ")[0];
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
        localYields,
        nutrientTable: tables.nutrientTable,
        farmer: { irrigation: inputs.irrigation, never_grow: inputs.never },
        dataStatus: { power: true, soil: false },
      });
    } catch (e) {
      return { error: e.message };
    }
  }, [crop, features, previous, tables, inputs.irrigation, inputs.never, localYields]);

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
        {t("which_crop")} <span className="muted">{t("tr_or_en")}</span>
      </label>
      <input
        id="crop-q"
        className="crop-q"
        list="crop-names"
        value={text}
        placeholder={t("crop_placeholder")}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      <datalist id="crop-names">
        {crops.map((c) => (
          <option key={c.id} value={pickText(c)} />
        ))}
      </datalist>
      {!text && (
        <div className="chips examples">
          <span className="muted">{t("try")}</span>
          {EXAMPLES[lang].map((x) => (
            <button key={x} className="chip-btn" onClick={() => setText(x)}>
              {x}
            </button>
          ))}
        </div>
      )}

      <fieldset className="prev">
        <legend>{t("before_legend")}</legend>
        <div className="years">
          {previous.map((id, k) => (
            <label key={k} className="year">
              <span>{k === 0 ? t("last_season") : t("seasons_ago", { n: k + 1 })}</span>
              <select value={id} onChange={(e) => setSeason(k, e.target.value)}>
                <option value="">{t("dont_know")}</option>
                <option value="fallow">{t("fallow_opt")}</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pickText(c)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="note">
          {prevTouched ? (
            <button className="link" onClick={() => setPrevTouched(false)}>{t("refill")}</button>
          ) : (
            t("prefilled")
          )}
        </p>
      </fieldset>

      {text && !crop && matches.length > 1 && (
        <div className="chips">
          <span className="muted">{t("did_you_mean")}</span>
          {matches.slice(0, 6).map((c) => (
            <button key={c.id} className="chip-btn" onClick={() => setText(pickText(c))}>
              {pickText(c)}
            </button>
          ))}
        </div>
      )}
      {text && !crop && matches.length === 0 && (
        <div className="not-found">
          <p>{t("not_in_list", { q: query })}</p>
          <div className="chips">
            {crops.map((c) => (
              <button key={c.id} className="chip-btn" onClick={() => setText(pickText(c))}>
                {label(c.id)}
              </button>
            ))}
          </div>
        </div>
      )}

      {crop && status === "loading" && <p className="muted">{t("loading_climate")}</p>}
      {crop && status === "error" && <p className="warn">{t("climate_error_short")}</p>}
      {result?.error && <p className="warn">{t("check_failed", { e: result.error })}</p>}
      {result && !result.error && status === "ready" && (
        <article className={`verdict-card v-${result.verdict}`}>
          <header className="rot-head">
            <span className="rot-tag">
              {label(crop.id)} · {place}
            </span>
            <span className={`conf conf-${result.confidence}`} title={t("trust_title")}>
              {t(`conf_${result.confidence}`)} {t("confidence_word")}
            </span>
          </header>
          <div className="verdict">
            <span className="verdict-badge">{t(`v_${result.verdict}`)}</span>
          </div>
          <p className="summary">{lang === "tr" ? checkSummaryTr(result, label) : summary}</p>
          {facts && <AiSummary kind="check" facts={facts} lang={lang} />}

          <h4>{t("evidence")}</h4>
          <EvidenceList reasons={result.reasons} />

          <h4>{result.previous.length ? t("better_after", { crop: label(result.previous[0]) }) : t("other_fits")}</h4>
          {result.alternatives.length ? (
            <div className="chips">
              {result.alternatives.map((id) => (
                <button key={id} className="chip-btn alt" onClick={() => setText(pickText(cropsById[id]))}>
                  {label(id)}
                </button>
              ))}
            </div>
          ) : (
            <p className="note">{t("no_better")}</p>
          )}

          {result.risks.length > 0 && (
            <>
              <h4>{t("risks")}</h4>
              <ul className="risks" lang="en">
                {result.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
          <details className="gaps">
            <summary>{t("gaps", { n: result.gaps.length })}</summary>
            <ul lang="en">
              {result.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </details>
          <p className="note">{t("verdict_note")}</p>
        </article>
      )}
    </div>
  );
}
