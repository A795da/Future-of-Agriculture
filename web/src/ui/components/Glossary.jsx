// Tappable glossary terms (work on touch screens: tap to open, tap again to close)
// and the full glossary list, in the interface language.

import { useState } from "react";
import { GLOSSARY, glossaryEntry, splitGlossary } from "../../explain/glossary.js";
import { useLang } from "../../i18n/LangContext.jsx";

const say = (g, lang) => (lang === "tr" && g.tr ? g.tr : g);

export function Term({ id, children }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const g = glossaryEntry(id);
  if (!g) return children;
  const s = say(g, lang);
  return (
    <>
      <button
        type="button"
        className="term"
        aria-expanded={open}
        title={open ? undefined : s.text}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {children}
      </button>
      {open && (
        <span className="term-def" role="note">
          <b>{s.term}:</b> {s.text}
        </span>
      )}
    </>
  );
}

/** Text with its glossary terms made tappable; definitions open below the whole text, not mid-sentence. */
export function GlossaryText({ text }) {
  const { lang } = useLang();
  const [open, setOpen] = useState([]);
  const toggle = (id) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  return (
    <>
      {splitGlossary(text).map((p, i) =>
        typeof p === "string" ? (
          p
        ) : (
          <button
            key={i}
            type="button"
            className="term"
            aria-expanded={open.includes(p.id)}
            title={open.includes(p.id) ? undefined : say(glossaryEntry(p.id), lang).text}
            onClick={(e) => {
              e.stopPropagation();
              toggle(p.id);
            }}
          >
            {p.text}
          </button>
        )
      )}
      {open.map((id) => {
        const s = say(glossaryEntry(id), lang);
        return (
          <span key={id} className="term-def" role="note">
            <b>{s.term}:</b> {s.text}
          </span>
        );
      })}
    </>
  );
}

export default function GlossaryList() {
  const { lang, t } = useLang();
  return (
    <details className="glossary">
      <summary>{t("glossary_h", { n: GLOSSARY.length })}</summary>
      <dl>
        {GLOSSARY.map((g) => {
          const s = say(g, lang);
          return (
            <div key={g.id}>
              <dt>{s.term}</dt>
              <dd>{s.text}</dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}
