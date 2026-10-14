exports.makeApproveEmail = ({auth, db, HttpsError, serverTimestamp}) => async request => {
 const actor=request.auth;
 if(!actor || actor.token.email_verified!==true || !(await db.doc(`admins/${actor.uid}`).get()).exists)throw new HttpsError('permission-denied','Administrator access required.');
 const {uid}=request.data||{};
 if(typeof uid!=='string'||!uid||uid.includes('/')||uid.length>128)throw new HttpsError('invalid-argument','Invalid request.');
 if((await db.doc(`admins/${uid}`).get()).exists)throw new HttpsError('failed-precondition','Administrator login emails must be changed with the configured login alias.');
 const ref=db.doc(`emailChangeRequests/${uid}`);
 const data=await db.runTransaction(async tx=>{
  const snapshot=await tx.get(ref);
  if(!snapshot.exists)throw new HttpsError('not-found','Request not found.');
  const data=snapshot.data();
  if(data.status==='completed' && data.authEmailConfirmed===true)return data;
  if(!['pending','processing','completed'].includes(data.status))throw new HttpsError('failed-precondition','This request is no longer pending.');
  if(data.uid!==uid||typeof data.newEmail!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.newEmail))throw new HttpsError('invalid-argument','Invalid requested email.');
  tx.update(ref,{status:'processing'});
  return data;
 });
 if(data.status==='completed' && data.authEmailConfirmed===true)return {completed:true};
 try {
  const user=await auth.getUser(uid);
  if(![data.currentEmail.toLowerCase(),data.newEmail.toLowerCase()].includes(user.email?.toLowerCase()))throw new HttpsError('failed-precondition','The login email has changed since this request.');
  if(user.email.toLowerCase()!==data.newEmail.toLowerCase())await auth.updateUser(uid,{email:data.newEmail,emailVerified:false});
  const confirmed=await auth.getUser(uid);
  if(confirmed.email?.toLowerCase()!==data.newEmail.toLowerCase())throw new HttpsError('unavailable','The login email change is not confirmed. Retry approval.');
 } catch(error) {
  // Keep processing locked on uncertain network errors; retrying reconciles Auth.
  if(error.code==='auth/email-already-exists'||error.code==='failed-precondition') {
   await ref.update({status:'pending'});
   throw new HttpsError('failed-precondition',error.code==='auth/email-already-exists'?'This email is already used by another account.':error.message);
  }
  throw new HttpsError('unavailable','Could not confirm the login update. Retry approval to finish.');
 }
 // All database changes commit together; retry repairs an Auth-only partial success.
 const batch=db.batch();
 batch.update(db.doc(`users/${uid}`),{email:data.newEmail});
 batch.update(ref,{status:'completed',authEmailConfirmed:true,completedAt:serverTimestamp()});
 batch.set(db.doc(`userNotifications/${uid}`),{type:'email-changed',email:data.newEmail,createdAt:serverTimestamp(),read:false});
 try {await batch.commit();}catch{throw new HttpsError('unavailable','The login email was updated. Retry approval to finish saving the profile and notification.');}
 return {completed:true};
};
