# AppEEARS request: 81 provinces

One Point Sample request returns vegetation, soil moisture and land cover for all 81 province points. Product and layer names below were checked against the AppEEARS product catalog on 2026-11-15.

## Steps (about 5 minutes)

1. Open https://appeears.earthdatacloud.nasa.gov, **Sign In** with NASA Earthdata.
2. **Extract → Point Sample → Start a new request.**
3. **Request name:** `fieldshift-81-provinces`
4. **Coordinates:** upload `fieldshift_81_provinces.csv` (this folder). The map should show 81 points.
5. **Date:** start `01-01-2015`, end `11-14-2026` (month-day-year). Leave "recurring" off.
6. **Products and layers:** search each product, then click the layers to add them:

| Product | Layers to add | What it gives |
|---|---|---|
| `MOD13Q1.061` (Terra MODIS Vegetation Indices, 16-day, 250 m) | `_250m_16_days_NDVI`, `_250m_16_days_pixel_reliability` | NDVI; reliability flags cloudy composites |
| `VNP13A1.002` (VIIRS Vegetation Indices, 16-day, 500 m) | `500_m_16_days_NDVI`, `500_m_16_days_pixel_reliability` | NDVI continuity for MODIS |
| `SPL3SMP_E.006` (SMAP Enhanced L3 Soil Moisture, daily, 9 km, from 2015-03-31) | `Soil_Moisture_Retrieval_Data_AM_soil_moisture`, `Soil_Moisture_Retrieval_Data_AM_retrieval_qual_flag`, `Soil_Moisture_Retrieval_Data_PM_soil_moisture_pm`, `Soil_Moisture_Retrieval_Data_PM_retrieval_qual_flag_pm` | observed surface soil moisture (m³/m³) and quality flags |
| `MCD12Q1.061` (MODIS Land Cover, yearly, 500 m) | `LC_Type1` | land cover class: 12 = croplands, 13 = urban, 14 = cropland/natural mosaic |

7. **Output:** leave the defaults (CSV).
8. **Submit.** An email arrives when it finishes (minutes to a few hours, depending on the queue).
9. **Download:** Explore → the request → Download. Save every `*-results.csv` file into this folder (`data/appeears/`), plus the `*-request.json` file. Tell Claude; the conversion to the app cache is scripted.

## Notes

- Fill values: MOD13Q1 NDVI −3000, VIIRS NDVI −15000, SMAP −9999. NDVI scale factor is 0.0001 (AppEEARS CSV usually already applies it; the conversion script checks).
- SMAP starts on 2015-03-31, so its first months will be empty; that is expected.
- Points are province centres; land cover will show which ones fall on cities. Those will be moved to nearby farmland in a small second request.
- Optional later (stretch): one **Area Sample** request with the demo field polygon for `HLSL30_VI.020` and `HLSS30_VI.020` (30 m NDVI from Landsat and Sentinel-2).
