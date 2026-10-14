import {englishDigits} from './number-language.js';
export function historyKind(entry) {
 if(entry.kind)return entry.kind;
 const title=(entry.title||'').toLowerCase();
 return title.includes('fertilizer')?'fertilizer':title.includes('seed')?'seed':title.includes('yield')?'yield':'';
}
export function historyCrop(entry) {
 if(entry.crop)return entry.crop;
 const line=(entry.resultText||entry.text||'').split('\n').find(line=>line.includes(' · '));
 return line?.split(' · ')[0]?.trim()||'';
}
export function parseHistoryTable(text) {
 const source=englishDigits(text);
 const fertilizer=[...source.matchAll(/\b(Urea|SSP|MOP)\s+([\d,.]+)\s+₹\s*([\d,.]+)\s+₹\s*([\d,.]+)/g)];
 if(fertilizer.length===3)return {headers:['Fertilizer','Quantity (kg)','Rate / kg','Estimated cost'],rows:fertilizer.map(m=>[m[1],m[2],`₹${m[3]}`,`₹${m[4]}`]),total:source.match(/Total estimated cost:\s*₹\s*([\d,.]+)/)?.[1]};
 const labels='Seed required|Row spacing|Plant spacing|Estimated plant population|Expected yield per [^\\n\\t]+?|Estimated total production in quintals|Estimated total production';
 const pattern=new RegExp(`(${labels})[\\s:]+(Not calculated for continuous sowing|Continuous sowing|[\\d,.]+(?:[ \\t]*(?:kg|cm|plants|q))?)`,'g');
 const rows=[...source.matchAll(pattern)].map(m=>[m[1],m[2]]);
 return rows.length?{headers:['Measure','Value'],rows}:null;
}

// Older records may contain only a total. Present the data actually saved,
// without reconstructing historical quantities from today's uploaded rates.
export function historyTable(entry,text) {
 const parsed=parseHistoryTable(text);
 if(parsed)return parsed;
 const format=value=>value.toLocaleString('en-IN',{maximumFractionDigits:2});
 const rows=[];
 if(historyCrop(entry))rows.push(['Crop',historyCrop(entry)]);
 if(entry.season)rows.push(['Season',entry.season]);
 if(entry.condition)rows.push(['Growing condition',entry.condition]);
 if(Number.isFinite(entry.areaHa))rows.push(['Area',`${format(entry.areaHa)} ha`]);
 if(Number.isFinite(entry.output)) {
  const kind=historyKind(entry);
  rows.push([kind==='fertilizer'?'Total estimated cost':kind==='seed'?'Seed required':'Estimated total production',kind==='fertilizer'?`₹${format(entry.output)}`:`${format(entry.output)} kg`]);
 } else rows.push(['Saved result',text]);
 return {headers:['Measure','Value'],rows};
}
