# TÜİK province crop statistics: how to export

Source: TÜİK Merkezi Dağıtım Sistemi (MEDAS), https://biruni.tuik.gov.tr/medas/?locale=tr
Topic: **Bitkisel Üretim İstatistikleri**. There is no public API (the site is a session-based web app), and the
data changes once a year, so we export once and keep the files here. Put every exported file in this folder.

Why: planted area and production per crop and province → local yields (rain-fed and irrigated separately),
second-crop data, and "this crop is grown in this province" evidence.

Limit: one export may hold at most 50,000 cells (indicators × provinces × years). The counter at the bottom of the
page ("Seçilen gösterge adedi × düzey adedi × zaman adedi") shows the product; if it is over 50,000, take fewer years.

## Export A: rain-fed / irrigated, first / second crop (27 crops), 3 files

1. Open MEDAS, **Konu** → `Bitkisel Üretim İstatistikleri`.
2. **Ölçüm** → `(Kuru / Sulu) - (1. Ekiliş / 2. Ekiliş) ürünleri`.
3. **Kırılım Seçiniz**: tick all five: `Ürün niteliği`, `Ekiliş sayısı`, `Kuru/ Sulu ekiliş`, `Ürünler`, `Ölçü birimi` → **Tamam**.
4. In the value lists that appear:
   - Ürün niteliği: `Ekilen Alan` and `Üretim Miktarı` (not Hasat Edilen Alan, not Verim; yield is production ÷ area)
   - Ekiliş sayısı: `<Hepsi>`
   - Kuru/ Sulu ekiliş: `<Hepsi>`
   - Ürünler: `<Hepsi>` (27 crops on 3 pages: wheat, durum wheat, barley ×2, oats, triticale, maize, chickpea,
     dry bean, lentil ×2, soybean, groundnut, cotton seed, canola, sesame, sunflower ×2, safflower, rice, potato,
     sweet potato, cotton ×2, maize green fodder, silage maize)
   - Ölçü birimi: `Dekar` and `Ton`
   - Confirm the selection (green check mark), so "Seçilen gösterge adedi" is no longer 0.
5. **Düzey**: province level (`İl`), all 81 provinces. *(Written from the MEDAS layout; this tab opens only after step 4.)*
6. **Zaman**: two years per file: `2023, 2024` → file 1; `2021, 2022` → file 2; `2020` → file 3.
   Skip the provisional 2025 data. Check the 50,000 counter; if it is over, take one year per file.
7. **Rapor**: create the report and save it as Excel (or CSV).
8. Save as `tuik_kurusulu_2023_2024.xls`, `tuik_kurusulu_2021_2022.xls`, `tuik_kurusulu_2020.xls` in this folder.

## Export B: other field crops (no rain-fed split), 1 file

Same steps, but **Ölçüm** → `Tahıllar ve diğer bitkisel ürünler`; crops: şeker pancarı, tütün, çavdar, sorgum,
fiğ, yonca, korunga, bakla (kuru), bezelye (kuru) (whatever of these the list offers); measures: ekilen alan and
üretim; `İl`; years 2020–2024. Save as `tuik_diger_2020_2024.xls`.

## Export C: vegetables we model, 1 file

**Ölçüm** → `Sebzeler`; crops: soğan (kuru), karpuz, kavun, domates (salçalık/sanayi if listed, else domates);
measures: ekilen alan and üretim; `İl`; 2020–2024. Save as `tuik_sebze_2020_2024.xls`.

Units: TÜİK area is in dekar (1 dekar = 0.1 ha); production in tonnes. The import script converts.
After the files are here, add the source to `kaynakca.md` (done in the same change as the import script).
