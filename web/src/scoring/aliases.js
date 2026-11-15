// Free-text crop names → crop table ids, for the crop check tab.
// Turkish and English names from the crop table plus a small alias list, matched
// accent-insensitively ("aycicek" = "ayçiçeği"). Code only: no AI guesses.

export const ALIASES = {
  wheat: ["buğday", "kışlık buğday", "ekmeklik buğday", "makarnalık buğday", "durum", "winter wheat"],
  spring_wheat: ["yazlık buğday", "spring wheat"],
  barley: ["arpa", "kışlık arpa", "winter barley"],
  spring_barley: ["yazlık arpa", "spring barley"],
  oats: ["yulaf", "oat"],
  rye: ["çavdar"],
  triticale: ["tritikale"],
  maize: ["mısır", "dane mısır", "corn", "grain maize"],
  silage_maize: ["silaj", "silajlık mısır", "silage corn"],
  sorghum: ["sorgum"],
  chickpea: ["nohut", "chick pea"],
  lentil: ["mercimek", "kırmızı mercimek", "yeşil mercimek"],
  pea: ["bezelye", "dry pea", "field pea"],
  faba_bean: ["bakla", "fava", "broad bean"],
  soybean: ["soya", "soy", "soya bean"],
  dry_bean: ["fasulye", "kuru fasulye", "bean", "beans"],
  sunflower: ["ayçiçek", "ayçiçeği", "gündöndü", "günebakan"],
  safflower: ["aspir"],
  canola: ["kanola", "kolza", "rapeseed", "rape"],
  sugar_beet: ["pancar", "şeker pancarı", "beet"],
  cotton: ["pamuk"],
  potato: ["patates", "potatoes"],
  tomato: ["domates", "tomatoes", "salçalık domates"],
  alfalfa: ["yonca", "lucerne", "kaba yonca"],
  sainfoin: ["korunga"],
  vetch: ["fiğ", "adi fiğ", "macar fiğ"],
};

const TR = { ı: "i", İ: "i", ğ: "g", ş: "s", ç: "c", ö: "o", ü: "u", â: "a", î: "i", û: "u" };

/** Lowercase, Turkish letters folded to ASCII, punctuation removed: "Ayçiçeği" → "aycicegi". */
export function normalize(s) {
  return String(s ?? "")
    .replace(/[ıİğşçöüâîûĞŞÇÖÜÂÎÛ]/g, (ch) => TR[ch.toLowerCase()] ?? TR[ch] ?? ch)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** All the ways a crop can be written, explicit aliases first (they win ties). */
function namesOf(crop) {
  const strip = (s) => s.replace(/\s*\([^)]*\)/g, "");
  return [
    ...(ALIASES[crop.id] ?? []),
    crop.id.replace(/_/g, " "),
    crop.name_en,
    strip(crop.name_en),
    crop.name_tr,
    strip(crop.name_tr),
  ].map(normalize);
}

/**
 * Match free text to a crop. Returns { crop, matches }:
 *   crop    the single best match, or null
 *   matches every crop whose name starts with the text (for "did you mean")
 */
export function matchCrop(text, crops) {
  const q = normalize(text);
  if (!q) return { crop: null, matches: [] };
  // Exact name or alias; explicit aliases are checked before table names, so
  // "buğday" means winter wheat, not spring wheat.
  for (const pass of ["alias", "name"]) {
    for (const c of crops) {
      const names = pass === "alias" ? (ALIASES[c.id] ?? []).map(normalize) : namesOf(c);
      if (names.includes(q)) return { crop: c, matches: [c] };
    }
  }
  const matches = crops.filter((c) => namesOf(c).some((n) => n.startsWith(q) || n.split(" ").some((w) => w.startsWith(q))));
  return { crop: matches.length === 1 ? matches[0] : null, matches };
}
