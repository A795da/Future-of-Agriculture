<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="web/public/brand/logo-paper.png">
  <img src="web/public/brand/logo-ink.png" alt="Geleceğin Tarımı" height="110">
</picture>

*Crop rotation decisions for Turkish farmers, built on NASA Earth data.*

![React](https://img.shields.io/badge/React-18-20232a?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20modules-F7DF1E?logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-satellite%20map-199900?logo=leaflet&logoColor=white)
![Chart.js](https://img.shields.io/badge/Chart.js-4-FF6384?logo=chartdotjs&logoColor=white)

![Python](https://img.shields.io/badge/Python-data%20prep-3776AB?logo=python&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-scripts%20%2B%20tests-339933?logo=nodedotjs&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-AI%20wording-8E75B2?logo=googlegemini&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-AI%20wording-D97757?logo=anthropic&logoColor=white)
![Rule engine](https://img.shields.io/badge/Rule%20engine-auditable-555555?logo=checkmarx&logoColor=white)

![NASA](https://img.shields.io/badge/NASA-POWER%20%C2%B7%20GRACE-0B3D91?logo=nasa&logoColor=white)
![i18n](https://img.shields.io/badge/i18n-TR%20%7C%20EN-c62828?logo=googletranslate&logoColor=white)
![status](https://img.shields.io/badge/status-hackathon%20demo-e0b43a?logo=github&logoColor=black)
![NASA Space Apps](https://img.shields.io/badge/NASA%20Space%20Apps-2026-0B3D91?logo=nasa&logoColor=white)

</div>

Geleceğin Tarımı is a web app for farmers in Türkiye. You mark your field on a satellite map, say what you grow and what matters to you (saving water, soil health, income, simplicity), and Geleceğin Tarımı:

- compares your current rotation with two alternatives, with the evidence, tradeoffs, risks and what it does not know;
- tells you whether a crop you are considering would work on your field ("Would this crop work here?");
- warns about frost, heat, heavy rain and dry weeks in the next 7 days for the crop in your field now, with an hourly view and good spraying hours;
- shows how your local climate has behaved over the last 20 years and how it has shifted recently.

It supports the farmer's judgment; it does not replace it. Every result says where its numbers come from, how confident it is, and what a local agronomist should check.

Built for **NASA Space Apps Challenge 2026**, challenge *"Field Shift: Adapting Farms with NASA Data"* (14-15 November 2026).

---

## What makes Geleceğin Tarımı different

**We tested the model against real farming, and fixed what didn't hold up.**
- **Official statistics overrule the model.** Our climate checks first ruled out 130 of the 537 rain-fed crop-and-province combinations that TÜİK statistics show farmers actually growing. Now, where TÜİK reports a crop on at least 1,000 ha in a province, a failed water or warmth check becomes a warning instead of a removal. That brought false removals down to 101, and most of those left are one known data mismatch: TÜİK counts winter and spring wheat together.
- **Limits are calibrated on the places that grow the crop.** A 35 °C heat limit flagged Edirne, Türkiye's top rice province, in 18 of 20 years, because NASA POWER gives the afternoon maximum while rice flowers in the cooler morning. We moved to FAO AquaCrop's 40 °C pollination-failure value. A 30 °C limit flagged Konya, where most Turkish carrots grow, in 20 of 20 years, so we raised it.
- **We caught a hidden groundwater decline.** NASA GRACE satellite data shows Çukurova (Adana) losing about 2 cm of stored water a year. A coastal scale factor in the dataset (−0.06 for Adana's cell) had turned that into a small gain. We replace such factors with the inland median, so the warning reaches irrigated farms where it matters.

**AI writes, it never decides.** A rule engine anyone can audit picks crops, scores and verdicts, and every rule names its source. AI (Gemini or Claude) only rewords the result into plain English or Turkish, and any number in its text that is not in the data is rejected. It cannot make up a yield, a date or a risk.

**Tradeoffs, not one answer.** The farmer's current rotation always sits next to two alternatives, each showing what it gains and what it risks on water, climate, soil, erosion, pests, income and simplicity, plus how its score holds up at +2 °C and with 10% less rain.

**Official Turkish calendars, not one date for the whole country.** Sowing dates and growth stages come from the Ministry's TAGEM-DSİ guide for 29 climate zones (259 stations); winter crops follow thermal time, so wheat flowers in April in Şanlıurfa and late May in Konya.

**Water in the farmer's units.** "Carrot needs about 488 mm of irrigation: 488 m³ per dekar, 4,880 m³ per hectare, mostly in July and August; rain covers about 25%." A rain-fed farmer considering a thirsty crop is told how much water it would take, not just "needs irrigation". For flooded rice we add the soaking and seepage losses the official guide leaves out (about 16,000-22,000 m³ per hectare).

**Climate change, measured honestly.** For every province we compare 2020-24 with 2005-19 on eight measures and test whether each change is real or noise. 25 provinces are clearly warmer, none cooler (national +0.7 °C). One tap applies the measured change to the what-if sliders. Climate scenarios re-rank options; they never silently delete them.

**Honest about uncertainty.** Every evidence line names its source and whether it is a NASA observation, a NASA reanalysis, a model estimate, official statistics or a compiled rule. Every result carries a confidence level and a list of what we don't know, and every crop value stays marked unverified until an agronomist checks it.

**Built for Turkish farmers.** Fully bilingual, Turkish crop names understood ("nohut", "biber", "taze fasulye"), dekar and dönüm units, alerts that say what to do but never give fertilizer or spray doses, and it works without an API key: the NASA climate data for all 81 provinces ships with the app (only the weather forecast and drawn-field details need a connection).

---

## Contents

- [What makes Geleceğin Tarımı different](#what-makes-geleceğin-tarımı-different)
- [What it does](#what-it-does)
- [How decisions are made](#how-decisions-are-made)
- [Data](#data)
- [Run it locally](#run-it-locally)
- [Tests and data checks](#tests-and-data-checks)
- [Deploy](#deploy)
- [Project structure](#project-structure)
- [Rebuilding the data files](#rebuilding-the-data-files)
- [AI use](#ai-use)
- [Limitations](#limitations)
- [Credits](#credits)

---

## What it does

The app works for any point in Türkiye's 81 provinces, in **English and Turkish** (one switch in the header changes the interface and the AI text).

| Page | What the farmer gets |
|---|---|
| **Overview** | The field at a glance: hot days (35 °C+), yearly rain, the water-storage trend (NASA GRACE), the best rotation for your priorities, and a season plan of when to sow and harvest. |
| **Compare rotations** | The current rotation plus two alternatives, each scored 0-100 with bars for water, climate, soil, erosion, pests, income and simplicity. Each card lists evidence lines with their source, risks, information gaps, a confidence level, and how the score holds up at +2 °C and with 10% less rain. What-if sliders for rain (−30 to +20%) and temperature (0 to +3 °C), and one tap applies the province's measured 2020-24 climate shift. |
| **Crop check** | Type a crop in Turkish or English ("nohut", "biber", "sunflower"). A rule-based verdict: *Reasonable*, *Possible with care* or *Not reasonable*, with every reason marked as a blocker, caution or information line. Includes how much irrigation water the crop needs (mm, m³ per dekar and per hectare, share covered by rain, and the months that need most of it), rotation rules, frost and heat history, nutrients removed at harvest, whether TÜİK statistics show the crop grown in the province, and up to three better crops. |
| **Today** | A 7-day forecast with sky conditions (sunny, cloudy, rain…) against the limits of the crop in the field now. Frost, heat, heavy-rain and dry-week alerts say what to do (never fertilizer or spray doses) and how unusual the forecast is compared with 20 years of NASA POWER. Tap a day for an hour-by-hour strip (temperature, rain, wind) and good spray hours. |
| **Climate & trends** | Six NASA POWER panels: was this year unusual, when frost is a risk, normal year vs dry year, hot spells and hard frosts, how wet the soil is, and how the climate here has changed (2020-24 vs 2005-19, with a noise test). |
| **My field** | Draw the field (or drop a pin), set water (rain-fed or irrigated), soil type, the current rotation with optional second crops, priorities, income ratings and crops never to grow. Up to 4 field parts, each with its own rotation, water and soil. |

**42 crops**: cereals, pulses, oilseeds, industrial crops, forages, rice (flooded paddy) and 9 vegetables (pepper, cucumber, eggplant, summer squash, green bean, white cabbage, carrot, garlic, lettuce).

---

## How decisions are made

**Rules pick and score the crops. AI never does.** The engine is plain JavaScript in `web/src/scoring/`; every rule and threshold is a named constant with its source.

1. **Hard filters** remove crops that cannot work on this field: winter colder than the crop survives, too short a frost-free season, too little warmth (FAO AquaCrop heat units or an EcoCrop warmth check), heat at flowering, soil pH out of range (when known), a crop that needs irrigation on a rain-fed field, a dry year with far too little water, and flooded rice outside provinces with an existing paddy area.
   - The official TAGEM-DSİ calendar overrides the generic checks: if the guide lists a crop for the climate zone, it is not removed on heat units or frost-free days.
   - **Observed farming beats the model:** where TÜİK statistics show a crop grown in the province on at least 1,000 ha in 3 of the last 5 years, a failed water or warmth check becomes a risk instead of a removal.
2. **Seven scores** per rotation (0-100): water, climate, soil, erosion, pests, income, simplicity. The farmer's four priorities set the weights; climate and pests have fixed weights.
3. **Rotation rules** from published sources adjust the score: return intervals (sunflower 4 years for broomrape, watermelon 5 for Fusarium wilt, chickpea 3 for Ascochyta, …), no cereal after cereal, no crop after another of its family where diseases are shared, legume before cereal (+), and the Ministry's support rule (the same crop at most twice in a row).
4. **Water balance:** crop water use = FAO-56 crop coefficient × reference evapotranspiration (Hargreaves, from NASA POWER), against effective rain and the soil water stored at sowing. Rain-fed fields are judged in a dry year (25th percentile of 20 years); irrigated fields get the irrigation need in a normal year. Flooded rice adds soaking, the water layer and seepage (FAO Training Manual 3).
5. **Every result carries** structured reasons (type, evidence, source, kind of data, effect), risks, information gaps and a confidence level, checked by a validator (`web/src/scoring/contract.js`).

Climate change is shown as **measured shifts and what-if scenarios**, never as removals: hard filters always use today's climate; scenarios only re-rank.

---

## Data

Every data source, with access details, licenses and dates, is listed in **[kaynakca.md](kaynakca.md)**. Every evidence line in the app names its source and whether it is a NASA observation, a NASA reanalysis, a model estimate, official statistics or a compiled rule.

### NASA data

| Dataset | What it drives |
|---|---|
| **NASA POWER** (daily, 2005-2024, all 81 provinces; live API for drawn fields) | Temperature, rain, dry years, frost dates, heat and frost at the sensitive stage, winter lows, heavy-rain days, reference evapotranspiration, soil wetness, the climate-shift panel, and how unusual a forecast is |
| **MODIS MOD13Q1 NDVI** via ORNL DAAC | Months when the field is bare or low-green |
| **SRTM** elevation via OpenTopoData | Field slope for erosion risk |
| **Harmonized World Soil Database v1.2** (regridded, ORNL DAAC) | Topsoil clay and sand, used for rice seepage |
| **GRACE / GRACE-FO** JPL mascons (2002-2026) | Trend of water stored underground and on land; warns irrigated fields where the basin is losing water |

### Other data (labelled "not NASA" in the app)

| Source | What it drives |
|---|---|
| **Open-Meteo** | 7-day and hourly weather forecast (Today page) |
| **TAGEM-DSİ 2017**, *Türkiye'de Sulanan Bitkilerin Bitki Su Tüketimleri* | Official sowing dates and growth-stage lengths for 29 climate zones |
| **TÜİK** province crop statistics (MEDAS, 2020-2024) | Local yields for 25 crops, "grown here" evidence, the observed-farming override, the rice paddy-area rule |
| **FAO-56**, **FAO EcoCrop**, **FAO AquaCrop** parameters | Crop water use, temperature/rain/pH limits, heat-unit needs |
| **FAOSTAT**, **Ludemann et al. 2023**, **Herridge et al. 2008** | Türkiye average yields, nutrients removed at harvest, nitrogen fixed by legumes |
| Extension services and papers (named on each rule) | Rotation rules |
| **Tarım ve Orman Bakanlığı Tebliğ 2024/39** | Support payment rule |
| **Esri World Imagery** | Satellite map |

### Resolution

NASA POWER describes an area tens of kilometres wide, GRACE about 300 km, HWSD about 5 km, MODIS NDVI 250 m and SRTM 30 m. Nearby fields share climate values; the app says so in its information gaps.

---

## Run it locally

Needs **Node.js 18 or newer** (developed on Node 24).

```bash
npm --prefix web install
```

```bash
npm --prefix web run dev
```

Open the address Vite prints (usually http://localhost:5173). The app works without any key: province data is bundled in `web/public/data/`, and the AI explanations fall back to template text (the 70 texts for the demo provinces are pre-written in `web/public/data/explain_cache.json`).

**Optional, AI explanations:** copy `web/.env.example` to `web/.env.local`, put a Google Gemini key in `GEMINI_API_KEY` (free tier from Google AI Studio), and restart the dev server. `web/.env.local` is gitignored; keys are read only on the server and never reach the browser.

Production build:

```bash
npm --prefix web run build
```

The output is in `web/dist/`.

---

## Tests and data checks

```bash
node --test tests/*.test.mjs
```

108 unit tests in 15 files: scoring, crop check, Today alerts, hourly forecast and spray hours, irrigation amounts, AI layer (with fake providers), Turkish texts, added crops and vegetables, TÜİK, rice, climate, field parts and saved fields.

```bash
node scripts/validate_data.mjs
```

Checks the data files for internal consistency (42 crops, 32 rotations, 81 provinces in 7 regions, the reasons contract).

---

## Deploy

The two server functions in `web/api/` (`explain.js` for AI text, `elevation.js` for the SRTM proxy) use the Vercel function format.

On **Vercel**:

1. Import the repository and set **Root Directory** to `web`.
2. Framework preset: Vite (build `npm run build`, output `dist`). Files in `web/api/` become serverless functions automatically.
3. Environment variables: `GEMINI_API_KEY` (optional: `GEMINI_MODEL`, `AI_PROVIDER`, `ANTHROPIC_API_KEY`).
4. After deploying, check the AI explanations, field slope (elevation), the 7-day and hourly forecast, the crop check, and the Turkish switch on the public URL.

Netlify would need the two functions rewritten in its own format.

---

## Project structure

```
web/                      the app (Vite + React)
  api/                    serverless functions: explain.js (AI text), elevation.js (SRTM proxy)
  server/providers/       Gemini and Claude clients (server only)
  public/data/            bundled data: crops, rotations, rules, calendars, TÜİK yields,
                          nutrients, soil, water storage, climate shift, AI text cache,
                          cache/<province>/ (NASA POWER features, NDVI, forecast snapshots)
  src/
    App.jsx               layout, tabs, state
    data/                 loaders, NASA POWER and Open-Meteo clients, saved fields
    features/             climate features from POWER, terrain slope, NDVI, scenarios, climate shift
    scoring/              the decision engine: filters, scores, rules, crop check, Today, water, spray hours
    explain/              AI payload, number check, templates, glossary
    i18n/                 English and Turkish strings and sentence templates
    field/                satellite map and field drawing
    ui/                   pages and components
scripts/                  data builders (see below) and the AI cache builder
data/sources/             source tables and mapping files (raw PDFs and NASA files not committed)
tests/                    node:test unit tests
kaynakca.md               full source list (bibliography)
```

---

## Rebuilding the data files

The app reads only `web/public/data/`. These scripts rebuild those files from the sources in `data/sources/` (each reads a mapping CSV there):

| Script | Builds |
|---|---|
| `scripts/fetch_power_all.mjs` | NASA POWER daily history for 81 provinces (into `data/power/`, not committed) and the per-province feature files |
| `scripts/import_ecocrop.mjs` | Temperature, rain and pH limits in `crops.json` |
| `scripts/build_tagem.mjs` | `tagem_calendar.json` and each province's climate zone |
| `scripts/build_nutrients.mjs` | `nutrients.json` (FAOSTAT yields, Ludemann nutrients, Herridge fixation) |
| `scripts/build_rotation_rules.mjs` | `rotation_rules.json` |
| `scripts/build_heat_units.mjs` | AquaCrop heat units in `crops.json` |
| `scripts/tuik_medas_to_csv.py`, `scripts/build_tuik_yields.mjs` | `tuik_yields.json` from the TÜİK exports |
| `scripts/build_soil_texture.py` | `soil_texture.json` (needs the HWSD NetCDF files) |
| `scripts/build_water_storage.py` | `water_storage.json` (needs the GRACE NetCDF file) |
| `scripts/build_climate_shift.mjs` | `climate_shift.json` |
| `scripts/fetch_forecast_snapshot.mjs` | Saved forecasts used when Open-Meteo is unreachable |
| `scripts/build_explain_cache.mjs` | Pre-written AI texts for the demo provinces (needs a Gemini key; re-run after changes that alter results) |

Python scripts need `xlrd` (TÜİK) or `netCDF4` and `numpy` (HWSD, GRACE). NASA Earthdata downloads need a free Earthdata login.

---

## AI use

- **In the app:** Google Gemini (default) or Anthropic Claude rewords results the engine has already computed into plain English or Turkish, on request ("Explain in plain words"). It never chooses crops, scores, verdicts or alert colours. It receives only the computed result (no coordinates, place names or farmer details). Every number in its text must appear in that result, checked on the server and in the browser; otherwise the template sentence is shown. AI text is labelled as such.
- **In development:** the team used AI coding assistants to write and review code and documentation. Data values, rules and sources are recorded in `kaynakca.md`; crop values compiled this way are marked `verified: false`.

---

## Limitations

- **Crop values need an expert check.** Frost and heat limits, sensitive stages and some rotation rules are compiled by the team from FAO and published sources; every crop is marked `verified: false` until an agronomy-aware reviewer checks it.
- **Coarse climate data.** NASA POWER cells are tens of kilometres wide; a valley or slope can differ from the cell.
- **TÜİK is province-wide** and covers field crops only so far: vegetables, alfalfa and sainfoin use national FAOSTAT yields and have no "grown here" evidence.
- **Water amounts are net crop needs.** The irrigation amounts are what the crop uses beyond rain and stored soil water; what a farmer pumps is higher and depends on the method (drip, sprinkler, furrow), which the app does not ask for.
- **Forecasts are not NASA data.** The 7-day and hourly forecasts come from Open-Meteo, and are labelled so. Heat waves two months ahead cannot be forecast as events; seasonal outlooks are not included.
- **Turkish:** engine evidence lines, risks and gaps stay in English in Turkish mode (summaries, alerts, water lines, the climate pages and AI texts are Turkish). Turkish texts deserve a native-speaker read.
- **Not modelled:** greenhouses, planting date per crop (the Today stage is estimated from the local calendar), second crops sown straight after harvest in the crop check, cold sterility in rice, market prices (income uses the farmer's own ratings), local pests and diseases.
- **What-if warming** shifts the past 20 years uniformly with today's sowing dates and varieties; the recent climate shift compares 5 with 15 years.

---

## Credits

Data from NASA POWER (*"These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program."*), ORNL DAAC (MODIS NDVI; HWSD v1.2, Wieder et al. 2014), NASA JPL (GRACE/GRACE-FO mascons, Wiese et al. 2016; Watkins et al. 2015) and SRTM via OpenTopoData. Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0). Satellite imagery © Esri, Maxar, Earthstar Geographics. Crop statistics: TÜİK. Calendars: TAGEM-DSİ 2017. FAO-56, FAO EcoCrop, FAOSTAT (© FAO, CC BY 4.0), Ludemann et al. 2023 (CC0), Herridge, Peoples & Boddey 2008, FAO AquaCrop parameters via AquaCrop-OSPy. Map library: Leaflet. The same credits appear at the bottom of every page of the app; the full list is in [kaynakca.md](kaynakca.md).

Geleceğin Tarımı is a decision-support prototype. Check any change to your farming with a local agronomist or extension officer.
