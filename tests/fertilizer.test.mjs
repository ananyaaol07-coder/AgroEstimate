import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {headers, parseFertilizerRows, calculateFertilizer} from '../fertilizer-data.js';
const require = createRequire(import.meta.url);
const XLSX = require('../vendor/xlsx.full.min.js');
const workbook = XLSX.read(readFileSync(new URL('./fixtures/fertilizer_dummy.xlsx', import.meta.url)), {type:'buffer'});
const matrix = XLSX.utils.sheet_to_json(workbook.Sheets.Fertilizer, {header:1, defval:'', raw:true});
const rows = parseFertilizerRows(matrix);
assert.equal(rows.length,120);
const ha = calculateFertilizer(rows, 'Maize', 'Kharif', 'Irrigated', 'hectare', 2);
assert.deepEqual(ha.items.map(item=>item.quantity),[520,750,134]);
assert.equal(ha.total,13300);
const acre = calculateFertilizer(rows, 'Maize', 'Kharif', 'Irrigated', 'acre', 2);
assert.equal(acre.items[0].quantity,210.44); // Stored acre quantity, no second conversion.
assert.equal(calculateFertilizer(rows, 'Maize', 'Kharif', 'Rainfed', 'hectare', 2).items[0].quantity,416);
assert.equal(calculateFertilizer(rows, 'Maize', 'Rabi', 'Irrigated', 'hectare', 2).items[0].quantity,468);
assert.throws(()=>calculateFertilizer(rows,'Missing','Rabi','Irrigated','hectare',1),/No fertilizer data/);
for (const area of [0,-1,NaN,Infinity]) assert.throws(()=>calculateFertilizer(rows,'Maize','Kharif','Irrigated','hectare',area));
assert.throws(()=>parseFertilizerRows([headers,matrix[1],matrix[1]]),/duplicate/);
for (const invalid of ['',-1,'6',Infinity]) {
  const row = [...matrix[1]]; row[7] = invalid;
  assert.throws(()=>parseFertilizerRows([headers,row]),/non-negative number/);
}
assert.throws(()=>parseFertilizerRows([['Wrong header'],matrix[1]]),/headings/);
const free = [...matrix[1]]; free[7] = 0;
assert.equal(parseFertilizerRows([headers,free])[0].ureaRate,0);
console.log('Passed: actual XLSX import, all 120 rows, quantities, unit/season/condition lookup, prices, totals, and invalid data rejection.');

const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
const guntha = calculateFertilizer(rows,'Maize','Kharif','Irrigated','guntha',80);
close(guntha.total,acre.total);
const are = calculateFertilizer(rows,'Maize','Kharif','Irrigated','are',200);
close(are.total,ha.total);
const legacy = rows.filter(row=>['hectare','acre'].includes(row.unit));
close(calculateFertilizer(legacy,'Maize','Kharif','Irrigated','guntha',80).total,acre.total);
close(calculateFertilizer(legacy,'Maize','Kharif','Irrigated','are',200).total,ha.total);
const {hectareFactor} = await import('../area-units.js');
close(hectareFactor('guntha')*40,hectareFactor('acre'));
close(hectareFactor('are')*100,hectareFactor('hectare'));
assert.notEqual(hectareFactor('guntha'),hectareFactor('are'));
assert.throws(()=>hectareFactor('invalid'));
console.log('Passed: Guntha/Are conversions and legacy spreadsheet compatibility.');
