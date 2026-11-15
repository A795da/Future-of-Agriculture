# Global data on crop nutrient concentration and harvest indices

#### Description of the data and file structure

**Data_diagram_25102022.pdf**

Illustrates the general process for standardisation of data into the final formats.

**Combined dataset (Combined_crop_data.csv)**

This dataset includes the combined crop coefficient data from all sources before it was summarised by Tier category. Two metadata files accompany the Combined_crop_data.csv file. The Meta_data_Combined_crop_data_1.csv file describes the header parameters, while the Meta_data_Combined_crop_data_2.csv file describes units for each variable used in the file.

**Data summarised at Tier 1 and 2 level (Tier_1_and_2_crop_coefficients.csv)**

This dataset includes a summary of the data from the Combined_crop_data.csv file. Data were summarised into mean values across sources that purported to represent the World (indicated as being Tier 1) and across sources that purported to represent different regions of the world (Tier 2). The Tier 2 crop coefficients excluded duplicated data from the same primary source (e.g., secondary sources that used data from IPNI (2004)). Tier 2 data were summarised for each UN-recognised country based on mean values from regions that were applicable for each country where data were available. In the absence of any better country- or sub-country-specific survey data, it is envisioned that preference be given to using the Tier 2 country estimates of crop coefficients in any global analyses. If any countries do not have Tier 2 crop coefficients, then Tier 1 values can be used.

A metadata file accompanies this file and is named Meta_data_Tier_1_and_2_crop_coefficients.csv. This describes the header parameters.

**Data summarised for UN FAO Cropland Nutrient Budget (World_crop_coefficients_for_UN_FAO.csv)**

This file contains a summary of Tier 1 data from the Tier_1_and_2_crop_coefficients.csv file, and it was used in the 2023 update of the UN FAO Cropland Nutrient Budget.  A metadata file accompanies this file and is named Meta_data_World_crop_coefficients_for_UN_FAO.csv. This describes the header parameters.

**Crop category data file (Original_crop_names_in_each_item_category.csv)**

This file includes information on the UN FAO crop item categories, crop item codes, and original crop names assigned to each item in this dataset. The parameter named *item* indicates the United Nations crop type ‘item’ name, *item_code* indicates the United Nations item code number, and *original_crop*  indicates the name of the crop category originally used in the source of data.

**Region data file (Original_region_names_and_assigned_countries.csv)**

This file includes information on countries and alpha-3 country codes assigned to each original region category (used in the sources of data). The parameter named *country* indicates the official United Nations English name of the country; iso3_code indicates the 3-letter ISO 3166 United Nations code ([https://www.iso.org/publication/PUB500001.html](https://www.iso.org/publication/PUB500001.html)) to signify a country or region.

Any NA represents missing data.

**Related works**

These data are used as part of the United Nations Food and Agriculture Organization Cropland Nutrient Budget [https://www.fao.org/faostat/en/#home ](https://www.fao.org/faostat/en/#home)

**Versions**

#### In March 2023.

-Data were updated by excluding outliers from India. Data from Roy et al. (2004) (Table 29) for India were actually total uptake of nutrient per unit of crop product, rather than nutrient concentration. These (high) values were therefore excluded from the datase,t and the GitHub repository was updated accordingly. 

In November 2023, data were updated for the 2023 version of the FAO Cropland Nutrient Budget. Key changes included: 

-There was a change in the assumption used for converting nitrogen to protein concentrations for the Unkovich raw data. The original source  (Sinclair and De Wit 1975) mentioned they used an N: protein ratio of 6.67 instead of the 6.25 ratio originally assumed in the previous version of this dataset.

-Code was updated to better utilize nutrient concentration data on a dry matter basis for filling in gaps in nutrient concentration on a fresh weight basis. 

\- Overcame double-up in Carrots data from the FAO (2020) raw data file. 

-Updated Cassava values in the FAO (2020) raw data file as there was an error. Values for N, P, and K removal for 20t of fresh-weight cassava yield were used from [http://nutrien-ekonomics.com/tools-to-calculate-fertilizer-needs/calculators/nutrient-removal/](http://nutrien-ekonomics.com/tools-to-calculate-fertilizer-needs/calculators/nutrient-removal/)

-In the regular expression function to convert original crop names to item_code, "Grain, mixed" was given code 103 "Mixed grain" rather than 108 "Cereals, nes". 

-An error in the filter code (used to avoid double-ups on data from the same primary source) was fixed. This resulted in more species being available while still avoiding duplicates of values from the same original source of data. 

In September 2024, this repository had an article DOI linked to it from Nutrient Cycling in Agroecosystems ([https://doi.org/10.1007/s10705-024-10381-6)](https://doi.org/10.1007/s10705-024-10381-6\)). No changes were made to the data. 

#### In November 2026

The R scripts used to collate and summarise raw data were updated (and were tracked as commits to the GitHub repository) as follows:

-improvements were made to the classification of original crop names to FAO standardised crop names,

-improvements were made to ensure nutrient concentrations from primary sources on a dry matter basis were correctly aligned to   dry matter concentrations in the summarised values

-improvements were made to ensure nutrient concentrations from primary sources on a fresh weight basis were correctly aligned to fresh weight concentrations in the summarised values

-improvements were made to ensure secondary sources of data were not averaged multiple times if they came from the same primary source

-some errors were found in values from primary sources (e.g. Papaya) and were rectified

A consequence of these changes was that of the 158 crops in the World_crop_coefficients_for_UN_FAO.csv file 9 had changes in values of more than 50% since the last update. They can be explained as follows:

 -Figs,  N_kg_per_t_fresh_wt: reduced due to better accounting for wet/dry matter concentrations,

-Maize, green, N, P and K_kg_per_t_fresh_wt: reduced due to deduplication in primary source values,

-Mushrooms and truffles, N_kg_per_t_fresh_wt: reduced due to better accounting for wet/dry matter concentrations,

-Papayas N_kg_per_t_fresh_wt: reduced due to rectification of error in primary source value,

\- Peas, green N, P and K_kg_per_t_fresh_wt: reduced due to better accounting for wet/dry matter concentrations,

\- Plums and sloes, N_kg_per_t_fresh_wt: reduced due to better accounting for wet/dry matter concentrations,

-Sugar beet K_kg_per_t_fresh_wt: reduced due to misclassification of sugar beet tops,

-Sugar cane N_kg_per_t_fresh_wt: reduced due to misclassification of bagasse,

\- Vegetables, leguminous nes, N_kg_per_t_fresh_wt: reduced due to better accounting for wet/dry matter concentrations,

**References**

FAOSTAT. 2020. *FAOSTAT Domain Cropland Nutrient Budget Metadata, release December 2020*. Rome, Italy.[  https://fenixservices.fao.org/faostat/static/documents/ESB/ESB_e.pdf](https://fenixservices.fao.org/faostat/static/documents/ESB/ESB_e.pdf) 

FAOSTAT. 2022. *FAOSTAT*. Retrieved 18 May 2020 from: [http://www.fao.org/faostat/en/#country](http://www.fao.org/faostat/en/#country).

IPCC. 2019. *Overview: 2019 refinements to the 2006 IPCC guidelines for national greenhouse gas inventories*. [https://www.ipcc.ch/site/assets/uploads/2019/12/19R_V0_01_Overview.pdf](https://www.ipcc.ch/site/assets/uploads/2019/12/19R_V0_01_Overview.pdf).

IPNI. 2014. *IPNI Estimates of Nutrient Uptake and Removal*. Retrieved 11 July 2022. [http://www.ipni.net/ipniweb/portal.nsf/0/CBDC9962624CDFCD85257AC60050BBD2/$FILE/Metric%204_1%20&%204_5%200115.pdf](http://www.ipni.net/ipniweb/portal.nsf/0/CBDC9962624CDFCD85257AC60050BBD2/%24FILE/Metric%204_1%20&%204_5%200115.pdf).

Sinclair, T., and De Wit, C. T. (1975). Photosynthate and nitrogen requirements for seed production by various crops. Science 189, 565–567.

Zhang X, Zou T, Lassaletta L, Mueller ND, Tubiello F, Lisk MD, Lu C, Conant RT, Dorich CD, Gerber J, Tian H, Bruulsema T, McClellan-Maaz T, Nishina K, Leon B, Bodirsky LB, Popp A, Bouwman L, Beusen A, Chang J, Havlík P, Leclère D, Canadell JG, Jackson RB, Billen G, Heffer P, Wanner N, Zhang W, Davidson EA. 2021. Quantification of global and national nitrogen budgets for crop production. *Nature Food*: 1-14.

Works referencing this dataset

* Ludemann, Cameron I. et al. (2023), A global reference database in FAOSTAT of cropland nutrient budgets and nutrient use efficiency: nitrogen, phosphorus and potassium, 1961–2020, [], Posted-content, [https://doi.org/10.5194/essd-2023-206](https://doi.org/10.5194/essd-2023-206)
* Ludemann, Cameron I. et al. (2024), A global FAOSTAT reference database of cropland nutrient budgets and nutrient use efficiency (1961–2020): nitrogen, phosphorus and potassium, Earth System Science Data, Journal article, [https://doi.org/10.5194/essd-16-525-2024](https://doi.org/10.5194/essd-16-525-2024)
* Ludemann, Cameron et al. (2024), Field experimental data of crop yields, nutrient concentrations, and harvest indices from around the world, Dataset, [https://doi.org/10.5061/dryad.djh9w0w4m](https://doi.org/10.5061/dryad.djh9w0w4m)
* Ludemann, C. I.; Hijbeek, R.; van Loon, M. P. et al. (2024). Tiered maize and wheat nutrient removal coefficients estimated from available data. Nutrient Cycling in Agroecosystems. [https://doi.org/10.1007/s10705-024-10381-6](https://doi.org/10.1007/s10705-024-10381-6)
* Medinets, Sergiy; Oenema, Oene; Spears, Bryan M. et al. (2025). Nutrient asymmetry challenges the sustainability of Ukrainian agriculture. Communications Earth & Environment. [https://doi.org/10.1038/s43247-025-02826-9](https://doi.org/10.1038/s43247-025-02826-9)
