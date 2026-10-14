import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {makeApproveEmail}=createRequire(import.meta.url)('../functions/approve-email.js');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
let data={uid:'user',currentEmail:'old@example.com',newEmail:'new@example.com',status:'pending'},account={email:'old@example.com'},fail=true,commits=[],updates=0;
const ref=path=>({path,get:async()=>({exists:path==='admins/admin'||path==='emailChangeRequests/user',data:()=>data}),update:async patch=>Object.assign(data,patch)});
const db={doc:ref,runTransaction:async fn=>fn({get:r=>r.get(),update:(r,p)=>r.update(p)}),batch:()=>{const writes=[];return {update:(r,p)=>writes.push([r.path,p]),set:(r,p)=>writes.push([r.path,p]),commit:async()=>{if(fail)throw Error('offline');commits=writes;Object.assign(data,writes.find(([path])=>path==='emailChangeRequests/user')[1]);}};}};
const auth={getUser:async()=>account,updateUser:async(uid,p)=>{updates++;Object.assign(account,p);}};
const approve=makeApproveEmail({auth,db,HttpsError,serverTimestamp:()=>123});
await assert.rejects(approve({data:{uid:'user'}}),{code:'permission-denied'});
const request={auth:{uid:'admin',token:{email_verified:true}},data:{uid:'user'}};
await assert.rejects(approve(request),{code:'unavailable'});assert.equal(account.email,'new@example.com');assert.equal(account.emailVerified,false);assert.equal(data.status,'processing');
fail=false;await approve(request);assert.equal(updates,1);assert.equal(commits.length,3);assert.equal(commits[2][0],'userNotifications/user');assert.equal(data.status,'completed');
await approve(request);assert.equal(updates,1);
console.log('Email approval: authorization, partial failure recovery, notification commit and idempotent retry passed.');

assert.equal(data.authEmailConfirmed,true);
data.status='completed';delete data.authEmailConfirmed;account.email='old@example.com';await approve(request);assert.equal(account.email,'new@example.com');assert.equal(data.authEmailConfirmed,true);
