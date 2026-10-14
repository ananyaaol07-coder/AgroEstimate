export async function resolvePhoneRequest({api,db},ref,approve) {
 await api.runTransaction(db,async transaction=>{
  const snapshot=await transaction.get(ref);
  if(!snapshot.exists()||snapshot.data().status!=='pending')throw new Error('This request is no longer pending. Refresh the page.');
  const data=snapshot.data();
  if(approve){
   const userRef=api.doc(db,'users',data.uid);
   const profile=await transaction.get(userRef);
   if(!profile.exists()||(profile.data().phone||'')!==data.currentPhone)throw new Error('The phone number has changed since this request. Reject it and ask for a new request.');
   transaction.update(userRef,{phone:data.newPhone});
  }
  transaction.update(ref,{status:approve?'completed':'rejected'});
 });
}
export async function setupPhoneRequests({api,db}) {
 const box=document.getElementById('phone-requests');if(!box)return;
 try {
  const snapshot=await api.getDocs(api.collection(db,'phoneChangeRequests'));box.replaceChildren();
  const entries=[...snapshot.docs].sort((a,b)=>(b.data().createdAt?.toMillis?.()||0)-(a.data().createdAt?.toMillis?.()||0));
  const counts={total:entries.length,accepted:entries.filter(d=>d.data().status==='completed').length,rejected:entries.filter(d=>d.data().status==='rejected').length};
  for(const [key,value] of Object.entries(counts))document.getElementById(`phone-request-${key}`).textContent=value;
  if(snapshot.empty)box.textContent='No phone number change requests yet.';
  for(const doc of entries){
   const data=doc.data(),card=document.createElement('details');card.className='email-request-name-row';
   const name=document.createElement('summary');name.textContent=data.name||'—';name.setAttribute('translate','no');card.append(name);
   const content=document.createElement('div');content.className='email-request-details';
   const date=data.createdAt?.toDate?.();
   for(const [label,value] of [['Current phone number',data.currentPhone||'—'],['New phone number',data.newPhone],['Reason',data.reason],['Additional details',data.details||'—'],['Status',data.status],['Requested on',date?date.toLocaleString('en-GB',{timeZone:'Asia/Kolkata'}):'—']]){
    const row=document.createElement('p'),heading=document.createElement('strong'),text=document.createElement('span');heading.textContent=label;text.textContent=value;
    if(['Current phone number','New phone number','Additional details','Requested on'].includes(label))text.setAttribute('translate','no');
    row.append(heading,document.createTextNode(': '),text);content.append(row);
   }
   const actions=document.createElement('div');actions.className='email-request-actions';
   const status=document.createElement('p');status.setAttribute('role','status');
   for(const [action,title] of [['approve','Approve phone number change'],['reject','Reject request'],['delete','Delete request']]){
    const button=document.createElement('button');button.type='button';button.className='nav-link button-link';button.textContent=title;button.disabled=action!=='delete'&&data.status!=='pending';
    button.onclick=async()=>{
     if(action==='delete'&&!window.confirm(window.agroI18n?.t('Delete this phone-change request? The user account will not be deleted.')||'Delete this phone-change request? The user account will not be deleted.'))return;
     const buttons=[...actions.querySelectorAll('button')],disabled=buttons.map(b=>b.disabled);buttons.forEach(b=>b.disabled=true);
     try{if(action==='delete')await api.deleteDoc(doc.ref);else await resolvePhoneRequest({api,db},doc.ref,action==='approve');await setupPhoneRequests({api,db});}
     catch(error){status.textContent=error.code?'Could not update request. Check your connection and rules.':error.message;buttons.forEach((b,i)=>b.disabled=disabled[i]);}
    };actions.append(button);
   }
   content.append(actions,status);card.append(content);box.append(card);
  }
 }catch{box.textContent='Unable to load requests. Publish the updated Firebase rules and refresh.';}
}
