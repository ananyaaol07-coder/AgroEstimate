import {englishDigits} from './number-language.js';
const normalize=value=>englishDigits(value??'').trim().replace(/\s+/g,' ').toLowerCase();
const body=entry=>normalize(entry.resultText||entry.text||'');
export function distinctCalculations(records) {
 const keys=new Set();
 const unique=[...records].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).filter(entry=>{
  // Keep different inputs or detailed results, even when their totals happen to match.
  const key=JSON.stringify([entry.kind,normalize(entry.crop),normalize(entry.season),normalize(entry.condition),entry.unit,entry.area,entry.areaHa,entry.output,body(entry)]);
  if(keys.has(key))return false;
  keys.add(key);return true;
 });
 // Early tracking saved only kind, crop, area and total. Hide that summary
 // when exactly one matching detailed calculation exists; never invent details.
 return unique.filter(entry=>{
  if(body(entry))return true;
  const matches=unique.filter(other=>body(other) && other.kind===entry.kind &&
   normalize(other.crop)===normalize(entry.crop) && other.areaHa===entry.areaHa && other.output===entry.output &&
   ['season','condition','unit','area'].every(field=>entry[field]==null || entry[field]==='' || normalize(entry[field])===normalize(other[field])));
  return matches.length!==1;
 });
}
export function distinctLegacy(records,structured=[]) {
 const seen=new Set(structured.map(body).filter(Boolean));
 return [...records].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).filter(entry=>{
  const key=body(entry);
  if(!key)return true;
  if(seen.has(key))return false;
  seen.add(key);return true;
 });
}
