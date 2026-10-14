#!/usr/bin/env node
// Local CLI only. Never serve this file or privileged credentials to a browser.
const {initializeApp, applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {createInterface}=require('node:readline/promises');
const {makeApproveEmail}=require('./approve-email');
const {HttpsError}=require('firebase-functions/v2/https');
async function main(){
 if(process.argv.includes('--help')){
  console.log('Local AgroEstimate email administrator\nRun: node functions/local-admin.cjs\nRequires Google Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS pointing to a private service-account file outside the repository.\nThe tool previews each change and asks for confirmation.');return;
 }
 initializeApp({credential:applicationDefault(),projectId:'agroestimate'});
 const auth=getAuth(),db=getFirestore(),input=createInterface({input:process.stdin,output:process.stdout});
 try{
  console.log('AgroEstimate local email editor — project: agroestimate');
  console.log('Uses privileged Google credentials on this computer. No billing-based Cloud Function is needed.');
  const adminEmail=(await input.question('Your existing AgroEstimate administrator email: ')).trim();
  const admin=await auth.getUserByEmail(adminEmail);
  if(!admin.emailVerified || !(await db.doc(`admins/${admin.uid}`).get()).exists)throw Error('This account is not a verified AgroEstimate administrator.');
  const currentEmail=(await input.question('Current login email of the member to update: ')).trim();
  const user=await auth.getUserByEmail(currentEmail);
  if((await db.doc(`admins/${user.uid}`).get()).exists)throw Error('Administrator login emails require updating the configured login alias; this tool edits member accounts only.');
  const profileRef=db.doc(`users/${user.uid}`),requestRef=db.doc(`emailChangeRequests/${user.uid}`);
  const [profile,request]=await Promise.all([profileRef.get(),requestRef.get()]);
  if(!profile.exists)throw Error('The account has no member profile.');
  const pending=request.exists && (['pending','processing'].includes(request.data().status)||(request.data().status==='completed' && request.data().authEmailConfirmed!==true))?request.data():null;
  if(pending)console.log('Existing requested email: '+pending.newEmail);
  const newEmail=(await input.question(pending?'New email (press Enter to approve the existing request): ':'New email: ')).trim()||pending?.newEmail;
  if(typeof newEmail!=='string'||newEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail))throw Error('Enter a valid new email.');
  if(pending?.status==='processing' && newEmail!==pending.newEmail)throw Error('Finish the processing request before selecting a different email.');
  if(!pending && newEmail.toLowerCase()===user.email.toLowerCase())throw Error('The new email is the same as the current email.');
  console.log(`\nMember: ${profile.data().name}\nLogin email: ${user.email} → ${newEmail}\nUpdates login, profile and in-app notification. The member must verify the new email. Password and account ID stay unchanged.`);
  if(await input.question('Type CHANGE to apply, or anything else to cancel: ')!=='CHANGE'){console.log('Cancelled. Nothing changed.');return;}
  // Recheck at commit time so a concurrently replaced request is never approved accidentally.
  await db.runTransaction(async tx=>{
   const latest=await tx.get(requestRef);
   if(pending){
    if(!latest.exists||latest.data().newEmail!==pending.newEmail||latest.data().status!==pending.status)throw Error('The request changed. Restart the tool and review it again.');
   }else if(latest.exists && ['pending','processing'].includes(latest.data().status))throw Error('A new request arrived. Restart the tool and review it.');
   if(!pending || pending.newEmail!==newEmail)tx.set(requestRef,{uid:user.uid,name:profile.data().name,currentEmail:user.email,newEmail,reason:'Other',details:'Email change reviewed by the administrator using the local tool.',status:'pending',createdAt:FieldValue.serverTimestamp()});
  });
  // Google IAM credentials authorize this local process; the shared handler also
  // verifies the selected application administrator marker before modifying Auth.
  const approve=makeApproveEmail({auth,db,HttpsError,serverTimestamp:()=>FieldValue.serverTimestamp()});
  await approve({auth:{uid:admin.uid,token:{email_verified:admin.emailVerified}},data:{uid:user.uid}});
  console.log('Email changed successfully. Profile, request status and in-app notification saved.');
 }finally{input.close();}
}
main().catch(error=>{console.error('Could not complete the change: '+error.message);console.error('If credentials are missing, follow LOCAL_ADMIN.md. If the login changed but saving failed, rerun using the NEW login email and approve the existing request.');process.exitCode=1;});
