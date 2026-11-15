// Plain-language glossary. The challenge brief asks the tool to explain
// scientific terms (NDVI, evapotranspiration) and how uncertainty is handled.
// `match` finds the term inside evidence text so it can be tapped there.

export const GLOSSARY = [
  {
    id: "et",
    tr: { term: "Evapotranspirasyon (su ihtiyacı)", text: "Tarladan buhar olarak çıkan su: topraktan buharlaşma ile bitkinin yapraklarından verdiği suyun toplamı. Bitkinin su tüketimidir. FieldShift buna ürünün su ihtiyacı der ve NASA hava verilerinden FAO-56 yöntemiyle hesaplar." },
    term: "Evapotranspiration (water need)",
    text: "Water that leaves the field as vapour: evaporation from the soil plus the water the crop gives off through its leaves. It is the crop's water use. FieldShift calls it the crop's water need and works it out from NASA weather data with the FAO-56 method.",
    match: /\b(evapotranspiration|water need|ET0)\b/i,
  },
  {
    id: "ndvi",
    tr: { term: "NDVI", text: "Bitkilerin ne kadar yeşil ve sık olduğunu gösteren uydu ölçüsü: 0 (çıplak toprak) ile yaklaşık 0,9 (sık yeşil ürün) arasında. Yağışlı mevsimde düşük değerler toprağın çıplak kaldığı ve aşınabileceği dönemleri gösterir." },
    term: "NDVI",
    text: "A satellite measure of how green and dense the plants are, from 0 (bare soil) to about 0.9 (thick green crop). Low values in the rainy season show when the soil is bare and can erode.",
    match: /\bNDVI\b/,
  },
  {
    id: "dry-year",
    tr: { term: "Kurak yıl", text: "Son 20 yılın en kurak dörtte biri kadar kurak bir yıl (25. yüzdelik). Kurak yılda da işleyen planlar, yalnızca ortalama yılda işleyenlerden daha güvenlidir." },
    term: "Dry year",
    text: "A year as dry as the driest quarter of the last 20 years (the 25th percentile). Plans that work in a dry year are safer than plans that only work in an average one.",
    match: /\bdry[- ]year\b/i,
  },
  {
    id: "stored-water",
    tr: { term: "Topraktaki depolanmış su", text: "Ekimden önceki aylarda yağan ve ürün başlarken toprakta hâlâ duran su. Nadas yılı bir sonraki ürün için fazladan su biriktirir." },
    term: "Stored soil water",
    text: "Rain from the months before sowing that the soil still holds when the crop starts. A fallow year stores extra water for the next crop.",
    match: /\bstored soil water\b/i,
  },
  {
    id: "reanalysis",
    tr: { term: "NASA yeniden analiz verisi", text: "Gerçek gözlemlerle sürekli düzeltilen bir NASA modeliyle yeniden oluşturulmuş hava verisi (NASA POWER). Dünyanın her yerini onlarca yıl boyunca kapsar, ama onlarca kilometrelik bir ızgara üzerindedir; yakın tarlalar aynı değerleri paylaşır." },
    term: "NASA reanalysis",
    text: "Weather reconstructed by a NASA model that is constantly corrected with real observations (NASA POWER). It covers every place on Earth for decades, but on a grid tens of kilometres wide, so nearby fields share the same values.",
    match: /\bNASA reanalysis\b/,
  },
  {
    id: "model-estimate",
    tr: { term: "Model tahmini", text: "Tarlanızda ölçülmemiş, bir bilgisayar modeliyle hesaplanmış değer (örneğin hava tahmini ya da modellenmiş toprak). İyi bir tahmin olarak görün." },
    term: "Model estimate",
    text: "A value calculated by a computer model, not measured at your field (for example the weather forecast or modelled soil). Treat it as a good guess.",
    match: /\b(NASA )?model estimate\b/i,
  },
  {
    id: "compiled-rule",
    tr: { term: "Derlenmiş kural", text: "Ekibin yayımlanmış kaynaklardan (FAO, TAGEM-DSİ, bilimsel makaleler) aldığı kural ya da değer. Her birinin kaynağı yazılıdır; henüz yerel bir ziraat mühendisi kontrol etmedi." },
    term: "Compiled rule",
    text: "A rule or value the team took from published sources (FAO, TAGEM-DSİ, research papers). Each one lists its source; a local agronomist has not checked them yet.",
    match: /\bcompiled rule\b/i,
  },
  {
    id: "heat-units",
    tr: { term: "Sıcaklık birikimi (gün-derece)", text: "Ürünün gelişmesi için gereken sıcaklığın üzerindeki sıcaklığın gün gün toplanması. Her ürünün olgunlaşmak için belli bir toplama ihtiyacı vardır; yaz çok serin ya da kısaysa buna ulaşamaz." },
    term: "Heat units (growing degree days)",
    text: "Warmth added up day by day above the temperature a crop needs to grow. A crop needs a certain total to ripen; if the summer is too cool or short, it does not reach it.",
    match: /\bheat units\b/i,
  },
  {
    id: "flowering",
    tr: { term: "Hassas dönem (çiçeklenme)", text: "Don ya da aşırı sıcağın ürüne en çok zarar verdiği ve verimi en çok düşürdüğü, çiçeklenme çevresindeki birkaç hafta. FieldShift son 20 yılın her biri için bu dönemdeki don ve sıcaklığı kontrol eder." },
    term: "Sensitive stage (flowering)",
    text: "The few weeks around flowering when frost or heat damage the crop most and cut the yield the hardest. FieldShift checks frost and heat in this window for each of the last 20 years.",
    match: /\b(at flowering|sensitive stage)\b/i,
  },
  {
    id: "frost-free",
    tr: { term: "Donsuz dönem", text: "Tipik bir yılda son ilkbahar donu ile ilk sonbahar donu arasındaki günler. Dona hassas ürünler bu süreye sığmalıdır." },
    term: "Frost-free season",
    text: "The days between the last spring frost and the first autumn frost in a typical year. Frost-sensitive crops must fit inside it.",
    match: /\bfrost-free season\b/i,
  },
  {
    id: "fallow",
    tr: { term: "Nadas", text: "Genellikle bir sonraki ürün için su biriktirmek amacıyla ürün ekilmeyen yıl. Toprak aylarca çıplak kalır, daha çok aşınır ve toprağa azot ekleyen bir şey olmaz." },
    term: "Fallow (nadas)",
    text: "A year with no crop, usually to save water for the next one. The soil is bare for months, so it erodes more and nothing adds nitrogen.",
    match: /\bfallow\b/i,
  },
  {
    id: "legume",
    tr: { term: "Baklagil", text: "Nohut, mercimek, fiğ ve yonca gibi ürünler. Köklerindeki bakteriler havadaki azotu bağlar, böylece sonraki ürün için toprakta azot bırakırlar." },
    term: "Legume (baklagil)",
    text: "Crops such as chickpea, lentil, vetch and alfalfa. Bacteria on their roots take nitrogen from the air, so they leave nitrogen in the soil for the next crop.",
    match: /\blegumes?\b/i,
  },
  {
    id: "bare-soil",
    tr: { term: "Çıplak toprak ve erozyon", text: "Toprağın hiçbir ürünle örtülü olmadığı aylar. Çıplak toprağa düşen yağmur üst toprağı taşır; eğimli arazide ve şiddetli yağışta daha çok." },
    term: "Bare soil and erosion",
    text: "Months when no crop covers the ground. Rain falling on bare soil washes topsoil away, more on slopes and in heavy storms.",
    match: /\bbare soil\b/i,
  },
  {
    id: "return-interval",
    tr: { term: "Ürünler arasındaki yıllar", text: "Bazı ürünler toprakta hastalık, zararlı ya da asalak ot bırakır (örneğin ayçiçeğinden sonra canavar otu). Aynı ürünü yeniden ekmeden önce birkaç yıl beklemek bunların azalmasını sağlar." },
    term: "Years between crops",
    text: "Some crops leave diseases, pests or parasitic weeds in the soil (for example broomrape after sunflower). Waiting several years before growing the same crop again lets them die out.",
    match: /\byears between crops\b/i,
  },
  {
    id: "confidence",
    tr: { term: "Güven düzeyi", text: "Bir sonuca ne kadar güvenilebileceği. Ürün tablosu yerel bir uzman tarafından kontrol edilmedikçe asla yüksek olmaz; veri eksikse, ekim nöbeti başka bir bölgedense ya da FieldShift kendisi oluşturduysa düşüktür." },
    term: "Confidence",
    text: "How much to trust a result. It is never high while the crop table is not checked by a local expert; it is low when data is missing, the rotation comes from another region, or FieldShift built it itself.",
    match: /\bconfidence\b/i,
  },
  {
    id: "what-if",
    tr: { term: "Senaryo", text: "Seçeneklerin nasıl dayandığını görmek için yağış ya da sıcaklığın bilerek değiştirilmesi. Hava tahmini değildir." },
    term: "What-if scenario",
    text: "Rainfall or temperature changed on purpose to see how the options would hold up. It is not a forecast.",
    match: /\bwhat-if\b/i,
  },
];

const byId = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));
export const glossaryEntry = (id) => byId[id];

/**
 * Split text into plain strings and glossary hits: ["in a ", {id, text: "dry year"}, ", rain ..."].
 * Each term is marked once per text (its first match).
 */
export function splitGlossary(text) {
  let parts = [String(text ?? "")];
  for (const g of GLOSSARY) {
    const out = [];
    let done = false;
    for (const part of parts) {
      if (done || typeof part !== "string") {
        out.push(part);
        continue;
      }
      const m = part.match(g.match);
      if (!m) {
        out.push(part);
        continue;
      }
      out.push(part.slice(0, m.index), { id: g.id, text: m[0] }, part.slice(m.index + m[0].length));
      done = true;
    }
    parts = out;
  }
  return parts.filter((p) => p !== "");
}
