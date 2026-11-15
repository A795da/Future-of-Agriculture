// Number check for AI text: every number the AI writes must appear in the JSON
// it was given. Shared by the serverless function and the browser (both check).
// If one number does not match, the app shows the template sentence instead.

/** Numbers written in a text: "−2 °C", "30%", "1684", "0.5". Ranges "5-15" give 5 and 15. */
export function numbersIn(text) {
  const s = String(text ?? "").replace(/[−–‒]/g, "-");
  const out = [];
  const re = /(^|[^\d.,])(-?)(\d+(?:[.,]\d+)*)/g;
  let m;
  while ((m = re.exec(s))) {
    // a minus right after a digit is a range dash ("5-15"), not a sign
    const negative = m[2] === "-" && !/\d$/.test(s.slice(0, m.index + m[1].length));
    const raw = m[3];
    // a trailing "." or "," ends a sentence; it is not a decimal mark
    out.push({ raw: (negative ? "-" : "") + raw, value: parseNumber(raw) * (negative ? -1 : 1) });
  }
  return out;
}

/** "1684", "0.5", "0,5" (Turkish decimal), "1,684" / "1.684" (thousands). Returns the plain reading. */
function parseNumber(raw) {
  return Number(raw.replace(/,/g, "."));
}

/** All readings of a written number (decimal mark or thousands separator). */
function readings(raw) {
  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  const vals = new Set([Number(body.replace(/,/g, ".")), Number(body.replace(/[.,]/g, ""))]);
  if (/^\d+[.,]\d+$/.test(body)) vals.add(Number(body.replace(",", ".")));
  return [...vals].filter(Number.isFinite).map((v) => (neg ? -v : v));
}

/** Every number found anywhere in a JSON value (numbers and numbers inside strings), with absolute values. */
export function numbersInJson(value) {
  const set = new Set();
  const add = (v) => {
    const r = Math.round(v * 1000) / 1000;
    set.add(r);
    set.add(Math.abs(r));
  };
  const walk = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) add(v);
    else if (typeof v === "string") for (const n of numbersIn(v)) readings(n.raw).forEach(add);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return set;
}

// Numbers written as words would slip past the digit check ("yirmi yılın yedisinde"),
// so they are not allowed at all: the prompt asks for digits. Left out on purpose
// because they are ordinary words too: one/bir (a, an), on (Turkish ten; English
// "on"), altı (six; "under"), yüz (hundred; "face"), bin, half, second.
const NUMBER_WORDS =
  /(?<![\p{L}])(two|three|four|five|seven|eight|nine|ten|eleven|twelve|thirteen|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|iki\p{L}*|üç\p{L}*|dört\p{L}*|beş\p{L}*|yedi\p{L}*|sekiz\p{L}*|dokuz\p{L}*|yirmi\p{L}*|otuz\p{L}*|kırk\p{L}*|elli\p{L}*|altmış\p{L}*|yetmiş\p{L}*|seksen\p{L}*|doksan\p{L}*)(?![\p{L}])/giu;

/** Number words in a text ("seven", "yedisinde"). */
export function numberWordsIn(text) {
  return [...String(text ?? "").matchAll(NUMBER_WORDS)].map((m) => m[0]);
}

/** { ok, unknown: ["48", "yedi", ...] }: ok only when every number in the text is in the data, as digits. */
export function verifyNumbers(text, facts) {
  if (!text || !String(text).trim()) return { ok: false, unknown: [], reason: "empty" };
  const allowed = numbersInJson(facts);
  const unknown = numbersIn(text)
    .filter((n) => !readings(n.raw).some((v) => allowed.has(Math.round(v * 1000) / 1000) || allowed.has(Math.abs(Math.round(v * 1000) / 1000))))
    .map((n) => n.raw);
  // A number word copied from the data ("at least two non-host crops") is fine.
  const inFacts = new Set(numberWordsIn(JSON.stringify(facts)).map((w) => w.toLocaleLowerCase("tr")));
  unknown.push(...numberWordsIn(text).filter((w) => !inFacts.has(w.toLocaleLowerCase("tr"))));
  return { ok: unknown.length === 0, unknown };
}
