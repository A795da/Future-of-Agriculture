// Turkish template sentences, built only from the computed results (like the
// English templates in explain/templates.js). They frame the result in Turkish
// without quoting the English evidence lines.

import { dayLabel } from "./strings.js";

const MONTHS_FULL = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const cap = (s) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
const when = (iso) => {
  const { day, date } = dayLabel(iso, "tr");
  return `${date} ${day}`;
};

/** Rotation card summary in Turkish. */
export function cardSummaryTr(result, baseline) {
  const pos = result.reasons.filter((r) => r.effect === "positive").length;
  const neg = result.reasons.filter((r) => r.effect === "negative").length;
  const parts = [];
  if (result.is_baseline) parts.push(`Şu anki ekim nöbetiniz 100 üzerinden ${result.score} puan alıyor.`);
  else if (baseline) {
    const d = result.score - baseline.score;
    parts.push(
      d === 0
        ? `Bu seçenek 100 üzerinden ${result.score} puan alıyor; şu anki ekim nöbetinizle aynı.`
        : `Bu seçenek 100 üzerinden ${result.score} puan alıyor; şu anki ekim nöbetinizden ${Math.abs(d)} puan ${d > 0 ? "yüksek" : "düşük"}.`
    );
  } else parts.push(`Bu seçenek 100 üzerinden ${result.score} puan alıyor.`);
  parts.push(`${pos} olumlu ve ${neg} olumsuz kanıt var; ayrıntılar aşağıda.`);
  if (result.what_if) parts.push("Bu sayılar bir senaryodur, tahmin değildir.");
  return parts.join(" ");
}

/** Crop check summary in Turkish. `nameTr(id)` gives the Turkish crop name. */
export function checkSummaryTr(result, nameTr) {
  const crop = cap(nameTr(result.crop));
  const after = result.previous.length ? ` (${nameTr(result.previous[0]).toLocaleLowerCase("tr")} sonrası)` : "";
  const blockers = result.reasons.filter((r) => r.level === "blocker").length;
  const cautions = result.reasons.filter((r) => r.level === "caution").length;
  if (result.verdict === "not_reasonable") return `${crop}${after} burada mantıklı bir seçim değil: ${blockers} engelleyici neden var.`;
  if (result.verdict === "possible_with_care") return `${crop}${after} olabilir, ama dikkatli olun: ${cautions} dikkat noktası var.`;
  return `${crop}${after} bu yer için mantıklı görünüyor.`;
}

const LEVEL_WORD = { red: "uyarısı", yellow: "riski" };
const TYPE_WORD = { frost: "Don", heat: "Sıcaklık", rain: "Şiddetli yağış", water: "Kuraklık" };

/** Turkish clause: how unusual the forecast is in the 20-year NASA POWER record. */
function contextTr(c, kind) {
  if (!c) return "";
  const what = kind === "heat" ? "bu 10 günlük dönemin en sıcak gününden daha sıcak" : "bu 10 günlük dönemin en soğuk gecesinden daha soğuk";
  // Number-free suffixes ("yılında", "yılından") so vowel harmony never depends on the digits.
  if (c.record) return `; ${c.first} yılından beri her yıl ${what} (NASA POWER)`;
  return `; son ${c.n} yılın ${c.beaten} yılında ${what} (NASA POWER ${c.first}-${c.last})`;
}

/** One-line Turkish evidence for a Today alert, from its structured values. */
export function alertEvidenceTr(a, cropTr) {
  const d = a.data ?? {};
  if (a.type === "frost") {
    const limit =
      d.mode === "hardiness"
        ? `kışa alışmış ${cropTr} yaklaşık ${d.limit} °C'ye kadar dayanır; kar örtüsü birkaç derece korur`
        : d.mode === "flowering"
          ? `${cropTr} çiçeklenmede ${d.limit} °C altında zarar görür`
          : d.mode === "sensitive"
            ? `${cropTr} dona hassastır, her don zarar verebilir`
            : `${cropTr} yaklaşık ${d.limit} °C altında zarar görür`;
    return `en düşük sıcaklık ${d.value} °C (${when(d.date)}); ${limit}${contextTr(d.context, "frost")}`;
  }
  if (a.type === "heat") return `en yüksek sıcaklık ${d.value} °C (${when(d.date)}); ${cropTr} ${d.limit} °C üzerinde${d.flowering ? " çiçeklenmede" : ""} strese girer${contextTr(d.context, "heat")}`;
  if (a.type === "rain") return `${when(d.date)} günü ${d.value} mm yağış bekleniyor${d.days > 1 ? ` (${d.days} gün 20 mm ya da daha fazla)` : ""}`;
  if (a.type === "water" && a.level === "info") return `${cropTr} bu hafta yaklaşık ${d.use} mm su kullanacak; yaklaşık ${d.rain} mm yağış bekleniyor`;
  if (a.type === "water") return `önümüzdeki 7 günde yalnızca ${d.rain} mm yağış bekleniyor, ${cropTr} ise yaklaşık ${d.use} mm su kullanır`;
  return a.evidence;
}

const ACTIONS_TR = {
  snow: "Soğuk gecelerden sonra kar örtüsünü ve bitki zararını kontrol edin; yeniden ekmeden önce yerel bir ziraat mühendisine danışın.",
  protect: "Don zararı olası: mümkünse önlem alın (bazı ürünlerde akşamdan sulama donu azaltabilir) ve sonra çiçekleri kontrol edin.",
  watch: "Tahmini takip edin; en düşük sıcaklık zarar sınırına yakın.",
  irrigate: "Sıcak günlerden önce sulayın, öğle sıcağında sulamayın.",
  note: "Çiçeklenmedeki sıcaklık verimi düşürebilir; kuru tarlada yapılacak bir şey yok, ama gelecek yılın çeşit seçimi için not edin.",
  fertilizer: "Yağıştan önceki 2-3 gün azotlu gübre atmayın: şiddetli yağış yüzeydeki gübreyi tarladan ya da kök bölgesinin altına yıkayabilir.",
  drain: "Ekim yapmadan ya da tarlaya makineyle girmeden önce toprağın suyunu çekmesini bekleyin.",
  harvest: "Ürün hazırsa yağıştan önce hasat edin.",
  topsoil: "Toprak çıplak ya da az örtülü; şiddetli yağış üst toprağı taşıyabilir. Yağıştan hemen önce toprak işlemeyin.",
  drainage: "Drenajı kontrol edin.",
  covered: "Bu haftanın su ihtiyacını yağış karşılamalı.",
  stored: "Ürün bu hafta topraktaki suyla yaşıyor; üst toprağı kurutan fazladan toprak işlemeden kaçının.",
};

/** Turkish "what to do" for a Today alert. */
export function alertActionTr(a) {
  const d = a.data ?? {};
  if (d.action === "plan") return `Hafta boyunca yaklaşık ${d.need} mm sulama planlayın.`;
  if (Array.isArray(d.actions)) return d.actions.map((k) => ACTIONS_TR[k]).filter(Boolean).join(" ");
  return ACTIONS_TR[d.action] ?? a.action;
}

/** Today summary in Turkish. */
export function todaySummaryTr(r, nameTr) {
  const n = nameTr(r.crop);
  const top = r.alerts.find((a) => a.level !== "info");
  if (r.stage.key === "not_in_field" && !top) {
    const m = r.stage.sowing_doy ? MONTHS_FULL[new Date(Date.UTC(2026, 0, r.stage.sowing_doy)).getUTCMonth()] : null;
    return `${cap(n)} şu an tarlada değil${m ? ` (genellikle ${m} ayında ekilir)` : ""}.`;
  }
  if (r.stage.key === "before_sowing" && !top) return `${cap(n)} için ekim zamanı yaklaşıyor (yaklaşık ${r.stage.days_to_sowing} gün). Önümüzdeki 7 günde şiddetli yağış yok.`;
  if (!top) {
    return r.crop === "fallow"
      ? "Önümüzdeki 7 günde şiddetli yağış yok; çıplak tarlada erozyon riski düşük."
      : `Önümüzdeki 7 günde ${n.toLocaleLowerCase("tr")} için don, sıcaklık, şiddetli yağış ya da kuraklık riski yok.`;
  }
  const more = r.alerts.length > 1 ? ` Aşağıda ${r.alerts.length - 1} not daha var.` : "";
  return `${TYPE_WORD[top.type]} ${LEVEL_WORD[top.level]}: ${alertEvidenceTr(top, n.toLocaleLowerCase("tr"))}.${more}`;
}

// ---- water amounts (from the `water` numbers on a reason; 1 mm = 1 m³ per dekar)
const numTr = (x) => x.toLocaleString("tr-TR");
function peaksTr(peaks) {
  if (!peaks?.length) return "";
  const parts = peaks.map((m) => `${MONTHS_FULL[m.month]} (~${m.mm} mm)`);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} ve ${parts.at(-1)}`;
  return `; en çok ${list} aylarında`;
}
const METHOD_TR = "Gerçek miktar sulama yöntemine bağlıdır: damla sulama, salma ve yağmurlamaya göre daha az su kaybettirir.";

/** Turkish water line from `reason.water`. */
export function waterEvidenceTr(w) {
  const crop = w.crop_tr ?? "Bu ürün";
  const amount = `yaklaşık ${numTr(w.mm)} mm (dekara ${numTr(w.mm)} m³, hektara ${numTr(w.mm * 10)} m³)`;
  const peaks = peaksTr(w.peaks);
  // "karşılanan pay: %30" avoids the number-dependent suffix (%30'unu / %40'ını).
  const share = `yağmur ve topraktaki suyla karşılanan pay yaklaşık %${w.covered}`;
  if (w.mode === "dry_short") {
    return `Kurak bir yılda ${crop.toLocaleLowerCase("tr")} ~${numTr(w.need)} mm su kullanır; ${share}. Eksik kalan su ${amount}${peaks}; ek sulama bu açığı kapatır.`;
  }
  const lead = w.mode === "would_irrigate" ? `${crop} için sulama gerekir: ` : `${crop}: `;
  return `${lead}normal bir yılda ${amount} sulama suyu gerekir; bitki ~${numTr(w.need)} mm su kullanır, ${share}${peaks}. ${METHOD_TR}`;
}
