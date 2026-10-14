import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../auth.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('async function saveProfile'),source.indexOf('async function logout'));
let stored={name:'Farmer',email:'old@example.com',createdAt:123,phone:'12345'},writes=[];
const context=vm.createContext({db:{},api:{doc:(_db,collection,uid)=>({collection,uid}),getDocFromServer:async(ref)=>ref.collection==='registrationDetails'?({exists:()=>true,data:()=>({phone:'9876543210'})}):({exists:()=>!!stored,data:()=>stored}),updateDoc:async(ref,patch)=>{writes.push(patch);stored={...stored,...patch};},setDoc:async(ref,data)=>{writes.push(data);stored=data;},serverTimestamp:()=>456}});
vm.runInContext(fn,context);
const user={uid:'one',email:'new@example.com',emailVerified:true};
await context.saveProfile(user,null);
assert.equal(stored.email,user.email);assert.equal(stored.createdAt,123);assert.equal(stored.name,'Farmer');assert.equal(stored.phone,'12345');assert.deepEqual(Object.keys(writes[0]),['email']);
await context.saveProfile(user,null);assert.equal(writes.length,1);
await assert.rejects(context.saveProfile({...user,emailVerified:false},null));assert.equal(writes.length,1);
stored=null;await context.saveProfile(user,'New farmer');assert.equal(stored.name,'New farmer');assert.equal(stored.createdAt,456);
console.log('Profile email sync preserves other fields, skips unchanged email and rejects unverified users.');

assert.equal(stored.phone,'9876543210','registration phone survives email verification and profile creation');
