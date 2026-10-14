import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
const mode=process.argv[2]||'static';
const report={mode,startedAt:new Date().toISOString(),stages:[]};
async function request(url,options={}){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(20000)});
 const body=await response.text();
 if(!response.ok)throw Error(`${response.status}: ${body.slice(0,180)}`);
 return body?(()=>{try{return JSON.parse(body)}catch{return body}})():null;
}
async function stage(concurrency,count,job){
 const times=[],errors=[];let next=0,passed=0;const start=performance.now();
 await Promise.all(Array.from({length:concurrency},async()=>{
  while(next<count){const index=next++,at=performance.now();try{await job(index);passed++;}catch(error){errors.push(String(error.message)+(error.cause?.code?' ('+error.cause.code+')':''));}times.push(performance.now()-at);}
 }));
 times.sort((a,b)=>a-b);const seconds=(performance.now()-start)/1000;
 const result={concurrency,attempts:count,passed,failed:errors.length,seconds:+seconds.toFixed(2),journeysPerSecond:+(count/seconds).toFixed(2),p50ms:Math.round(times[Math.ceil(times.length*.5)-1]),p95ms:Math.round(times[Math.ceil(times.length*.95)-1]),maxMs:Math.round(times.at(-1)),errors:[...new Set(errors)].slice(0,5)};
 report.stages.push(result);console.log(JSON.stringify(result));
}
if(mode==='static'){
 const base='http://127.0.0.1:8000';const pages=['index.html','register.html','login.html'];
 const bundles=await Promise.all(pages.map(async page=>{
  const html=await fs.readFile(new URL('../../'+page,import.meta.url),'utf8');
  const urls=[...new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(u=>!u.includes(':')&&/\.(?:css|js|png|jpg|svg)(?:\?|$)/.test(u)))];
  for(const css of urls.filter(url=>/\.css(?:\?|$)/.test(url))){
   const contents=await fs.readFile(new URL('../../'+css.split('?')[0],import.meta.url),'utf8');
   for(const match of contents.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))if(!match[1].includes(':')&&!urls.includes(match[1]))urls.push(match[1]);
  }
  return {page,urls};
 }));report.bundles=bundles;
 for(const concurrency of [10,25,50,100])await stage(concurrency,100,async index=>{
  const {page,urls}=bundles[index%bundles.length];await request(`${base}/${page}`);
  // Browser-like ceiling of six simultaneous asset requests per journey.
  let next=0;await Promise.all(Array.from({length:6},async()=>{while(next<urls.length){const url=urls[next++];await request(`${base}/${url}`);}}));
 });
}else if(['registration','auth-only'].includes(mode)){
 // These explicit loopback emulator endpoints are mandatory; no production fallback.
 process.env.FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:19099';process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:18080';
 const require=createRequire(new URL('../../functions/package.json',import.meta.url));
 const {initializeApp}=require('firebase-admin/app');const {getAuth}=require('firebase-admin/auth');
 const projectId='demo-agroestimate-load';initializeApp({projectId});const adminAuth=getAuth();
 const authBase='http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1';const dbBase=`http://127.0.0.1:18080/v1/projects/${projectId}/databases/(default)/documents`;
 const post=(url,data,token)=>request(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)});
 const auth=(method,data)=>post(`${authBase}/accounts:${method}?key=emulator-only`,data);
 const fields=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{stringValue:v}]));
 const run=Date.now();let sequence=0;
 for(const concurrency of [10,25,50,100])await stage(concurrency,100,async()=>{
  const id=sequence++,email=`load-${run}-${id}@example.test`,password='Load-test-only-123!',name=`Load member ${id}`,phone='9'+String(id).padStart(9,'0');
  const user=await auth('signUp',{email,password,returnSecureToken:true});const uid=user.localId;
  await auth('update',{idToken:user.idToken,displayName:name,returnSecureToken:true});
  if(mode==='registration')await request(`${dbBase}/registrationDetails/${uid}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${user.idToken}`},body:JSON.stringify({fields:fields({phone})})});
  await auth('sendOobCode',{idToken:user.idToken,requestType:'VERIFY_EMAIL'});
  // Simulate the user's successful email-link verification inside the emulator.
  await adminAuth.updateUser(uid,{emailVerified:true});
  const signed=await auth('signInWithPassword',{email,password,returnSecureToken:true});
  if(mode==='auth-only'){
   const result=await auth('lookup',{idToken:signed.idToken});
   const saved=result.users[0];
   if(saved.localId!==uid||saved.email!==email||saved.displayName!==name||!saved.emailVerified)throw Error('Authentication data mismatch');
   return;
  }
  await post(`${dbBase}:commit`,{writes:[{update:{name:`projects/${projectId}/databases/(default)/documents/users/${uid}`,fields:fields({name,email,phone})},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]}]},signed.idToken);
  const stored=await request(`${dbBase}/users/${uid}`,{headers:{Authorization:`Bearer ${signed.idToken}`}});
  for(const [key,value] of Object.entries({name,email,phone}))if(stored.fields[key]?.stringValue!==value)throw Error('Profile mismatch: '+key);
 });
}else throw Error('Use static, auth-only or registration');
report.finishedAt=new Date().toISOString();
await fs.writeFile(new URL(`../../reports/load-${mode}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
if(report.stages.some(s=>s.failed))process.exitCode=1;
