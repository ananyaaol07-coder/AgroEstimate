// International acre; Maharashtra convention: 40 guntha per acre.
export const areaUnits = [
  {value: 'hectare', label: 'Hectare', hectares: 1},
  {value: 'acre', label: 'Acre', hectares: 0.40468564224},
  {value: 'guntha', label: 'Guntha', hectares: 0.40468564224 / 40},
  {value: 'are', label: 'Are', hectares: 0.01}
];
export function hectareFactor(unit) {
  const match = areaUnits.find(entry => entry.value === unit);
  if (!match) throw new Error('Unknown area unit.');
  return match.hectares;
}
export function areaUnitLabel(unit) {
  return areaUnits.find(entry => entry.value === unit)?.label || unit;
}
