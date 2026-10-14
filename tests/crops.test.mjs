import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {cropConfigs,parseCropRows,calculateCrop} from '../crop-data.js';
const XLSX = createRequire(import.meta.url)('../vendor/xlsx.full.min.js');
const selection = {crop:'Maize',season:'Kharif',condition:'Irrigated',unit:'hectare'};
for (const kind of ['seed','yield']) {
  const config = cropConfigs[kind];
  const book = XLSX.read(readFileSync(new URL(`./fixtures/${kind}_dummy.xlsx`,import.meta.url)),{type:'buffer'});
  const matrix = XLSX.utils.sheet_to_json(book.Sheets[config.sheet],{header:1,defval:'',raw:true});
  const rows = parseCropRows(kind,matrix);
  assert.equal(rows.length,120);
  assert.equal(new Set(rows.map(row=>row.crop)).size,5);
  const answer = calculateCrop(kind,rows,selection,2);
  if (kind === 'seed') {
    assert.equal(answer.quantity,40);
    assert.equal(answer.rowSpacing,60);
    assert.ok(Math.abs(answer.population-166666.66666666666)<1e-8);
    const wheat = calculateCrop(kind,rows,{...selection,crop:'Wheat'},1);
    assert.equal(wheat.plantSpacing,'Continuous sowing'); assert.equal(wheat.population,null);
  } else {
    assert.equal(answer.total,10000); assert.equal(answer.quintals,100);
    assert.equal(calculateCrop(kind,rows,{...selection,crop:'Soybean'},2).total,4000);
    assert.equal(calculateCrop(kind,rows,{...selection,condition:'Rainfed'},2).total,8000);
    assert.equal(calculateCrop(kind,rows,{...selection,season:'Rabi'},2).total,9000);
  }
  const field = kind === 'seed' ? 'quantity':'total';
  assert.equal(calculateCrop(kind,rows,{...selection,unit:'are'},200)[field],answer[field]);
  const acres = calculateCrop(kind,rows,{...selection,unit:'acre'},1)[field];
  const guntha = calculateCrop(kind,rows,{...selection,unit:'guntha'},40)[field];
  assert.ok(Math.abs(acres-guntha)<0.0001);
  const legacy = rows.filter(row=>row.unit === 'hectare');
  assert.equal(calculateCrop(kind,legacy,{...selection,unit:'are'},200)[field],answer[field]);
  for (const area of [0,-1,NaN,Infinity]) assert.throws(()=>calculateCrop(kind,rows,selection,area));
  assert.throws(()=>calculateCrop(kind,rows,{...selection,crop:'Missing'},1),/No data/);
  assert.throws(()=>parseCropRows(kind,[matrix[0],matrix[1],matrix[1]]),/duplicate/);
  for (const value of ['',-1,'10',Infinity]) {
    const invalid = [...matrix[1]]; invalid[4] = value;
    assert.throws(()=>parseCropRows(kind,[matrix[0],invalid]),/invalid/);
  }
  if (kind === 'seed') {
    const invalid = [...matrix[1]]; invalid[5] = 0;
    assert.throws(()=>parseCropRows(kind,[matrix[0],invalid]),/invalid/);
  }
}
console.log('Passed: both actual Excel imports, 240 rows, five crops, seed/spacing and yield formulas, area units, seasons, conditions, invalid rows and continuous sowing.');
