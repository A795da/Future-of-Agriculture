// Interface language for every component, without passing it through each prop.
import { createContext, useContext, useMemo } from "react";
import { translate } from "./strings.js";

const LangContext = createContext("en");

export function LangProvider({ lang, children }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** { lang, t } where t("key", {vars}) returns the text in the current language. */
export function useLang() {
  const lang = useContext(LangContext);
  return useMemo(() => ({ lang, t: (key, vars) => translate(lang, key, vars) }), [lang]);
}
