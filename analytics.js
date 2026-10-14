import {calculationEvent, summarizeCalculations} from './analytics-data.js';
import {historyCutoff} from './history-retention.js';
export function recordCalculation({api,db,auth}, kind, selection, area, result) {
  if (!auth.currentUser || !window.agriAuthenticated) return;
  try {
    const data = calculationEvent(kind,selection,area,result);
    const resultText=(document.getElementById(`${kind}-result`)?.innerText || '').trim().slice(0,5000);
    const created=new Date().toISOString();
    const eventRef=api.doc(api.collection(db,'calculationEvents'));
    try {
      const key = `agro:${auth.currentUser.uid}:history-v2`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      const cutoff=historyCutoff('3months').getTime();
      const entries = Array.isArray(saved) ? saved.filter(entry=>Date.parse(entry.date)>=cutoff) : [];
      entries.unshift({...data,id:eventRef.id,date:created,resultText});
      localStorage.setItem(key,JSON.stringify(entries.slice(0,200)));
    } catch { /* Browser storage may be unavailable; cloud tracking still runs. */ }
    api.setDoc(eventRef,{...data,resultText,uid:auth.currentUser.uid,createdAt:api.serverTimestamp()})
      .catch(error=>console.warn('Calculation history could not be saved:',error.code));
  } catch (error) { console.warn('Calculation analytics skipped:',error.message); }
}
const format = value => value == null ? '—' : value.toLocaleString('en-IN',{maximumFractionDigits:2});
export async function cleanupOldCalculations({api,db}) {
  // A small batch per dashboard visit keeps cleanup bounded on the free plan.
  // 366 days preserves a full year even across leap years.
  const cutoff=new Date(Date.now()-366*86400000);
  const query=api.query(api.collection(db,'calculationEvents'),api.where('createdAt','<',cutoff),api.orderBy('createdAt','asc'),api.limit(100));
  const snapshot=await api.getDocsFromServer(query);
  if(!snapshot.docs.length) return;
  const batch=api.writeBatch(db);
  for(const document of snapshot.docs) batch.delete(document.ref);
  await batch.commit();
}
function bars(target, entries, showZeroValues = false) {
  target.replaceChildren();
  if (!entries.length || (!showZeroValues && !entries.some(([,value])=>value))) { target.textContent='No activity recorded in this period.'; return; }
  const max = Math.max(...entries.map(([,value])=>value),1);
  for (const [label,value] of entries) {
    const row=document.createElement('div'); row.className='analytics-bar-row';
    const name=document.createElement('span'); name.textContent=label;
    const track=document.createElement('span'); track.className='analytics-track'; track.setAttribute('aria-hidden','true');
    const fill=document.createElement('span'); fill.style.width=`${value/max*100}%`; track.append(fill);
    const number=document.createElement('strong'); number.textContent=format(value);
    row.append(name,track,number); target.append(row);
  }
}
export function setupAnalytics({api,db,auth}) {
  const root=document.getElementById('admin-analytics');
  if (!root || root.dataset.ready) return;
  root.dataset.ready='true';
  cleanupOldCalculations({api,db}).catch(error=>console.warn('Old calculation cleanup could not finish:',error.code));
  const period=document.getElementById('analytics-period');
  const status=document.getElementById('analytics-status');
  const refresh=document.getElementById('analytics-refresh');
  const currentUid=auth.currentUser?.uid;
  let request=0;
  const set=(id,value)=>{document.getElementById(id).textContent=format(value);};
  function renderProfiles(profiles) {
    set('metric-users',profiles.length);
    // Registration dates are profile creation dates, which are available for existing accounts.
    const registrationStart = new Date(2026,9,1);
    const now = new Date();
    const monthCount = Math.max(1,(now.getFullYear()-2026)*12+now.getMonth()-9+1);
    const months=Array.from({length:monthCount},(_,i)=>new Date(registrationStart.getFullYear(),registrationStart.getMonth()+i,1));
    bars(document.getElementById('registration-chart'),months.map((date,i)=>[
      date.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}),
      profiles.filter(profile=>{const time=profile.createdAt?.toDate?.(); return time && time>=date && time<(months[i+1] || new Date(date.getFullYear(),date.getMonth()+1,1));}).length
    ]), true);
  }
  const profileStatus=document.getElementById('profile-status');
  let stopProfiles;
  function watchProfiles() {
    stopProfiles?.();
    set('metric-users',null);
    document.getElementById('registration-chart').replaceChildren();
    profileStatus.textContent='Loading current profiles…';
    stopProfiles=api.onSnapshot(api.collection(db,'users'),{includeMetadataChanges:true},snapshot=>{
      if(auth.currentUser?.uid!==currentUid || !window.agriAuthenticated) return;
      if(snapshot.metadata.fromCache) {
        set('metric-users',null);
        document.getElementById('registration-chart').replaceChildren();
        profileStatus.textContent='Waiting for current profiles from Firebase…';
        return;
      }
      renderProfiles(snapshot.docs.map(entry=>entry.data()));
      profileStatus.textContent='';
    },()=>{
      set('metric-users',null);
      document.getElementById('registration-chart').replaceChildren();
      profileStatus.textContent='Could not load current profiles. Check your connection and click Refresh.';
    });
  }
  watchProfiles();
  const stopAuth=api.onAuthStateChanged(auth,user=>{
    if(user?.uid!==currentUid) {
      stopProfiles?.();
      set('metric-users',null);
      document.getElementById('registration-chart').replaceChildren();
    }
  });
  window.addEventListener('pagehide',()=>{stopProfiles?.();stopAuth();},{once:true});
  async function load() {
    const version=++request;
    refresh.disabled=true; status.textContent='Loading calculation activity…';
    for (const id of ['metric-calculations','metric-active','metric-area']) set(id,null);
    for (const id of ['usage-chart','crop-chart','average-results']) document.getElementById(id).replaceChildren();
    try {
      const since=historyCutoff(period.value,new Date(),12);
      const documents=[];
      let cursor=null;
      do {
        const constraints=[api.where('createdAt','>=',since),api.orderBy('createdAt','desc'),api.limit(10000)];
        if(cursor) constraints.push(api.startAfter(cursor));
        const query=api.query(api.collection(db,'calculationEvents'),...constraints);
        const page=await api.getDocsFromServer(query);
        documents.push(...page.docs);
        cursor=page.size===10000?page.docs.at(-1):null;
      } while(cursor);
      if (version!==request || auth.currentUser?.uid!==currentUid || !window.agriAuthenticated) return;
      const summary=summarizeCalculations(documents.map(doc=>doc.data()));
      set('metric-calculations',summary.count); set('metric-active',summary.active); set('metric-area',summary.averageArea);
      bars(document.getElementById('usage-chart'),Object.entries(summary.kinds).map(([kind,data])=>[kind==='seed'?'Seed & spacing':kind==='yield'?'Yield':'Fertilizer',data.count]));
      bars(document.getElementById('crop-chart'),summary.crops.map(crop=>[crop.name,crop.count]));
      const averages=document.getElementById('average-results');
      for (const [kind,label,unit] of [['fertilizer','Average fertilizer cost','₹/ha'],['seed','Average seed required','kg/ha'],['yield','Average estimated yield','kg/ha']]) {
        const data=summary.kinds[kind];
        const item=document.createElement('div'); item.className='analytics-average';
        const title=document.createElement('h3'); title.textContent=label;
        const value=document.createElement('strong'); value.textContent=data.area?`${format(data.output/data.area)} ${unit}`:'—';
        item.append(title,value); averages.append(item);
      }
      status.textContent='';
    } catch (error) {
      if(version!==request) return;
      console.error('Calculation analytics load failed:', error);
      const messages = {
        'permission-denied':'Calculation analytics access was denied. Publish the updated Firestore rules and sign in as an administrator.',
        'unavailable':'Firebase is temporarily unreachable. Check your internet connection and refresh.',
        'failed-precondition':'Firebase could not run the analytics query. Check the database index configuration.',
        'unauthenticated':'Your session has expired. Sign in again to load analytics.'
      };
      status.textContent=messages[error.code] || `Could not load calculation activity: ${error.message || error.code || 'Unknown error'}`;
    } finally {if(version===request) refresh.disabled=false;}
  }
  period.addEventListener('change',load); refresh.addEventListener('click',()=>{watchProfiles();load();}); load();
}
