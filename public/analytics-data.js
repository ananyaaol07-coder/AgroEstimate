import {hectareFactor} from './area-units.js';
export function calculationEvent(kind, selection, area, result) {
  const areaHa = area * hectareFactor(selection.unit);
  const output = kind === 'fertilizer' ? result.total : kind === 'seed' ? result.quantity : result.total;
  if (!['fertilizer','seed','yield'].includes(kind) || ![areaHa, output].every(Number.isFinite) || areaHa <= 0 || output < 0) throw new Error('Invalid analytics result.');
  const crop=String(selection.crop || '').trim();
  const season=String(selection.season || '').trim();
  const condition=String(selection.condition || '').trim();
  const unit=String(selection.unit || '').trim().toLowerCase();
  if (!crop || !season || !condition || !unit || !Number.isFinite(area) || area <= 0) throw new Error('Invalid calculation details.');
  return {kind,crop,season,condition,unit,area,areaHa,output};
}
export function summarizeCalculations(events) {
  const kinds = Object.fromEntries(['fertilizer','seed','yield'].map(kind => [kind,{count:0, area:0, output:0}]));
  const crops = new Map(), users = new Set();
  for (const event of events) {
    if (!kinds[event.kind] || !Number.isFinite(event.areaHa) || event.areaHa <= 0 || !Number.isFinite(event.output) || event.output < 0) continue;
    const bucket = kinds[event.kind];
    bucket.count++; bucket.area += event.areaHa; bucket.output += event.output;
    const key = event.crop.trim().toLowerCase();
    const crop = crops.get(key) || {name:event.crop.trim(), count:0};
    crop.count++; crops.set(key,crop); users.add(event.uid);
  }
  const count = Object.values(kinds).reduce((sum,b) => sum+b.count,0);
  const area = Object.values(kinds).reduce((sum,b) => sum+b.area,0);
  return {kinds, crops:[...crops.values()].sort((a,b)=>b.count-a.count), count, active:users.size, averageArea:count ? area/count : null};
}
