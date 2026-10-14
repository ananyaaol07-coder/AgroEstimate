export const emailRequestStatus = data => data.status === 'completed' && data.authEmailConfirmed !== true ? 'Needs verification' : data.status;
export function countEmailRequests(requests) {
 return {total:requests.length,accepted:requests.filter(data=>data.status==='completed' && data.authEmailConfirmed===true).length,rejected:requests.filter(data=>data.status==='rejected').length};
}
export async function setupEmailRequests({api,db}) {
 const box=document.getElementById('email-requests');if(!box)return;
 try {
  const snapshot=await api.getDocs(api.collection(db,'emailChangeRequests'));
  const counts=countEmailRequests(snapshot.docs.map(doc=>doc.data()));
  for(const [key,value] of Object.entries(counts))document.getElementById(`email-request-${key}`).textContent=value;
  box.replaceChildren();
  if(snapshot.empty)box.textContent='No email change requests yet.';
  for(const doc of snapshot.docs){
   const data=doc.data(),card=document.createElement('details');card.className='email-request-name-row';
   const name=document.createElement('summary');name.textContent=data.name||'—';name.setAttribute('translate','no');card.append(name);
   const content=document.createElement('div');content.className='email-request-details';
   for(const [label,value] of [['Current email',data.currentEmail],['Requested email',data.newEmail],['Reason',data.reason],['Additional details',data.details||'—'],['Status',emailRequestStatus(data)]]){
    const row=document.createElement('p'),heading=document.createElement('strong'),text=document.createElement('span');
    heading.textContent=label; text.textContent=value;
    if(['Current email','Requested email','Additional details'].includes(label))text.setAttribute('translate','no');
    row.append(heading,document.createTextNode(': '),text);content.append(row);
   }
   const actions=document.createElement('div');actions.className='email-request-actions';
   const status=document.createElement('p');status.setAttribute('role','status');
   const reject=document.createElement('button');reject.type='button';reject.className='nav-link button-link';reject.textContent='Reject request';
   const canReject=data.status==='pending';reject.disabled=!canReject;
   const remove=document.createElement('button');remove.type='button';remove.className='nav-link button-link';remove.textContent='Delete request';remove.disabled=data.status==='processing';
   async function act(deleting){
    if(deleting && !window.confirm(window.agroI18n?.t('Delete this email-change request? The user account will not be deleted.')||'Delete this email-change request? The user account will not be deleted.'))return;
    reject.disabled=true;remove.disabled=true;
    try{
     if(deleting)await api.deleteDoc(doc.ref);
     else await api.updateDoc(doc.ref,{status:'rejected'});
     await setupEmailRequests({api,db});
    }catch{status.textContent='Could not update request. Check your connection and rules.';reject.disabled=!canReject;remove.disabled=data.status==='processing';}
   }
   reject.onclick=()=>act(false);remove.onclick=()=>act(true);
   actions.append(reject,remove);content.append(actions,status);card.append(content);
   box.append(card);
  }
 }catch{box.textContent='Unable to load requests. Publish the updated Firebase rules and refresh.';}
}
