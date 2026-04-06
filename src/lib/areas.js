export const AREA_OPTIONS = [
  "A101",
  "A102",
  "A109",
  "A110",
  "A111",
  "A113",
  "A114",
  "A117",
  "A301",
  "A303",
  "A304",
  "A305",
  "A306",
  "A403",
  "A406",
  "A407",
  "A408",
  "A412",
  "A413",
  "A414",
  "A420",
];

const AREA_INDEX = new Map(AREA_OPTIONS.map((area, index) => [area, index]));

export function sortAreas(values) {
  return [...values].sort((a, b) => {
    const aIndex = AREA_INDEX.has(a) ? AREA_INDEX.get(a) : Number.MAX_SAFE_INTEGER;
    const bIndex = AREA_INDEX.has(b) ? AREA_INDEX.get(b) : Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) return aIndex - bIndex;
    return String(a).localeCompare(String(b));
  });
}
