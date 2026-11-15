// Data sources and credits, at the bottom of every page. Licenses that ask for
// attribution (Open-Meteo CC BY 4.0, FAOSTAT CC BY 4.0, Esri imagery) are named
// here with links; the full list with access dates is kaynakca.md in the repo.

import { useLang } from "../../i18n/LangContext.jsx";

const REPO = "https://github.com/A795da/Farmer-nasa-spaceps";

// [name (with link), what it gives in en, in tr, extra citation or license]
const NASA = [
  ["NASA POWER", "https://power.larc.nasa.gov/", "past weather, frost, heat and soil wetness (2005-2024)", "geçmiş hava, don, sıcak ve toprak nemi (2005-2024)",
    "These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program."],
  ["MODIS MOD13Q1 NDVI, ORNL DAAC", "https://modis.ornl.gov/", "plant greenness through the year", "yıl boyunca bitki yeşilliği", null],
  ["Harmonized World Soil Database v1.2 (regridded), ORNL DAAC", "https://doi.org/10.3334/ORNLDAAC/1247", "topsoil clay and sand", "üst toprak kil ve kum oranı",
    "Wieder, Boehnert, Bonan & Langseth 2014"],
  ["GRACE / GRACE-FO JPL Mascon RL06.3 v04 CRI, NASA JPL", "https://doi.org/10.5067/TEMSC-3JC634", "trend of water stored underground and on land", "yer altı ve yüzeyde depolanan suyun eğilimi",
    "Wiese, Landerer & Watkins 2016; Watkins et al. 2015"],
  ["SRTM (NASA), via OpenTopoData", "https://www.opentopodata.org/", "field slope", "tarla eğimi", null],
  ["NASA GIBS / EOSDIS: VIIRS NDVI, SMAP L4 soil moisture, VIIRS land temperature, MODIS true colour", "https://nasa-gibs.github.io/gibs-api-docs/",
    "live satellite map in Climate & trends (display only)", "İklim ve eğilimler sayfasındaki canlı uydu haritası (yalnızca gösterim)", null],
];

const OTHER = [
  ["Open-Meteo", "https://open-meteo.com/", "7-day and hourly weather forecast", "7 günlük ve saatlik hava tahmini", "Weather data by Open-Meteo.com (CC BY 4.0)"],
  ["Esri World Imagery", "https://www.esri.com/", "satellite map", "uydu haritası", "Imagery © Esri, Maxar, Earthstar Geographics"],
  ["TÜİK, Bitkisel Üretim İstatistikleri (MEDAS)", "https://biruni.tuik.gov.tr/medas/", "province yields and planted areas", "il verimleri ve ekim alanları", "Kaynak: TÜİK"],
  ["TAGEM-DSİ 2017, Türkiye'de Sulanan Bitkilerin Bitki Su Tüketimleri", null, "official sowing calendars by climate zone", "iklim bölgelerine göre resmi ekim takvimleri", null],
  ["FAO-56 (Allen et al. 1998)", "https://www.fao.org/4/x0490e/x0490e0b.htm", "crop water use", "bitki su tüketimi", null],
  ["FAO EcoCrop", "https://gaez.fao.org/pages/ecocrop", "crop temperature, rain and soil pH limits", "bitkilerin sıcaklık, yağış ve toprak pH sınırları", null],
  ["FAOSTAT", "https://www.fao.org/faostat/", "Türkiye average yields", "Türkiye ortalama verimleri", "© FAO, CC BY 4.0"],
  ["Ludemann et al. 2023", "https://doi.org/10.5061/dryad.n2z34tn0x", "nutrients removed at harvest", "hasatla kaldırılan besin", "CC0"],
  ["Herridge, Peoples & Boddey 2008", "https://doi.org/10.1007/s11104-008-9668-3", "nitrogen fixed by legumes", "baklagillerin bağladığı azot", null],
  ["FAO AquaCrop crop parameters (AquaCrop-OSPy)", "https://github.com/aquacropos/aquacrop", "heat units crops need", "bitkilerin ihtiyaç duyduğu sıcaklık toplamı", null],
  ["Tarım ve Orman Bakanlığı, Tebliğ 2024/39", null, "support payment rules", "destekleme kuralları", null],
];

function Item([name, href, en, tr, note], lang) {
  return (
    <li key={name}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
      ) : (
        name
      )}
      <span className="muted"> · {lang === "tr" ? tr : en}</span>
      {note && <span className="credit-note"> · {note}</span>}
    </li>
  );
}

export default function Credits() {
  const { lang, t } = useLang();
  return (
    <footer className="credits" aria-labelledby="credits-h">
      <h2 id="credits-h">{t("credits_h")}</h2>
      <div className="credits-cols">
        <section>
          <h3>{t("credits_nasa")}</h3>
          <ul>{NASA.map((x) => Item(x, lang))}</ul>
        </section>
        <section>
          <h3>{t("credits_other")}</h3>
          <ul>{OTHER.map((x) => Item(x, lang))}</ul>
        </section>
      </div>
      <p className="note">
        {t("credits_rules")} {t("credits_ai")}{" "}
        <a href={`${REPO}/blob/main/kaynakca.md`} target="_blank" rel="noopener noreferrer">
          {t("credits_full")}
        </a>
      </p>
    </footer>
  );
}
