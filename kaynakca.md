# Kaynakça (data sources)

Every dataset, API, table or compiled value used by Geleceğin Tarımı is listed here. **Add an entry in the same change whenever new data is added.**

Status values: **used** (in the app or scoring now) · **planned** (not yet integrated) · **compiled, unverified** (values written by the team without a line-by-line source check).
Kind values match the labels shown in the app: NASA observation · NASA reanalysis · NASA model estimate · model estimate · farmer input · compiled rule.

---

## NASA data

### NASA POWER daily point API (AG community)
- **Used for:** monthly temperature and rainfall, dry-year rainfall, frost dates and frost-free season, winter lows, heavy-rain days, 10-day temperature extremes, root-zone soil wetness; 12-month chart in the app.
- **Files:** `web/src/data/power.js`, `web/src/features/climate.js`, `scripts/fetch_power_all.mjs`. Raw daily history for all 81 provinces in `data/power/<id>.json` (not committed; re-fetchable); computed features per province in `web/public/data/cache/<id>/features.json` (read by the app, works offline).
- **Parameters:** T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, ALLSKY_SFC_SW_DWN, WS2M, GWETTOP, GWETROOT.
- **Access:** live API `https://power.larc.nasa.gov/api/temporal/daily/point`; history 2005-01-01 to 2024-12-31.
- **Kind:** NASA reanalysis (MERRA-2 based, with observation corrections); GWETTOP/GWETROOT = NASA model estimate; solar radiation from satellites.
- **Resolution:** about 0.5° × 0.625° (tens of km); nearby fields share values.
- **License / terms:** NASA open data; cite NASA POWER as the source. The app's credits section carries POWER's acknowledgement sentence ("These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.").
- **Accessed:** 2026-11-14. **Status:** used.

### MODIS MOD13Q1 v061 NDVI (16-day, 250 m) via ORNL DAAC MODIS Web Service
- **Used for:** monthly NDVI pattern and low-green months (evidence only; not yet in scores).
- **Files:** `scripts/fetch_ndvi.mjs`, `web/src/features/vegetation.js`; cache `web/public/data/cache/<province>/ndvi.json` (Konya, partial).
- **Access:** `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset`, band `250m_16_days_NDVI`, scale 0.0001, fill −3000. Slow (~10 s per date).
- **Kind:** NASA observation. **License:** NASA open data; cite ORNL DAAC.
- **Caveat:** NDVI is low on bare soil and on dormant winter crops alike; 250 m pixels mix neighbouring land on small fields.
- **Accessed:** 2026-11-14. **Status:** used (Konya only, download in progress).

### NASA AppEEARS point request: MODIS NDVI, VIIRS NDVI, SMAP soil moisture, MODIS land cover (planned)
- **For:** one request for all 81 province points, 2015-01-01 to 2026-11-14:
  - `MOD13Q1.061` NDVI + pixel reliability (250 m, 16-day): vegetation pattern, low-green months. NASA observation.
  - `VNP13A1.002` VIIRS NDVI + pixel reliability (500 m, 16-day): continuity for MODIS. NASA observation.
  - `SPL3SMP_E.006` SMAP enhanced L3 surface soil moisture AM/PM + quality flags (9 km, daily, from 2015-03-31): observed soil moisture for drought stress. NASA observation.
  - `MCD12Q1.061` `LC_Type1` land cover (500 m, yearly): finds points that fall on cities.
- **Files:** upload `data/appeears/fieldshift_81_provinces.csv`; step-by-step guide `data/appeears/README.md`.
- **Access:** https://appeears.earthdatacloud.nasa.gov (Earthdata login). Product and layer names checked against the AppEEARS catalog API on 2026-11-15.
- **License:** NASA open data; cite each product (LP DAAC for MODIS/VIIRS, NSIDC DAAC for SMAP) and AppEEARS.
- **Status:** planned (request to be submitted by the team).

### NASA GIBS: MODIS_Terra_NDVI_8Day tiles (tested, not used)
- Tested 2026-11-14. The layer only has data from 2025-02 onwards, and tiles are images, not numbers, so they cannot drive scoring. Possible later use: map overlay only.

### NASA GIBS (Global Imagery Browse Services) WMTS tiles: satellite map in Climate & trends
- **Used for:** the "Field signals" map (`web/src/ui/climate/SatelliteMap.jsx`), display only, never scored. Tiles are fetched live by the browser from `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/<layer>/default/<date>/GoogleMapsCompatible_Level<N>/{z}/{y}/{x}`; no key, no backend.
- **Layers (tested 2026-11-15):** `MODIS_Terra_CorrectedReflectance_TrueColor` (base, jpg); `VIIRS_NOAA21_NDVI_8Day` (vegetation vigor, 500 m); `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture` (soil wetness, 9 km); `VIIRS_NOAA21_Land_Surface_Temp_Day` (ground heat, 750 m).
- **Date:** today minus a few days (3-6, processing delay), so the map follows the latest pass. **Kind:** NASA observation (SMAP L4 is a model assimilating SMAP observations). **Status:** used.
- **License / terms:** NASA open data; cite NASA GIBS / EOSDIS (the card footer names layer, instrument and date).
- **Click-to-read:** clicking the map reads the colour of that pixel in the same GIBS tile and converts it back to a value with the GIBS colormap (`web/src/data/gibsPalettes.js`, generated from the colormap XML files above; NDVI as is, SMAP m³/m³, land temperature kelvin → °C). The band words (bare soil, sparse, moderate, dense; dry, moist, wet) are team-chosen thresholds (NDVI 0.2 / 0.4 / 0.6, soil 0.15 / 0.3 m³/m³), not NASA classes. The value is one satellite pixel, not the whole field.
- **Limits:** coarse pixels (a small field blends with neighbours; SMAP shows the whole area); clouds leave gaps; the legend colours and end values come from the official GIBS colormaps (`https://gibs.earthdata.nasa.gov/colormaps/v1.3/<palette>.xml`: MODIS_NDVI 0–1, SMAP_Analyzed_Soil_Moisture 0–0.7+ m³/m³, MODIS_Land_Surface_Temp 200–350 K = −73 to 77 °C); the gradient is sampled from those, so intermediate shades are approximate. The tiles are shown with 80% opacity over the base, so on screen they look slightly paler than the legend.

### NASA ORNL DAAC: Regridded Harmonized World Soil Database v1.2 (Wieder, Boehnert, Bonan & Langseth 2014), doi:10.3334/ORNLDAAC/1247
- **URL:** https://www.earthdata.nasa.gov/data/catalog/ornl-cloud-hwsd-1247-1; files `https://data.ornldaac.earthdata.nasa.gov/protected/global_soil/HWSD/data/T_CLAY.nc4` and `T_SAND.nc4` (NASA Earthdata login needed; the old daac.ornl.gov guide URL now redirects to the PDF guide).
- **For:** topsoil (0-30 cm) clay and sand percent (`T_CLAY.nc4`, `T_SAND.nc4`, 0.05° ≈ 5 km, nominal year 2000) → texture class (clay ≥ 40% → clay; sand ≥ 70% → sandy; else loam, the usual texture-class boundaries; mapping team-compiled) → rice seepage 4 / 6 / 8 mm a day (FAO Training Manual 3, section 4.4). The farmer's own soil type (Farm inputs: Not sure / Clay / Loam / Sandy) overrides the map. A drawn field uses its province's value.
- **Files:** raw files in `data/sources/raw/` (not committed); `scripts/build_soil_texture.py` (needs `pip install netCDF4`) samples each province point, or the nearest valid cell within 6 cells, → `web/public/data/soil_texture.json`; `withSoilTexture` in `web/src/data/loader.js`.
- **Status:** used (files downloaded by the team 2026-11-15; all 81 provinces valued: 17 clay, 59 loam, 5 sandy). **Limit:** HWSD gives one dominant soil unit per cell with typical values, so many provinces share identical numbers (21% clay / 38% sand), and the province point is usually the city, not the paddy delta: every main rice province (Edirne, Balıkesir, Çanakkale, Samsun, Sinop, Çorum) reads as loam → 6 mm/day, the same as the average. The farmer's soil choice matters more than the map for rice.

### NASA JPL GRACE and GRACE-FO Mascon RL06.3 v04 CRI (total land water storage), doi:10.5067/TEMSC-3JC634
- **URL:** https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4; file `GRCTellus.JPL.200204_202609.GLO.RL06.3M.MSCNv04CRI.nc` (44 MB, NASA Earthdata login), downloaded by the team 2026-11-15. Citation: Wiese, Landerer & Watkins 2016 (doi:10.1002/2016WR019344); Watkins et al. 2015.
- **For:** is the water source shrinking? Monthly total water storage anomaly (groundwater, soil water, lakes, snow; liquid water equivalent, cm) April 2002 to September 2026, times the CRI scale factor, at the 0.5° cell of each province point (nearest land cell for coastal points, up to 44 km). Trend from a least-squares line plus annual cycle (`scripts/build_water_storage.py` → `web/public/data/water_storage.json`; needs `pip install netCDF4 numpy`).
- **Used in the app (irrigated fields only):** an evidence line on every rotation card and in the crop check ("NASA observation"); where the trend is −1.0 cm a year or steeper (team-compiled), a risk that wells and reservoirs may become less reliable, naming water-hungry crops (> 400 mm irrigation); a caution in the crop check for crops with a high irrigation need. Never removes a crop. Steepest declines: Adana, Mersin and Osmaniye −2.1, Hatay −2.1, Gaziantep −1.7, Karaman −1.6, Şanlıurfa −1.6, Tekirdağ −1.3 cm a year; Konya −0.9; Samsun −0.4.
- **Coastal scale factors:** the CRI gain factor can be near zero or negative on coastal cells (Adana's cell: −0.06), which turned Çukurova's −1.94 cm/yr mascon decline into +0.1. Where a cell's factor is outside 0.5-2, the median factor of that mascon's inland cells is used (7 provinces: Adana, Mersin, İstanbul, Samsun, Tekirdağ, Zonguldak, Kilis); each province records which was used.
- **Limits:** native resolution 3° mascons (~300 km), so neighbouring provinces share values and it describes the basin, not a well; it measures total storage, not a particular river or aquifer; Muğla reads +0.9 cm a year (unexplained, possibly reservoir filling or the coast). Rain-fed fields get no GRACE line (and the cached AI texts, all rain-fed, are unchanged).

### SRTM elevation (NASA) via OpenTopoData
- **For:** field slope (plane fitted to elevation samples inside the field) for erosion risk.
- **Files:** `web/src/features/terrain.js` (plane fit), `web/src/data/loader.js` (fetch), `web/api/elevation.js` (serverless proxy), proxy rule in `web/vite.config.js`.
- **Access:** `https://api.opentopodata.org/v1/srtm30m` (public API: max 100 points per request, 1 request/s, 1000/day). The API sends no CORS headers, so the app calls its own `/api/elevation` endpoint, which forwards the request.
- **Kind:** NASA observation (30 m). **License:** SRTM is public domain; OpenTopoData public API terms apply.
- **Accessed:** 2026-11-15. **Status:** used (slope for drawn fields and pins; feeds erosion score).

---

## Credits shown in the app

`web/src/ui/layout/Credits.jsx` (bottom of every page, English and Turkish, added 2026-11-15) names every data source the app uses with a link: NASA POWER (with its acknowledgement sentence), MODIS NDVI (ORNL DAAC), HWSD (ORNL DAAC, Wieder et al. 2014), GRACE/GRACE-FO (JPL, Wiese et al. 2016; Watkins et al. 2015), SRTM via OpenTopoData; Open-Meteo (CC BY 4.0), Esri imagery, TÜİK ("Kaynak: TÜİK"), TAGEM-DSİ 2017, FAO-56, FAO EcoCrop, FAOSTAT (CC BY 4.0), Ludemann et al. 2023 (CC0), Herridge et al. 2008, FAO AquaCrop parameters (AquaCrop-OSPy), Tebliğ 2024/39; plus the AI-use note and a link to this file. Not listed there: SoilGrids (not called by the app) and AppEEARS/GIBS (not used).

## Non-NASA data (labelled as such in the app)

### Open-Meteo forecast
- **For:** Today tab: 7-day daily max/min temperature, rain, rain probability, FAO-56 reference evapotranspiration and the WMO weather code (shown as Sunny / Cloudy / Rain… per day; older snapshots without it fall back to rain amount), plus an hourly strip for the day the farmer taps (temperature, rain, wind, sky; live only, snapshots have no hourly values), compared with the crop's limits. **Not NASA**; labelled "Open-Meteo · not NASA data" in the app.
- **Files:** `web/src/data/forecast.js` (live call, falls back to the saved snapshot), `web/src/scoring/today.js` (alerts), `scripts/fetch_forecast_snapshot.mjs`; demo snapshots `web/public/data/cache/<id>/forecast_snapshot.json` for Konya, Edirne, Adana, Şanlıurfa, Erzurum (saved 2026-11-15; shown with their save date, never as current).
- **Access:** `https://api.open-meteo.com/v1/forecast` (`daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,weather_code`; `hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,is_day`, `timezone=Europe/Istanbul`, `forecast_days=7`). Browser calls allowed (CORS).
- **Kind:** model estimate (weather forecast models, a few km). **License:** free for non-commercial use; data CC BY 4.0, attribution "Weather data by Open-Meteo.com", shown with a link under the Today forecast and in the credits section on every page (added 2026-11-15).
- **Accessed:** 2026-11-15. **Status:** used.

### Spray hours (Today tab hourly strip)
- **For:** "good spray hours" for the picked day: daylight hours with wind 3–15 km/h at 10 m and no rain (≥0.1 mm or ≥40% chance) that hour or the next 3. No products or doses; the note tells the farmer the product label comes first.
- **Files:** `web/src/scoring/spray.js`, `web/src/ui/today/HourlyStrip.jsx`; tests `tests/hourly.test.mjs`.
- **Source:** Agriculture Victoria, "Managing spray drift" — wind 3–15 km/h blowing away from sensitive areas as a pre-spray check; https://agriculture.vic.gov.au/farm-management/chemicals/spraying-agricultural-chemicals/managing-spray-drift. Queensland Government, "Minimising the impacts of spray drift" gives the same 3–15 km/h range; https://www.business.qld.gov.au/industries/farms-fishing-forestry/agriculture/sustainable/chemical/spray-drift/minimise. The 3-hour dry period and the rain thresholds are **our own cautious choice**, not from these sources (product labels give their own rain-free times).
- **Kind:** rule of thumb applied to a model forecast. **Accessed:** 2026-11-15. **Status:** used.

### Fertilizer timing before heavy rain (Today tab reminder)
- **For:** the reminder "do not spread nitrogen fertilizer in the 2-3 days before heavy rain" (no doses). **Files:** `web/src/scoring/today.js`.
- **Sources:** University of Kentucky Grain Crops, "After a big rain: N loss, erosion and other things" (surface-applied N can be eroded off the field by heavy rain), https://graincrops.mgcafe.uky.edu/articles/after-big-rain-n-loss-erosion-and-other-things ; UNL CropWatch, "With heavy rains, how likely is N leaching?" (urea needs 2-4 days to hydrolyze; leaching rain before that can move it), https://cropwatch.unl.edu/heavy-rains-how-likely-n-leaching-unl-cropwatch-may-31-2013 .
- **Kind:** compiled rule. **Accessed:** 2026-11-15. **Status:** used. US extension sources; the 20 mm heavy-rain threshold is the app's own (same as the heavy-rain days feature) and needs a local check.

### Today tab thresholds (compiled, unverified)
- Yellow within 2 °C of a crop's frost-damage limit, red below it; winter crops in Oct-Feb use winter hardiness (3 °C snow margin); heat watch 2 °C below the flowering heat limit; heavy rain ≥ 20 mm/day (≥ 40 red); dry week < 5 mm rain while the crop uses ≥ 15 mm (FAO-56 kc × forecast ET0). Crop limits come from `crops.json`. Erosion, sowing-on-wet-soil and harvest-before-rain notes are team rules. **Files:** `web/src/scoring/today.js` (named constants). **Status:** compiled, unverified.

### TÜİK crop production bulletin 2025 (national production, tonnes)
- **For:** choosing which crops to add (national 2025 production: watermelon 3.41 Mt, dry onion 2.89 Mt, melon 1.43 Mt, rice 1.00 Mt, groundnut 0.19 Mt, tobacco 0.11 Mt, sesame 0.015 Mt; poppy, anise and cumin under 0.01 Mt). Not used in scores.
- **Files:** `data/sources/tuik/tuik_2025_bulletin_t1_field_crops.xls` (cereals and other field crops), `tuik_2025_bulletin_t2_vegetables.xls`; 2024 final and 2025 provisional values. No area or province data.
- **Source:** Türkiye İstatistik Kurumu (TÜİK), Bitkisel Üretim İstatistikleri 2025 bulletin tables, provided by the team 2026-11-15.
- **Status:** used for crop selection only.

### TÜİK MEDAS province crop statistics (rain-fed / irrigated, first / second crop)
- **For:** local yields per province and water regime in the nutrient numbers (rotation cards and crop check), replacing the national FAOSTAT yield where TÜİK has a value; legume N fixation is scaled to the local yield; "grown here" evidence in the crop check (TÜİK reports the crop in the province for that water regime, with planted area for rain-fed land; or reports none → information line and a risk, the verdict does not change). Also tests the hard filters ("observed farming beats the model", 2026-11-15): where TÜİK reports the crop for that province and water regime in at least 3 of 2020-2024 and, where TÜİK gives the rain-fed planted area, on at least 1,000 ha a year, a failed dry-year water, frost-free season, warmth or heat-unit check becomes a risk instead of a removal (winter cold, soil pH and the flowering heat limit stay hard). Dry bean's crop-table entry changed to rain-fed allowed because TÜİK reports rain-fed dry bean in about 50 provinces. Country-wide check: of 537 rain-fed crop × province cases TÜİK reports, the old filters ruled out 130, the new ones 101 (67 winter cold for wheat/barley, where TÜİK does not separate spring and winter types; rain-fed dry bean, sunflower and safflower on under 1,000 ha province-wide, where the NASA check stays; 5 rain-fed soybean). Kept with a risk: rain-fed sunflower in Konya (~3,800 ha), Kırşehir (~9,500 ha) and Kahramanmaraş (~2,100 ha), safflower in Konya and Aksaray, chickpea in Şanlıurfa. Limit: TÜİK is province-wide, so the override cannot tell a wetter corner of a province from a dry field.
- **Source:** Türkiye İstatistik Kurumu, Merkezi Dağıtım Sistemi (https://biruni.tuik.gov.tr/medas/?locale=tr), Bitkisel Üretim İstatistikleri → "(Kuru / Sulu) - (1. Ekiliş / 2. Ekiliş) ürünleri". No public API; exported by the team 2026-11-15 (steps in `data/sources/tuik/README.md`).
- **Files:** raw exports `data/sources/tuik/medas_*.xls` (rain-fed planted/harvested area, yield and production for 12 crops 2020-2025; irrigated yield for the same 12; soybean and sunflower yields by water regime and first/second crop 2012-2025; oilseed and confectionery sunflower planted/harvested area, yield and production by water regime and first/second crop 2020-2025, exported 2026-11-15; `medas_tahillar_diger_2020.xls` … `_2025.xls`: the whole "Tahıllar ve diğer bitkisel ürünler" table, planted/harvested area, yield and production for every field crop, one file per year, no rain-fed / irrigated split, exported 2026-11-15); `scripts/tuik_medas_to_csv.py` → `data/sources/tuik/tuik_medas_long.csv` (83,208 values); `data/sources/tuik/tuik_crop_map.csv` (TÜİK product code → crop); `scripts/build_tuik_yields.mjs` → `web/public/data/tuik_yields.json`.
- **Tahıllar table (2026-11-15):** adds rice, maize, silage maize, sugar beet, cotton (kütlü), potato, tobacco, sorghum, rye, sesame, groundnut (in-shell), dry pea, dry faba bean and common vetch seed (each product chosen to match the nutrient table's FAOSTAT item; green-fodder rows are separate products and not used) → local yields for 25 crops. Rice counts as irrigated (all Turkish rice is flooded): 28 provinces, 13 with ≥ 1,000 ha (Edirne 47,900 ha, Samsun 20,200, Balıkesir 17,100, Çanakkale 11,000, Çorum 7,000, Çankırı, Sinop, Bursa, Tekirdağ, Kırklareli, Mersin, Diyarbakır, Kastamonu). Other crops' figures are rain-fed and irrigated together: used for nutrient numbers and "grown here" lines (labelled that way), never for the observed-farming override or the "no rain-fed X here" wording.
- **Method:** mean of 2020-2024 (2025 provisional, not used), at least 3 reported years; kg/dekar ÷ 100 = t/ha; dekar ÷ 10 = ha. Wheat = bread wheat, barley = feed barley, lentil = red lentil, sunflower = oilseed sunflower (durum, malting barley, green lentil and confectionery sunflower are separate TÜİK products, not mixed in).
- **Covered (11 crops):** wheat, barley, oats, triticale, dry bean, chickpea, lentil, canola, safflower, soybean, sunflower. Not yet exported: maize, silage maize, groundnut, sesame, cotton, potato (codes already mapped); sugar beet, tobacco, vegetables and forages are in other MEDAS tables.
- **Kind:** official statistics. **Status:** used.

### Tarım ve Orman Bakanlığı, Tebliğ No. 2024/39: *2025-2027 Yıllarında Yapılacak Bitkisel Üretime Yönelik Desteklemeler ile Diğer Bazı Tarımsal Desteklemelere Ödeme Yapılmasına Dair Tebliğ*
- **Published:** Resmî Gazete, 31.12.2024, issue 32769 (5th repeat). Text read from the alomaliye.com republication: https://www.alomaliye.com/2024/12/31/2025-2027-yillarinda-yapilacak-bitkisel-uretime-yonelik-desteklemeler-no-2024-39/
- **Article 13(1)(c):** the same crop may be sown on the same parcel at most twice in a row. Rice (çeltik), perennial crops and greenhouse or closed-environment production are exempt.
- **Article 17(2)(ı):** parcels that break the rotation rules get no basic support (temel destek: diesel and fertiliser), planned-production or production-development payments.
- **Not modelled:** Article 13(1)(ç)(4), a stricter 4-year rule for maize, potato, sugar beet, tomato and carrot on irrigated land in basins the Ministry lists as short of groundwater. The app has no list of those basins.
- **Earlier rule (2020):** the same principle, "bir parselde aynı tek yıllık bitki arka arkaya üç kez ekilirse, üçüncü üretim için … destekleme ödemeleri yapılmaz", quoted in a Yozgat İl Tarım ve Orman Müdürlüğü notice: https://yozgat.tarimorman.gov.tr/Lists/Duyuru/Attachments/313/munavebe%20duyurusu.pdf
- **Used in:** `web/src/scoring/support.js`. It adds a risk on rotation cards and a caution in Crop check when one crop would be grown a third year in a row. It is information only and never removes a crop or changes the score.
- **Product groups:** spring and winter wheat count as one product, as do spring and winter barley (team mapping).
- **Licence:** official regulation, public. Accessed 2026-11-15.

### Second-crop season fit (derived, `web/src/scoring/calendar.js` `secondCropFit`)
- **What it checks:** a spring or summer second crop must fit between the main crop's harvest and the first autumn frost. The window is the median first-frost day from NASA POWER 2005-2024, minus the second crop's sowing day (its own date if within 60 days after the harvest, else harvest + 7 days). It is compared with the second crop's season length from the crop table.
- **Official calendar wins:** where TAGEM-DSİ lists an official second-crop calendar for the zone, the crop counts as fitting.
- **Effect when it doesn't fit:** a risk, and the second crop's climate fit is scaled by window ÷ need.
- **Not checked:** autumn-sown second crops after a summer main crop.
- **Status:** team-compiled rule, unverified.

### SoilGrids (ISRIC)
- **For:** topsoil clay, organic carbon, pH (modeled). Tested 2026-11-14: **timed out** (30 s and 90 s).
- **Access:** `https://rest.isric.org/soilgrids/v2.0/properties/query`. **Kind:** model estimate. **License:** CC BY 4.0. **Status:** planned; unavailable at test time.

### AI wording providers: Google Gemini API (default) and Anthropic Claude API (not data sources)
- **For:** optional plain-language rewording (English or Turkish) of results the rule-based engine already computed: rotation cards, crop check verdicts, Today summaries. They never pick crops, scores, verdicts or colours, and add no data.
- **Files:** `web/api/explain.js` (serverless endpoint, provider choice, number check), `web/server/providers/gemini.js`, `web/server/providers/claude.js`, `web/src/explain/payload.js` (what the model sees), `web/src/explain/verify.js`, `web/src/explain/ai.js`, `web/src/ui/components/AiSummary.jsx`, `scripts/build_explain_cache.mjs`; cached demo texts in `web/public/data/explain_cache.json`; settings template `web/.env.example`.
- **Gemini:** Google Gen AI SDK `@google/genai`, model `gemini-3.5-flash-lite` by default (stable; the model list is at https://aistudio.google.com/docs/models), set with `GEMINI_MODEL`. Key `GEMINI_API_KEY` from Google AI Studio (free tier). Free-tier limits are set per project and shown in AI Studio; free-tier prompts may be used by Google to improve its products, so only the trimmed result JSON is sent.
- **Claude:** `@anthropic-ai/sdk`, model `claude-opus-5-5`, server-side refusal fallback on; key `ANTHROPIC_API_KEY`. Used when `AI_PROVIDER=claude` or when only that key is set.
- **Guardrails:** sends only the computed result JSON (no coordinates, place names or farmer identity); every number in the AI text must appear in that JSON, checked on the server and again in the browser, otherwise the template sentence stays; labelled "AI summary of the data above" in the app. Keys live in `web/.env.local` (gitignored) or the host's environment variables, never in the browser bundle.
- **Kind:** not data (text generation). **Accessed:** 2026-11-15. **Status:** integrated; Gemini key being set up by the team.

### Esri World Imagery (satellite basemap)
- **For:** map background so farmers can see field edges. **Files:** `web/src/field/FieldMap.jsx`.
- **Access:** ArcGIS tile service. **Attribution:** "Imagery © Esri, Maxar, Earthstar Geographics" (shown on the map). Check Esri terms before any production use. **Status:** used.

### FAO-56 (Allen et al. 1998, FAO Irrigation and Drainage Paper 56)
- **For:** crop coefficients (kc ini/mid/end), crop stage lengths, rooting depth (Tables 11, 12, 22); Hargreaves reference evapotranspiration (eq. 52) and extraterrestrial radiation (eq. 21).
- **Files:** `web/public/data/crops.json` (kc, stages, root depth), `web/src/features/climate.js` (equations).
- **Access:** http://www.fao.org/4/x0490e/x0490e0b.htm (Tables 11-12; some cells are images).
- **Status:** equations used; **crop values compiled, unverified** (written from general knowledge of the tables, not yet checked row by row).

### FAO EcoCrop database
- **For:** temperature, rainfall and pH ranges, killing temperatures (KTMPR = during rest, KTMP = early growth), crop cycle length.
- **Access found:** full database as CSV (2,568 species) in the OpenCLIM repository: https://github.com/openclim/ecocrop (`EcoCrop_DB.csv`, column meanings in `Ecocrop_variable_lookup.csv`). Official access now via FAO GAEZ: https://gaez.fao.org/pages/ecocrop. The GitHub copy is a third-party redistribution and the repository has no license file.
- **Local copy:** `data/sources/EcoCrop_DB.csv` (2,568 species, 1.6 MB) and `data/sources/EcoCrop_variable_lookup.csv`, downloaded 2026-11-15 from `https://raw.githubusercontent.com/openclim/ecocrop/main/`.
- **Caveat:** EcoCrop temperature limits refer to mean temperature ranges, not daily maxima.
- **Imported (2026-11-15, `scripts/import_ecocrop.mjs`, mapping in `data/sources/ecocrop_crop_map.csv`):** for all 17 crops, `temp_opt_c` (TOPMN-TOPMX), `temp_abs_c` (TMIN-TMAX), `soil_ph` (PHMIN-PHMAX) and the new `rain_abs_mm` (RMIN-RMAX, annual rainfall). Each crop records the source of each imported field in `field_sources`; 59 values changed, listed old vs new in `data/sources/ecocrop_import_report.csv`. Variety rows used where EcoCrop has several: sugar beet *Beta vulgaris* var. *saccharifera*, common vetch *Vicia sativa* ssp. *sativa*, tomato *Lycopersicon esculentum*. Spring and winter wheat/barley share one EcoCrop row.
- **Used for:** the flowering-month mean-temperature limit (hard filter), soil pH when known, and a new rain-fed risk when dry-year annual rainfall (NASA POWER) is below RMIN.
- **Not imported:** KTMP/KTMPR killing temperatures (EcoCrop gives barley −4 °C during rest, while winter barley survives about −15 °C); winter hardiness and frost-damage values stay team-compiled.
- **Status:** used.

### Crop table (`web/public/data/crops.json`)
- **42 crops.** Vegetables added 2026-11-15 (team decision; chosen from the TÜİK 2025 bulletin vegetables table): pepper, cucumber, eggplant, summer squash (zucchini), green bean, white cabbage, carrot, garlic, lettuce. Stage lengths and sowing months are the **median over the TAGEM-DSİ zones** that list each crop (Section 8; guide names in `data/sources/tagem_crop_map.csv`, e.g. "fasülye (taze)", "kabak (dolmalık)", "biber (sivri)"), and the zone's own calendar is used wherever the guide lists the crop. kc from FAO-56 Table 12 (sweet peppers and egg plant 0.6/1.05/0.90; cucumber 0.6/1.00/0.75; squash zucchini 0.5/0.95/0.75; beans green 0.5/1.05/0.90; cabbage and carrots 0.7/1.05/0.95; garlic 0.7/1.00/0.70; lettuce 0.7/1.00/0.95; small-vegetables Kc_ini 0.7 where the cell is an image); root depth FAO-56 Table 22. Temperatures, pH and rainfall from EcoCrop (*Capsicum annuum*, *Cucumis sativus*, *Solanum melongena*, *Cucurbita pepo*, *Phaseolus vulgaris*, *Brassica oleracea* var. *capitata*, *Daucus carota*, *Allium sativum*, *Lactuca sativa* var. *capitata*). Yields from FAOSTAT and nutrients from Ludemann (mapping in `data/sources/nutrient_crop_map.csv`). `sensitive_das` = start of the FAO-56 mid-season stage (team choice); frost and heat limits, frost/drought tolerance and "irrigated only" are team-compiled (`verified: false`); carrot's heat limit was raised from 30 to 35 °C after a check flagged Konya, the main carrot province, in 20 of 20 years. Spot check in main growing provinces (irrigated, after wheat): cabbage in Samsun and Konya, cucumber in Antalya, squash in İzmir and garlic in Kastamonu come out "reasonable"; pepper in Antalya (heat 8/20 years), green bean in Bursa (11/20) and lettuce in İzmir (11/20) get heat cautions. Known limits: no TÜİK province yields or "grown here" evidence yet (vegetable tables not exported from MEDAS); FAOSTAT cucumber yield includes greenhouses; this FAOSTAT export has only "Green garlic" for Türkiye, so garlic removal is likely overstated; squash yield is FAOSTAT's pumpkin-and-squash group; green bean nitrogen fixation is not estimated (Herridge 2008 covers grain legumes only); no AquaCrop heat units for any of the nine; greenhouse growing is not modelled. Spinach was left out because the guide lists it only as a second crop; lettuce uses the guide's late-summer planting.
- **33 crops.** Rice (paddy) added 2026-11-15 (team decision; TÜİK 2025 bulletin: about 1.0 Mt rice in the husk). kc from FAO-56 Table 12 (ini 1.05, mid 1.20, end 0.90-0.60, middle value used); root depth FAO-56 Table 22 (0.5-1.0 m); temperatures, pH and rainfall from EcoCrop (*Oryza sativa*); heat units from AquaCrop PaddyRiceGDD; sowing dates and stages from TAGEM-DSİ (çeltik, 21 zones); yield and nutrients from FAOSTAT and Ludemann ("Rice, paddy"). Heat limit at flowering 40 °C = AquaCrop Tmax_lo (pollination fails); AquaCrop's stress onset of 35 °C is not used because NASA POWER gives the afternoon daily maximum while rice flowers in the cooler morning above a water layer (35 °C flagged Edirne, the main rice province, in 18 of 20 years). Irrigated only. Not modelled: cold-induced sterility at booting (AquaCrop Tmin_up 8 °C); rice as a second crop (TAGEM lists it for two Mediterranean zones).
- **32 crops.** Second addition (2026-11-15): sesame, groundnut, tobacco, dry onion, watermelon, melon, chosen with the TÜİK 2025 production bulletin (see below). kc, stages and root depth from FAO-56 Tables 11, 12 and 22 (checked against the FAO page 2026-11-15: sesame June/China, groundnut May-June/Mediterranean, onion April/Mediterranean, watermelon April/Italy, sweet melon May/Mediterranean; Kc_ini image cells use group values: oil crops 0.35, legumes 0.40, small vegetables 0.7, sweet melons 0.5). Tobacco is not in FAO-56: stages 20/30/30/30 days from transplanting and kc 0.5/1.1/0.8 from FAO Land & Water crop information, tobacco (https://www.fao.org/land-water/databases-and-software/crop-information/tobacco/en). Temperatures, pH and rainfall from EcoCrop; sowing calendars (including sesame and groundnut second crops) from TAGEM-DSİ; yields and nutrients from FAOSTAT and Ludemann. Frost and heat thresholds, sensitive stage, sowing months and rain-fed yes/no are team-compiled. Known limits: EcoCrop's minimum annual rain for melon (900 mm) reflects humid regions, so rain-fed melon always gets a dry-year warning; no FAO AquaCrop heat units for any of the six, so a warmth check (warmest month of the season against EcoCrop TOPMN) rules them out in cool summers instead.
- **26 crops** (2026-11-15: added oats, rye, triticale, pea, faba bean, soybean, sainfoin, silage maize, sorghum). For the new crops: kc and stage lengths transcribed from FAO-56 Tables 11-12 (http://www.fao.org/4/x0490e/x0490e0b.htm, checked 2026-11-15; Kc_ini cells that are images on that page use the table's group values, cereals 0.3 and legumes 0.4); rye uses the wheat/small-grain rows and sainfoin the alfalfa-hay row as proxies (neither is in FAO-56); triticale is not in EcoCrop, so its temperature ranges are compiled from wheat and rye. Sowing dates from TAGEM-DSİ (pea and faba bean from the guide's fresh pea and fresh faba bean rows); EcoCrop, AquaCrop (soybean, sorghum), FAOSTAT, Ludemann and Herridge via the same scripts and mapping files. Frost, hardiness and flowering values compiled by the team (`verified: false`).
- Sourced fields: temperature ranges, pH and annual rainfall from FAO EcoCrop; heat units from FAO AquaCrop; sowing dates and stages from TAGEM-DSİ per zone (see `field_sources` in each row). The remaining fields below are team-compiled.
- 17 crops (spring wheat and spring barley added 2026-11-15 for cold plateaus; their default calendars are overridden by TAGEM-DSİ per zone); fields combine FAO-56, EcoCrop and general agronomy. Sowing months, Turkey notes, frost/heat thresholds at the sensitive stage, `sensitive_das` and thermal-time (`phenology`) parameters were set by the team (Claude), some adjusted after testing against NASA POWER data (barley and vetch hardiness −12 → −15 °C; cotton heat limit 38 → 40 °C; winter crop seasons lengthened).
- **Status:** compiled, unverified; every row has `verified: false` until an agronomy-aware reviewer checks it.

### Rotation templates (`web/public/data/rotations.json`)
- 32 rotation patterns: rice year after year added 2026-11-15 for Marmara and the Black Sea (Dok et al. 2016, see below), with the winter-vetch option in its notes; it is not a second-crop template because second crops are not yet in the water score. 31 earlier (2026-11-15, second addition: wheat + second-crop groundnut-cotton and groundnut-wheat-maize for Çukurova/Osmaniye; wheat + second-crop sesame-cotton and wheat-sesame; tobacco-wheat-chickpea; onion-wheat-sugar beet-wheat; melon-wheat-chickpea; a 5-year watermelon rotation). Earlier: 23 common Turkish rotation patterns by region, compiled by the team from general agronomy knowledge (2026-11-15 additions: spring wheat-fallow, sainfoin x3-spring wheat, rye-fallow, spring wheat-pea, alfalfa x3-spring wheat for the eastern plateaus; wheat-pea; wheat-faba bean; wheat + second-crop soybean-maize; silage maize-wheat-vetch). **Status:** compiled, unverified.

### Province coordinates and regions (`web/public/data/provinces.json`)
- 81 province centre coordinates (approximate, written from general knowledge; city centres, not farmland) and the official 7 geographic regions of Turkey.
- **Status:** compiled, unverified. Planned check: land cover from AppEEARS; consider an official or OpenStreetMap source.

---

### FAO Irrigation Water Management Training Manual 3, *Irrigation Water Needs* (Brouwer & Heibloem 1986), section 4.4 "Irrigation water need of rice"
- **URL:** https://www.fao.org/4/s2022e/s2022e08.htm (accessed 2026-11-15).
- **For:** water a flooded paddy needs beyond crop water use: 200 mm to saturate the root zone before planting, a 100 mm standing water layer, and percolation and seepage of 4 mm/day (heavy clay) to 8 mm/day (sandy soil), 6 mm/day average. Geleceğin Tarımı adds these to FAO-56 crop water use for rice (`paddyLosses` in `web/src/scoring/agronomy.js`), gives no stored-soil-water credit (saturation counts it), and shows the heavy-clay to sandy range. Rice irrigation comes out at about 1,600 mm (Samsun) to 2,200 mm (Adana), 16,000-22,000 m³ per hectare. The Today tab's weekly irrigation note adds the daily seepage.
- **Why needed:** TAGEM-DSİ 2017, Note 2 (PDF p. 21): the guide's rice water use excludes open-water evaporation and deep percolation, and users must add both for their soil and climate.

### Dok, Şahin, Sürmen & Sezer 2016, *Çeltik tarlalarında değişik baklagil yem bitkilerinin kışlık ara ürün olarak yetiştirme imkânlarının araştırılması*, Tarla Bitkileri Merkez Araştırma Enstitüsü Dergisi 25 (Özel sayı-1): 105-109, doi:10.21566/tarbitderg.280279
- **For:** the rice rotation template and notes. Rice on the Black Sea is usually grown 5 or more years in a row without rotation; about 67% of Turkish rice area is in Marmara and 25% on the Black Sea; winter vetches (Hungarian, common, hairy) with barley, sown right after the rice harvest and cut in April-May, fit before the next rice crop where basins drain in winter (Karadeniz Tarımsal Araştırma Enstitüsü, Gelemen, 2008-2012). **Accessed:** 2026-11-15 via DergiPark.

### Rice paddy-area rule (derived)
- Flooded rice is only kept on irrigated fields in provinces where TÜİK reports irrigated rice on at least 1,000 ha a year (2020-2024, 3 of 5 years): the province's existing paddy area is the proxy for basins and a river or canal supply large enough for flooding. Without TÜİK rice statistics, rice is removed with that reason. Uses TÜİK Çeltik (01.12.10.00.00) from the Tahıllar table (2026-11-15): rice is kept in 13 provinces and removed, with the province's paddy area in the reason, in the 15 others where TÜİK reports some rice.

### Rice climate outlook (derived, `web/src/scoring/outlook.js`)
- **What:** for rice, the crop check gives climate fit today, at +2 °C and at +3 °C, separately from water supply (the paddy-area rule). Uses the app's what-if method (`features/scenario.js`: uniform warming of the 20-year NASA POWER record, ET0 and frost dates shifted), the same climate hard checks and the 25% heat/frost-years cut-off. Labelled "what-if, not a forecast"; information only, never a verdict change. Rotation cards with rice get a risk when warming stops the fit.
- **Country test (2026-11-15):** 62 provinces fit rice's climate today, 55 at +2 °C, 54 at +3 °C. At +3 °C Edirne and Balıkesir (main rice provinces) lose the fit to heat at flowering (Edirne 9 of 20 years); cold eastern provinces (Kars, Ağrı, Erzincan, Sivas, Artvin) gain it but have no paddy area or river supply today. Not covered: future river and canal flows (water supply is today's TÜİK paddy area).

### Rotation resilience under warming (derived, `web/src/scoring/index.js`)
- Every rotation card is scored again with the what-if climates +2 °C and +2 °C with 10% less rain (uniform shift of the 20-year NASA POWER record, `features/scenario.js`), always from today's climate even when a slider is on. The card shows today → +2 °C → +2 °C drier and a label: holds up (drop ≤ 4 points), loses some ground (≤ 10), sensitive to warming (> 10); cut-offs team-compiled. Not part of the AI facts. Example (2026-11-15): Adana wheat > faba bean 77 → 71 / 70 (loses some ground); Samsun cards do not move.

### Recent climate shift (derived, `web/src/features/shift.js`, `scripts/build_climate_shift.mjs` → `web/public/data/climate_shift.json`)
- From the raw NASA POWER daily record (2005-2024, the same as the cached features): for each province, the last 5 complete years against the earlier 15 for mean temperature, days ≥ 35 °C, annual rain, heavy-rain days (≥ 20 mm), longest March-June dry spell (days < 1 mm), frost nights (< 0 °C), last spring frost and April-May root-zone wetness (NASA model estimate). Noise test: z = difference / (year-to-year SD × √(1/5 + 1/15)); "clear change" if |z| ≥ 2, "possible" if ≥ 1. Shown as a panel on the Plan tab with a button that applies the measured warming and rain change to the what-if sliders. Measured, not a forecast; not in the AI facts.
- **Result (2026-11-15):** 25 provinces clearly warmer (none cooler; national mean +0.7 °C), 11 with clearly more days ≥ 35 °C (19.5 → 23.8 a year); rain: Zonguldak clearly wetter (+23%), Black Sea mostly +15-20% and central Anatolia −12 to −19% only "possible"; frost, heavy rain, dry spells and spring soil wetness show no clear change. Limit: 5 vs 15 years is short; NASA POWER back to 1981 would strengthen the test.

### Irrigation amounts in the crop check and rotation cards (derived, `web/src/scoring/waterText.js`, `monthlyIrrigation` in `web/src/scoring/agronomy.js`)
- **For:** telling the farmer how much water a crop takes: season irrigation in mm and the same amount in m³ per dekar and per hectare (1 mm over 1 dekar = 1 m³; 1 hectare = 10 dekar), the share of the crop's use that rain and stored soil water cover, and the months that need most of it (the fewest months, at most 3, holding 60% of the total). Shown on irrigated fields; on rain-fed fields for crops that need irrigation ("to grow X you would need to irrigate: …") next to the existing block; and for rain-fed crops short of water in a dry year (how many mm short, and when). Worded in English and Turkish.
- **Method:** the existing FAO-56 water balance (kc × NASA POWER reference evapotranspiration, 75% effective rain, stored soil water at sowing); each month's share of the season total follows that month's gap between crop use and effective rain. Net crop water at the root zone: the note "drip loses less water than furrow or sprinkler" stands in for application efficiency, which the app does not ask for.
- **Kind:** model estimate (normal or dry year from 20 years of NASA POWER). **Status:** used.

### Today alarm context (derived, `web/src/scoring/today.js`)
- Frost and heat alarms add how unusual the forecast value is for that place and 10-day period: in how many of the 20 years of NASA POWER (2005-2024, `dekad_extremes_by_year`) the coldest night or hottest day of that period was milder ("hotter than the hottest day of this 10-day period in every year since 2005"). English and Turkish. Heavy rain has no daily-rain history cached, so it gets no context line.

## Downloaded sources (in `data/sources/`, not yet integrated)

### TAGEM-DSİ 2017, *Türkiye'de Sulanan Bitkilerin Bitki Su Tüketimleri* (Ankara, 600 pages)
- **Publisher:** T.C. Tarım ve Orman Bakanlığı, Tarımsal Araştırmalar ve Politikalar Genel Müdürlüğü (TAGEM) and Devlet Su İşleri Genel Müdürlüğü (DSİ), 2017.
- **Contents used:** 259 climate stations with coordinates and 29 agro-climate zones (Section 7); for each zone and crop, the sowing dekad and the four FAO-56 stage lengths (Section 8, pp. 39-79); kc per station and dekad (Section 9, from p. 81); station ETo (Section 10) and long-term rainfall (Section 11); crop water use (Section 12).
- **For:** official Turkish sowing calendars and stage lengths per climate zone, replacing the team-compiled sowing months; kc cross-check against FAO-56.
- **Caveat:** written for **irrigated** crops; rain-fed sowing dates can differ.
- **File:** `data/sources/raw/TAGEM-DSI_2017_Bitki_Su_Tuketimleri.pdf` (not committed; government publication, cite it).
- **Extracted (2026-11-15, `scripts/extract_tagem.py`, PyMuPDF text extraction; every row keeps its PDF page):**
  - `data/sources/tagem_zones.csv`: 29 climate zones (BLG_01-29) with station counts (Section 6).
  - `data/sources/tagem_stations.csv`: 259 stations with WMO id, province, coordinates, elevation, zone (Section 7).
  - `data/sources/tagem_calendar.csv`: 1,922 rows: zone, crop (Turkish), sowing month and dekad, four FAO-56 stage lengths, season (Section 8). In 204 rows the printed season differs from the sum of the stages by 1-2 days (rounding in the guide); both are kept as printed.
  - Checks built into the script: 29 zones, 259 stations with no gaps, row numbers 1-1922 continuous, every row's zone matches the zone label printed on its page.
- **Mapping (team, compiled):** `data/sources/tagem_crop_map.csv` links our crop ids to guide names and says how each is used (`full` calendar, `sowing_only` for winter crops whose flowering and harvest come from thermal time, or `none`).
- **Built for the app (`scripts/build_tagem.mjs`):** `web/public/data/tagem_calendar.json` (298 zone-crop calendars for our crops); `web/public/data/provinces.json` gains `tagem_zone` and `tagem_station` (nearest TAGEM station inside the same province; all 81 provinces have one).
- **How the app uses it:** sowing dates (and full stage lengths for `full` crops) per zone; on rain-fed fields only winter-crop sowing dates and spring cereals are used, because the guide is for irrigated crops; crops the guide does not list for a zone get a risk note and low confidence, and generated rotations only use listed crops.
- **Status:** used.

### Ludemann et al. 2023, *Global data on crop nutrient concentration and harvest indices* (Dryad, doi:10.5061/dryad.n2z34tn0x)
- **For:** N, P, K, S in harvested product and residues (kg per tonne fresh weight) and harvest index → nutrient removal per rotation.
- **Files:** `data/sources/ludemann2023_Tier_1_and_2_crop_coefficients.csv` (2,244 rows), `ludemann2023_Meta_data_Tier_1_and_2_crop_coefficients.csv`, `ludemann2023_README.md`, from the dataset version dated 2026-11-10.
- **Coverage note:** Tier 1 (world) values exist for all our crops except alfalfa; there are no Tier 2 values for Türkiye, so world values are used.
- **License:** CC0. **Obtained:** by the team (web download), 2026-11-15.
- **Used (2026-11-15):** product and residue N, P, K per tonne (Tier 1 world rows) for 16 crops via `data/sources/nutrient_crop_map.csv` and `scripts/build_nutrients.mjs` → `web/public/data/nutrients.json`. Vetch uses the "Vetches" grain row (forage vetch removes more). No row for alfalfa. **Status:** used.

### FAOSTAT QCL, crop yields for Türkiye
- **For:** average Turkish yields to turn nutrient concentrations into kg/ha removed; default yields the farmer can change.
- **File:** `data/sources/faostat_turkey_yields.csv`: element Yield (kg/ha), all primary crops (94 items), 2006-2024, with flags. Covers 14 of our 15 crops (no alfalfa).
- **License:** CC BY 4.0 (cite FAO). **Obtained:** by the team (FAOSTAT web export), 2026-11-15.
- **Used (2026-11-15):** mean yield 2020-2024 per crop in `web/public/data/nutrients.json` (e.g. wheat 2.97, chickpea 1.20, maize 9.46, sugar beet 66.5 t/ha). National averages mix irrigated and rain-fed fields; spring wheat and barley use the national wheat and barley yields. **Status:** used.

### Herridge, Peoples & Boddey 2008, *Global inputs of biological nitrogen fixation in agricultural systems*, Plant and Soil 311:1-18, doi:10.1007/s11104-008-9668-3
- **Used values:** Table 2 (%Ndfa: common bean 40%; chickpea, lentil, pea etc. 63%; faba bean 75%); Table 4 method (shoot DM = grain yield / harvest index 0.35; shoot N 2.0%; below-ground factor 2.0 for chickpea, 1.4 for other pulses); Table 5 (kg N/ha/yr: chickpea 58, lentil 51, common bean 23, pea 86); forage legumes ~50 kg N fixed per tonne shoot dry matter, alfalfa ~200 kg N/ha/yr (citing Smil 1999).
- **File:** `data/sources/raw/HerridgePeoplesBoddey2008.pdf` (not committed; journal copyright).
- **Added later the same day:** pea (63% group), faba bean (75%, shoot N 2.2%), soybean (68%, harvest index 0.4, shoot N 3.0%, below-ground factor 1.5; gives 321 kg N/ha at the Türkiye yield of 4.2 t/ha, within the paper's range for high-yielding soybean, but irrigated Turkish soybean often receives N fertilizer, which lowers fixation), sainfoin (100 kg N/ha/yr, "other forages" value from Smil 1999 as cited).
- **Transcribed (2026-11-15):** `data/sources/fixation.csv` with page and table references: fixed N = Türkiye yield / 0.35 × 2.0% shoot N × below-ground factor (2.0 chickpea, 1.4 others) × %Ndfa (63% chickpea, lentil, vetch; 40% common bean); alfalfa 200 kg N/ha/yr. Results with FAOSTAT yields: chickpea 86, lentil 69, dry bean 90, vetch 72 kg N/ha. Vetch is not named in the paper; the pulse group is an approximation (noted in the file).
- **Groundnut (added 2026-11-15):** %Ndfa 68% (Table 2 p.7, soybean and groundnut group), harvest index 0.4 and shoot N 2.3% (Table 4 footnotes p.9), below-ground factor 1.4. Gives 223 kg N/ha at the FAOSTAT in-shell yield of 4.07 t/ha; the paper's harvest index refers to grain, so this likely overstates fixation by about 30% (noted in `fixation.csv`).
- **Obtained:** by the team, 2026-11-15. **Status:** used.

### Nutrient balance (derived, `web/src/scoring/nutrients.js`)
- Per rotation, average per hectare and year: N, P2O5 (P × 2.291) and K2O (K × 1.205) removed by harvests (FAOSTAT yield × Ludemann per tonne) and N fixed by legumes (Herridge method). Residues are assumed to stay in the field. Shown on each rotation card with the note that only legumes add nitrogen and that P and K come back only through fertilizer or manure; no doses. Information only; it does not change the score yet. **Kind:** compiled rule.

### FAO AquaCrop default crop files (via AquaCrop-OSPy), crop heat-unit requirements
- **For:** checking that the summer is warm enough for warm-season crops: base temperature, upper temperature, growing degree days to flowering and to maturity.
- **Source:** AquaCrop-OSPy, `aquacrop/entities/crops/crop_params.py`, https://github.com/aquacropos/aquacrop, commit `256cac4c2c` (2024-05-31); the parameters reproduce FAO AquaCrop's default crop files. **License:** Apache-2.0.
- **Files:** `scripts/extract_aquacrop.py` downloads the file (kept in `data/sources/raw/`, not committed) and reads it with `ast.literal_eval` (no code is executed); `data/sources/aquacrop_gdd.csv` (11 GDD crop versions); `data/sources/aquacrop_crop_map.csv` (which of our crops use it); `scripts/build_heat_units.mjs` writes `heat_units` into `web/public/data/crops.json`.
- **Used for:** maize, sunflower, cotton, potato, sugar beet, tomato, dry bean, sorghum, soybean, rice (PaddyRiceGDD: base 8 °C, upper 30 °C, flowering 1,150 GDD, maturity 1,900 GDD; row added to `aquacrop_gdd.csv` from the same commit's file). Heat units are summed from sowing to the median first autumn frost using NASA POWER monthly median temperatures (AquaCrop method: daily max and min clipped to [base, upper]). Below 85% of the need → crop ruled out; 85-100% → risk note and lower climate score. Not used for cereals (AquaCrop's wheat default is a 2,400 GDD long-season variety) or for season length (default varieties are long-season and inflated water need). When an official TAGEM-DSİ calendar exists for the crop in that zone, the official calendar wins (risk note only).
- **Caveat:** AquaCrop defaults describe typical varieties calibrated elsewhere; local short-season varieties may need less, hence the 15% margin. No AquaCrop parameters for chickpea, lentil, safflower, canola or vetch; the cards say so.
- **Accessed:** 2026-11-15. **Status:** used.

### Rotation rules (`data/sources/rotation_rules.csv`, built into `web/public/data/rotation_rules.json`)
Compiled by the team on 2026-11-15 from the sources below (found by web search; intervals are the common recommendations reported there, local extension advice takes precedence). Each rule changes the rotation score and appears on the card with its source.

| Rule | Effect | Source |
|---|---|---|
| Sunflower at most every 4 years (broomrape, Orobanche cumana) | −8 | Shevchenko 2024, Sunflower broomrape, Dnipro State Agrarian and Economic University ([PDF](https://dspace.dsau.dp.ua/bitstream/123456789/9912/1/2024%20Sergey%20Shevchenko%20-%20Sunflower%20Broomrape%20Orobanche%20cumana%20Wallr%20and%20Wee%20%5bretrieved_2024-07-08%5d.pdf)): seed viability 7-9 years; highest damage in 2-year wheat-sunflower. The 4-year interval is our choice within that evidence. |
| Sugar beet at most every 4 years (beet cyst nematode) | −8 | Journal of Nematology 2024 ([PMC11550871](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11550871/)): 3-4 years of non-host crops; Nebraska bulletin cited there: 3-5 years in heavily infested soil |
| Chickpea at most every 3 years (Ascochyta) | −6 | NDSU Extension ([PDF](https://www.ag.ndsu.edu/carringtonrec/archive/documents/plantpathologyrd/noyeardocs/CHICKPEAAscochytamgmt.pdf)): minimum 3-year rotation; Agriculture and Agri-Food Canada: 3-4 years |
| Lentil at most every 3 years | −6 | USDA ARS, General principles for managing chickpea and lentil diseases ([DOC](https://www.ars.usda.gov/ARSUserFiles/20902000/compendium/part5-management.doc)): at least two non-host crops between crops |
| Potato at most every 3 years | −6 | Potato soilborne disease and rotation review ([PMC2586465](https://pmc.ncbi.nlm.nih.gov/articles/PMC2586465)): 3-4 years; 2-year rotations did not prevent increases |
| Canola at most every 4 years (blackleg) | −6 | Canadian Journal of Plant Pathology 2013 ([link](https://informahealthcare.com/doi/full/10.1080/07060661.2013.775600)): one canola crop in 4 years |
| Cereal after cereal (take-all) | −5 per pair | Rothamsted Research, Annals of Applied Biology aab.12139 ([PDF](https://repository.rothamsted.ac.uk/download/93e60e634a4bfe79ba755240905f6dc611d15f7a79c8ce8b3cbf0396c3027330/591309/aab.12139.pdf)); Oregon State Extension EC 1423 |
| Potato and tomato back to back | −6 | compiled rule (shared soilborne hosts), **needs expert check** |
| Legume before a cereal | +5 | Zhao et al. 2022, Nature Communications 13:4926 ([link](https://link.springer.com/10.1038/s41467-022-32464-0)): about +20% yield on average, 462 studies |
| Brassica (canola) before potato | +3 | AAFC research (R. Peters) reported by Top Crop Manager ([link](https://www.topcropmanager.com/rotational-options-being-studied-5060/)) |
| Groundnut at most every 3 years (leaf spot, white mold) | −6 | Alabama Cooperative Extension System ([link](https://www.aces.edu/?p=111803)): 3-4 years between peanut crops; UF/IFAS 3-4 years; University of Georgia minimum 2 |
| Tobacco at most every 3 years (black shank) | −6 | University of Kentucky / University of Tennessee, disease management ID-160 ([PDF](https://burleytobaccoextension.ca.uky.edu/files/disease_management_id160_2019.pdf)): out of tobacco for at least 3 years |
| Watermelon at most every 5 years (Fusarium wilt) | −8 | Michigan State University Extension ([link](https://www.canr.msu.edu/news/managing_diseases_caused_by_fusarium_the_case_of_watermelon_wilt)): 5-7 years; Purdue 6+, UC IPM up to 10 |
| Onion at most every 4 years (pink root, white rot) | −6 | AUSVEG onion soil-borne diseases fact sheet ([PDF](https://ausveg.com.au/app/uploads/2025/08/Onions-soil-borne-diseases-fact-sheet.pdf)): 4-6 years for pink root; UC IPM ([link](https://ipm.ucanr.edu/agriculture/onion-and-garlic/white-rot/)): white rot sclerotia survive 20+ years, so rotation slows but does not stop it |
| Melon, watermelon, cucumber or squash after a cucurbit | −6 | Oklahoma State University Extension, Watermelon diseases ([link](https://extension.okstate.edu/fact-sheets/watermelon-diseases)): 3-4 years with non-cucurbit crops |

| Garlic or onion after an Allium (white rot, pink root; added 2026-11-15 with garlic) | −6 | same AUSVEG fact sheet and UC IPM onion and garlic white rot page as the onion rule |

- **Vegetables (2026-11-15):** pepper and eggplant fall under the potato/tomato nightshade rule, cucumber and squash under the cucurbit rule, white cabbage under the brassica-before-potato rule, green bean under legume-before-cereal. No crop-specific intervals were added for the nine vegetables.
- **Point values** (−8, −6, −5, +5, +3) are the team's weighting, not from the sources. Two legumes or other same-family pairs without a specific rule keep a generic −5.
- **Not added:** a sesame interval. The only figure found (5 years, icipe/Infonet sesame guide) applies to strongly infested fields; sesame after sesame still gets the generic same-family penalty.
- **Status:** used (rotation cards and crop check tab).

## Planned data (found, not yet integrated)

| Source | For | Access | License | Status |
|---|---|---|---|---|
| Peoples et al. 2009 | legume nitrogen fixation (regional table) | paper | journal copyright; cite | optional (Herridge 2008 covers the need) |
| Beillouin et al. 2019, *A dataset of meta-analyses on crop diversification at the global scale* | general effect sizes of rotation and diversification | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6465772/ (data on figshare) | check | planned |
| Zhao et al. 2022, *Nature Communications* (legume pre-crop meta-analysis) | legume pre-crop raises next crop yield ~20% on average | https://link.springer.com/10.1038/s41467-022-32464-0 | open access | planned |
| TÜİK province crop statistics | province-level yields and areas | TÜİK tables | check | optional |

## Reviewed from the challenge's NASA and partner resource list (2026-11-15)

| Resource | Decision | Why |
|---|---|---|
| SMAP soil moisture | **added** to the AppEEARS request (SPL3SMP_E.006); GIBS map layer later | real NASA soil-moisture observation; complements POWER's modeled root-zone wetness |
| VIIRS vegetation indices | **added** to the AppEEARS request (VNP13A1.002) | continuity for MODIS as Terra nears end of mission |
| Landsat / HLS (Harmonized Landsat Sentinel-2, 30 m) | **candidate (stretch)**: one AppEEARS area request for the demo field with `HLSL30_VI.020` / `HLSS30_VI.020` (ready-made NDVI) | field-scale NDVI and bare-period detection; MODIS 250 m is coarse |
| GPM IMERG | **candidate (should)**: daily series for cached points | rainfall reliability and extreme-storm frequency for erosion |
| FAO GAEZ v4 | **candidate**: suitability cross-check; official EcoCrop access; HWSD v2 soil database as SoilGrids fallback | soil properties and suitability without depending on SoilGrids |
| ECOSTRESS | roadmap | irregular revisits; heavy processing |
| GLDAS | not planned | POWER already supplies the climate and modeled soil-wetness features |
| ERA5 (ESA/ECMWF) | not planned | NASA POWER covers the same need |
| Sentinel-2 (ESA) | via HLS if used | one pipeline for Landsat and Sentinel-2 |
| GEDI | excluded | forest structure; little value for cropland |
| NASA Worldview | pitch visuals only | IMERG/SMAP images for the video |
| USDA Ag Data Commons, Web Soil Survey, CDL, PRISM, SSURGO/STATSGO2, NAIP, NLCD, NLDAS, CoCoRaHS, NWIS, AMS Market News, NASS QuickStats, OpenET, LANDFIRE | excluded | U.S.-only coverage; a U.S. version could plug them in through the same data interface |

## Methods (not data, but cited)
- Hargreaves reference evapotranspiration: FAO-56 eq. 52.
- Growing degree days with base temperature for winter crop calendars; earliest flowering date as a day-length limit (team rule, parameters unverified).
