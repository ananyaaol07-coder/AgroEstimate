import assert from 'node:assert/strict';
import {parseHistoryTable,historyCrop,historyKind} from '../history-results.js';
const text='Maize · Kharif · Irrigated · 1 Hectare\nFertilizer Quantity (kg) Rate / kg Estimated cost\nUrea 260 ₹6.00 ₹1,560.00\nSSP 375 ₹10.00 ₹3,750.00\nMOP 67 ₹20.00 ₹1,340.00\nTotal estimated cost: ₹6,650.00';
const result=parseHistoryTable(text);
assert.equal(result.rows.length,3);assert.equal(result.total,'6,650.00');
assert.deepEqual(result.rows[1],['SSP','375','₹10.00','₹3,750.00']);
assert.equal(historyCrop({text}),'Maize');
assert.equal(historyKind({title:'Fertilizer calculator'}),'fertilizer');
assert.equal(parseHistoryTable('unrecognized old record'),null);
assert.deepEqual(parseHistoryTable('Seed required\t20 kg\nRow spacing\t30 cm').rows,[['Seed required','20 kg'],['Row spacing','30 cm']]);
assert.deepEqual(parseHistoryTable('Expected yield per Hectare\t3500 kg').rows,[['Expected yield per Hectare','3500 kg']]);
const {historyTable}=await import('../history-results.js');
for(const kind of ['fertilizer','seed','yield']) {
 const table=historyTable({kind,crop:'Maize',areaHa:1,output:6650},'1 ha · Result: 6,650');
 assert.equal(table.rows[0][1],'Maize');
 assert.ok(table.rows.some(row=>row[1].includes('6,650')));
 assert.deepEqual(table.headers,['Measure','Value']);
}
assert.deepEqual(parseHistoryTable('Seed required\n20 kg\nRow spacing\n30 cm').rows,[['Seed required','20 kg'],['Row spacing','30 cm']]);
assert.deepEqual(parseHistoryTable('Estimated total production\n5000 kg\nEstimated total production in quintals\n50 q').rows,[['Estimated total production','5000 kg'],['Estimated total production in quintals','50 q']]);
assert.deepEqual(historyTable({text:'old text'},'old text').rows,[['Saved result','old text']]);
