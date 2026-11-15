// Short crop names for labels and evidence text. Variants that change the crop
// meaningfully (spring vs winter sowing) keep the qualifier: "spring wheat".
const KEEP = ["spring", "silage"];

export function shortName(crop) {
  const m = crop.name_en.match(/^(.*?) \(([^)]+)\)$/);
  if (m && KEEP.includes(m[2].toLowerCase())) return `${m[2]} ${m[1]}`.toLowerCase();
  return (m ? m[1] : crop.name_en).toLowerCase();
}

export const displayName = (crop) => {
  const s = shortName(crop);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
