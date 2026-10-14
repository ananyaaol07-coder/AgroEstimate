import assert from 'node:assert/strict';
import fs from 'node:fs';
import {translate,marathi} from '../translations.js';
for(const [english,translated] of Object.entries(marathi)) {
 assert.ok(translated && /[\u0900-\u097f]/.test(translated),english);
 assert.equal(translate(english,'en'),english);
 assert.equal(translate(english,'mr'),translated,english);
}
for(const file of fs.readdirSync(new URL('../',import.meta.url)).filter(file=>file.endsWith('.html'))) {
 const html=fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
 assert.ok(html.includes('i18n.js'),file);
 for(const match of html.matchAll(/>([^<>]+)</g)) {
  const text=match[1].trim().replaceAll('&amp;','&');
  if(!/[A-Za-z]/.test(text) || text==='AgroEstimate' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))continue;
  assert.notEqual(translate(text),text,`${file}: ${text}`);
 }
}
assert.equal(translate('Maize · Kharif · Irrigated · 1 Hectare'),'मका · खरीप · बागायती · 1 हेक्टर');
assert.equal(translate('Total estimated cost: ₹6,650.00'),'एकूण अंदाजित खर्च: ₹6,650.00');
assert.equal(translate('Download uploaded data: Rice.xlsx'),'अपलोड केलेली माहिती डाउनलोड करा: Rice.xlsx');
assert.equal(translate('Expected yield per Acre'),'प्रति एकर अपेक्षित उत्पादन');
assert.equal(translate('User Supplied Crop'),'User Supplied Crop');
assert.equal(translate('Urea\t260\t₹6.00'),'युरिया\t260\t₹6.00');
console.log('Translations: static pages, dynamic results, units, filenames, and English fallback verified.');
