import {areaUnits, hectareFactor} from './area-units.js';
export const headers = ['Crop', 'Season', 'Growing condition', 'Area unit', 'Urea (kg/unit)', 'SSP (kg/unit)', 'MOP (kg/unit)', 'Urea rate (INR/kg)', 'SSP rate (INR/kg)', 'MOP rate (INR/kg)'];
const fields = ['urea', 'ssp', 'mop', 'ureaRate', 'sspRate', 'mopRate'];
export const rowKey = row => JSON.stringify([row.crop.toLowerCase(), row.season.toLowerCase(), row.condition.toLowerCase(), row.unit]);

export function parseFertilizerRows(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) throw new Error('The Fertilizer sheet is empty.');
  const columns = matrix[0].map(value => String(value ?? '').trim());
  if (columns.length !== headers.length || headers.some((value, i) => columns[i].toLowerCase() !== value.toLowerCase())) {
    throw new Error('The column headings do not match. Please use the sample Excel format.');
  }
  const rows = [], keys = new Set();
  for (let index = 1; index < matrix.length; index++) {
    const values = matrix[index];
    if (values.every(value => value === '' || value == null)) continue;
    const label = `Row ${index + 1}`;
    if (values.length > headers.length) throw new Error(`${label}: unexpected extra columns.`);
    const [crop, season, condition, unit] = values.slice(0, 4).map(value => String(value ?? '').trim());
    if (!crop || !season || !condition || condition.length > 100 || crop.length > 100 || season.length > 100) throw new Error(`${label}: enter a crop and season (up to 100 characters).`);
    if (!areaUnits.some(entry => entry.value === unit.toLowerCase())) throw new Error(`${label}: area unit must be Hectare, Acre, Guntha or Are.`);
    const row = {crop, season, condition, unit: unit.toLowerCase()};
    fields.forEach((field, i) => {
      const value = values[i + 4];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${label}: ${headers[i + 4]} must be a non-negative number.`);
      row[field] = value;
    });
    const key = rowKey(row);
    if (keys.has(key)) throw new Error(`${label}: duplicate crop, season, growing condition and area unit.`);
    keys.add(key); rows.push(row);
  }
  if (!rows.length || rows.length > 200) throw new Error('Include between 1 and 200 data rows.');
  return rows;
}

export function calculateFertilizer(rows, crop, season, condition, unit, area) {
  if (!Number.isFinite(area) || area <= 0) throw new Error('Enter an area greater than zero.');
  hectareFactor(unit); // Reject unrecognized units rather than treating them as hectares.
  const matching = rows.filter(row => row.crop.toLowerCase() === crop.toLowerCase() && row.season.toLowerCase() === season.toLowerCase() && row.condition.toLowerCase() === condition.toLowerCase());
  // Prefer an explicit uploaded row. Older sheets can use their existing unit rows.
  const preferred = unit === 'guntha' ? ['acre', 'hectare', 'are'] : ['hectare', 'acre', 'guntha', 'are'];
  const row = matching.find(row => row.unit === unit)
    || preferred.map(value => matching.find(row => row.unit === value)).find(Boolean);
  if (!row) throw new Error('No fertilizer data is available for this crop, season, growing condition and area unit.');
  const items = ['urea', 'ssp', 'mop'].map(key => {
    const quantity = row[key] * area * (hectareFactor(unit) / hectareFactor(row.unit));
    const rate = row[`${key}Rate`];
    const cost = quantity * rate;
    if (![quantity, rate, cost].every(Number.isFinite)) throw new Error('These values are too large to calculate.');
    return {name: key === 'urea' ? 'Urea' : key.toUpperCase(), quantity, rate, cost};
  });
  const total = items.reduce((sum, item) => sum + item.cost, 0);
  if (!Number.isFinite(total)) throw new Error('These values are too large to calculate.');
  return {items, total};
}
