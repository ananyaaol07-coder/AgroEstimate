import {historyTable,historyKind,historyCrop} from './history-results.js?v=all-tables-2';
import {distinctCalculations,distinctLegacy} from './history-distinct.js?v=legacy-2';
import {summarizeCalculations} from './analytics-data.js';
import {historyCutoff} from './history-retention.js';
const names={fertilizer:'Fertilizer',seed:'Seed & spacing',yield:'Yield estimation'};
const number=value=>value==null?'—':value.toLocaleString('en-IN',{maximumFractionDigits:2});
function node(tag,text) { const el=document.createElement(tag);el.textContent=text;return el; }
function resultText(entry) {
  const fallback=`${number(entry.areaHa)} ha · Result: ${number(entry.output)} ${entry.kind==='fertilizer'?'₹':'kg'}`;
  const savedText=entry.resultText || entry.text || '';
  if (!savedText.trim()) return fallback;
  const lines=savedText.trim().split(/\n+/).map(line=>line.trim()).filter(Boolean);
  const repeated=[entry.title,names[entry.kind],'Fertilizer quantities and estimated cost','Seed rate & spacing results','Yield estimation']
    .filter(Boolean).map(value=>value.toLowerCase());
  while(lines.length && repeated.some(value=>lines[0].toLowerCase()===value)) lines.shift();
  return lines.join('\n') || fallback;
}
function bars(id,entries) {
  const box=document.getElementById(id);box.replaceChildren();
  const max=Math.max(0,...entries.map(entry=>entry[1]));
  if (!max) {box.textContent='No calculations in this period yet.';return;}
  for(const [label,count] of entries) {
    const row=node('div','');row.className='analytics-bar-row';
    const track=node('span','');track.className='analytics-track';track.setAttribute('aria-hidden','true');
    const fill=node('span','');fill.style.width=`${count/max*100}%`;track.append(fill);
    row.append(node('span',label),track,node('strong',number(count)));box.append(row);
  }
}
function entries(id,records) {
  const box=document.getElementById(id);box.replaceChildren();
  if(!records.length) {box.textContent='No calculations saved for this period. Try one of the calculators to get started.';return;}
  for(const entry of records) {
    const item=node('details','');item.className='history-entry';
    const date=new Date(entry.date).toLocaleString('en-IN');
    item.append(node('summary',`${entry.crop ? entry.crop+' · ' : ''}${names[entry.kind] || entry.title || 'Calculation'} · ${date}`));
    const content=resultText(entry),parsed=historyTable(entry,content);
    if(parsed) {
      const context=content.split('\n').find(line=>line.includes(' · '));
      if(context)item.append(node('p',context));
      const wrapper=node('div','');wrapper.className='table-scroll';
      const table=node('table','');const head=table.createTHead().insertRow();
      for(const title of parsed.headers){const cell=node('th',title);cell.scope='col';head.append(cell);}
      const body=table.createTBody();
      for(const row of parsed.rows){const tr=body.insertRow();for(const value of row)tr.insertCell().textContent=value;}
      wrapper.append(table);item.append(wrapper);
      if(parsed.total)item.append(node('p',`Total estimated cost: ₹${parsed.total}`));
      const note=content.split('\n').find(line=>line.startsWith('Estimate =')||line.startsWith('Seed quantity uses'));
      if(note)item.append(node('p',note));
    } else {
      const text=node('p',content);text.className='history-text';item.append(text);
    }
    box.append(item);
  }
}
export async function setupHistory({api,db,auth},uid) {
  const read=key=>{const data=JSON.parse(localStorage.getItem(`agro:${uid}:${key}`)||'[]');return Array.isArray(data)?data:[];};
  const scope=document.getElementById('history-scope');
  let cloudRecords=[];
  let cloudAvailable=true;
  try {
    const query=api.query(api.collection(db,'calculationEvents'),api.where('uid','==',uid));
    const snapshot=await api.getDocsFromServer(query);
    if(auth.currentUser?.uid!==uid || !window.agriAuthenticated) return;
    cloudRecords=snapshot.docs.map(document=>{
      const data=document.data();
      const timestamp=data.createdAt?.toDate?.();
      return {...data,id:document.id,date:timestamp?.toISOString?.() || ''};
    }).filter(entry=>Number.isFinite(Date.parse(entry.date)));
  } catch(error) {
    cloudAvailable=false;
    console.error('Cloud history could not be loaded:',error);
  }
  function structuredRecords() {
    const local=read('history-v2');
    const combined=[...cloudRecords];
    const cloudIds=new Set(cloudRecords.map(entry=>entry.id));
    for(const entry of local) {
      if(entry.id && cloudIds.has(entry.id)) continue;
      combined.push(entry);
    }
    return combined;
  }
  const period=document.getElementById('history-period');
  const kindFilter=document.getElementById('history-kind');
  const cropFilter=document.getElementById('history-crop');
  const allCrops=[...new Set([...structuredRecords(),...read('history')].map(historyCrop).filter(Boolean))].sort();
  for(const crop of allCrops)cropFilter.add(new Option(crop,crop));
  const overviewPanel=document.getElementById('history-overview');
  const recentPanel=document.getElementById('recent-history');
  const overviewTab=document.getElementById('history-overview-tab');
  const recentTab=document.getElementById('recent-history-tab');
  function openPanel(panel) {
    const showOverview=panel==='overview';
    const showRecent=panel==='recent';
    overviewPanel.hidden=!showOverview;
    recentPanel.hidden=!showRecent;
    overviewTab.classList.toggle('is-active',showOverview);
    recentTab.classList.toggle('is-active',showRecent);
    overviewTab.setAttribute('aria-expanded',String(showOverview));
    recentTab.setAttribute('aria-expanded',String(showRecent));
  }
  overviewTab.addEventListener('click',()=>openPanel('overview'));
  recentTab.addEventListener('click',()=>openPanel('recent'));
  function render() {
    let records=[],legacy=[];
    try {
      records=structuredRecords().filter(e=>names[e.kind] && typeof e.crop==='string' && Number.isFinite(e.areaHa) && e.areaHa>0 && Number.isFinite(e.output) && e.output>=0 && Number.isFinite(Date.parse(e.date)));
      legacy=read('history').filter(e=>typeof e.text==='string' && Number.isFinite(Date.parse(e.date)));
      scope.textContent=cloudAvailable?'Your calculations from the last 3 months.':'Cloud history is temporarily unavailable. Showing cached calculations from the last 3 months.';
    } catch {scope.textContent='Your browser history could not be read. Browser storage may be blocked or damaged.';}
    const cutoff=historyCutoff(period.value).getTime();
    records=distinctCalculations(records.filter(e=>Date.parse(e.date)>=cutoff));
    legacy=distinctLegacy(legacy.filter(e=>Date.parse(e.date)>=cutoff),records);
    const matches=entry=>(!kindFilter.value||historyKind(entry)===kindFilter.value)&&(!cropFilter.value||historyCrop(entry)===cropFilter.value);
    records=records.filter(matches);legacy=legacy.filter(matches);
    const stats=summarizeCalculations(records);
    const metrics=document.getElementById('history-metrics');metrics.replaceChildren();
    const top=stats.crops[0];
    for(const [title,value] of [['Calculations',number(stats.count)],['Distinct crops',number(stats.crops.length)],['Most calculated crop',top?top.name:'—'],['Average area · ha',number(stats.averageArea)]]) {
      const card=node('div','');card.append(node('span',title),node('strong',value));metrics.append(card);
    }
    bars('history-crops',stats.crops.map(c=>[c.name,c.count]));
    bars('history-usage',Object.entries(stats.kinds).map(([kind,data])=>[names[kind],data.count]));
    const averages=document.getElementById('history-averages');averages.replaceChildren();
    for(const [kind,title,unit] of [['fertilizer','Average fertilizer cost','₹/ha'],['seed','Average seed required','kg/ha'],['yield','Average estimated yield','kg/ha']]) {
      const data=stats.kinds[kind],card=node('div','');card.className='analytics-average';
      card.append(node('h3',title),node('strong',data.area?`${number(data.output/data.area)} ${unit}`:'—'));averages.append(card);
    }
    entries('history-list',[...records,...legacy].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)));
    for(const id of ['history-expand-all','history-collapse-all'])document.getElementById(id).disabled=records.length+legacy.length===0;
  }
  for(const [id,open] of [['history-expand-all',true],['history-collapse-all',false]]) {
    document.getElementById(id).addEventListener('click',()=>{
      document.querySelectorAll('#history-list details').forEach(entry=>{entry.open=open;});
    });
  }
  for(const filter of [period,kindFilter,cropFilter])filter.addEventListener('change',render);
  window.addEventListener('storage',event=>{if(event.key?.startsWith(`agro:${uid}:`))render();});
  render();
}
