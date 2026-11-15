// FROZEN CONTRACT: named features the scoring module reads. Scoring never reads
// raw NASA series, only these numbers, so a data source can be swapped without
// touching the rules. Each feature is { value, unit, source, kind, period }.

export const FEATURE_NAMES = {
  // climate (NASA POWER daily, per calendar month index 1-12 where noted)
  monthly_tmin_c: "median of monthly mean daily minimum temperature, 12 values",
  monthly_tmax_c: "median of monthly mean daily maximum temperature, 12 values",
  monthly_rain_mm: "median monthly rainfall, 12 values",
  monthly_rain_dry_mm: "25th-percentile (dry year) monthly rainfall, 12 values",
  monthly_et0_mm: "median monthly reference evapotranspiration (Hargreaves), 12 values",
  frost_days_by_month: "mean days per month with minimum below 0 °C, 12 values",
  last_spring_frost_doy: "median day of year of the last frost before summer",
  first_autumn_frost_doy: "median day of year of the first frost after summer",
  frost_free_days: "median length of the frost-free season",
  yearly_min_temp_c: "median of each year's lowest temperature (winter hardiness check)",
  heavy_rain_days_per_year: "mean days per year with rain above 20 mm",
  root_zone_wetness_by_month: "median root-zone soil wetness, 0-1, 12 values (NASA model estimate)",
  dry_year_class: "this season compared with past years: dry, normal or wet",
  annual_rain_mm: "median yearly rainfall",
  annual_rain_dry_mm: "25th-percentile (dry year) yearly rainfall",
  dekad_extremes_by_year:
    "per complete year: lowest daily minimum and highest daily maximum in each 10-day period (36 per year), for frost and heat checks at sensitive stages",

  // vegetation (MODIS NDVI 16-day)
  bare_months: "months per year where median NDVI is below the bare-soil threshold",
  ndvi_by_month: "median NDVI per month, 12 values",

  // terrain (SRTM, field sample grid)
  mean_slope_pct: "mean slope inside the field (plane fitted to the samples), percent",
  aspect_deg: "direction the slope faces, degrees from north",
  elevation_m: "mean elevation of the samples",
  relief_m: "highest minus lowest sample",
  terrain_samples: "number of elevation samples used",

  // crop calendar (TAGEM-DSİ 2017, by climate zone)
  sowing_calendar:
    "per crop id: sowing month and dekad, FAO-56 stage lengths and season for the field's TAGEM climate zone (irrigated crops); use = full | sowing_only",

  // soil (SoilGrids or farmer test)
  soil_ph: "topsoil pH",
  soil_clay_pct: "topsoil clay percent",
  soil_organic_carbon_gkg: "topsoil organic carbon, g/kg",
};
