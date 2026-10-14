import {areaUnits, hectareFactor} from './area-units.js';
const common = ['Crop', 'Season', 'Growing condition', 'Area unit'];
export const cropConfigs = {
  seed: {sheet: 'Seed', title: 'Seed rate & spacing', headers: [...common, 'Seed quantity (kg/unit)', 'Row spacing (cm)', 'Plant spacing (cm)'], fields: ['seedQuantity', 'rowSpacing', 'plantSpacing']},
  yield: {sheet: 'Yield', title: 'Yield estimation', headers: [...common, 'Expected yield (kg/unit)'], fields: ['expectedYield']}
};
export const cropRowValues = (kind, row) => [row.crop, row.season, row.condition, row.unit, ...cropConfigs[kind].fields.map(field => row[field])];
export function parseCropRows(kind, matrix) {
  const config = cropConfigs[kind];
  if (!config || !matrix.length || matrix[0].length !== config.headers.length || config.headers.some((value, i) => value.toLowerCase() !== String(matrix[0][i] ?? '').trim().toLowerCase())) throw new Error('The column headings do not match the sample Excel format.');
  const rows = [], keys = new Set();
  matrix.slice(1).forEach((values, index) => {
    if (values.every(value => value === '' || value == null)) return;
    const label = `Row ${index + 2}`;
    if (values.length > config.headers.length) throw new Error(`${label}: unexpected extra columns.`);
    const [crop, season, condition, unit] = [0,1,2,3].map(i => String(values[i] ?? '').trim());
    if ([crop,season,condition].some(value=>!value || value.length > 100)) throw new Error(`${label}: enter crop, season and growing condition.`);
    if (!areaUnits.some(entry=>entry.value === unit.toLowerCase())) throw new Error(`${label}: use Hectare, Acre, Guntha or Are.`);
    const row = {crop,season,condition,unit:unit.toLowerCase()};
    config.fields.forEach((field,i)=> {
      const value = values[i+4];
      if (field === 'plantSpacing' && String(value).trim().toLowerCase() === 'continuous sowing') { row[field] = 'Continuous sowing'; return; }
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (field.includes('Spacing') && value === 0)) throw new Error(`${label}: invalid ${config.headers[i+4]}. Use a numeric value${field === 'plantSpacing' ? ' or Continuous sowing' : ''}.`);
      row[field] = value;
    });
    const key = JSON.stringify([crop.toLowerCase(),season.toLowerCase(),condition.toLowerCase(),row.unit]);
    if (keys.has(key)) throw new Error(`${label}: duplicate crop, season, condition and unit.`);
    keys.add(key); rows.push(row);
  });
  if (!rows.length || rows.length > 200) throw new Error('Include between 1 and 200 data rows.');
  return rows;
}
export function calculateCrop(kind, rows, selection, area) {
  if (!Number.isFinite(area) || area <= 0) throw new Error('Enter an area greater than zero.');
  const factor = hectareFactor(selection.unit);
  const matching = rows.filter(row=>['crop','season','condition'].every(key=>row[key].toLowerCase() === selection[key].toLowerCase()));
  const preferred = selection.unit === 'guntha' ? ['acre','hectare','are'] : ['hectare','acre','guntha','are'];
  const row = matching.find(row=>row.unit === selection.unit) || preferred.map(unit=>matching.find(row=>row.unit === unit)).find(Boolean);
  if (!row) throw new Error('No data is available for this selection.');
  const scale = factor / hectareFactor(row.unit);
  let result;
  if (kind === 'seed') {
    result = {quantity:row.seedQuantity * scale * area, rowSpacing:row.rowSpacing, plantSpacing:row.plantSpacing,
      population: typeof row.plantSpacing === 'number' ? 100000000 * factor * area / (row.rowSpacing * row.plantSpacing) : null};
  } else if (kind === 'yield') {
    const perUnit = row.expectedYield * scale;
    result = {perUnit, total:perUnit * area, quintals:perUnit * area / 100};
  } else throw new Error('Unknown calculator.');
  if (Object.values(result).some(value=>typeof value === 'number' && !Number.isFinite(value))) throw new Error('These values are too large to calculate.');
  return result;
}
