export async function withSaveTimeout(operation, milliseconds=15000) {
  let timer;
  try {return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Saving could not be confirmed. Check your connection and refresh the user list before retrying; the change may still complete.')),milliseconds);})]);}
  finally {clearTimeout(timer);}
}
// Use the same India calendar day for display, filtering and sorting.
export function registrationDay(timestamp) {
  const date = timestamp?.toDate?.();
  if (!date || !Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function formatRegistrationDate(timestamp) {
  return registrationDay(timestamp).split('-').reverse().join('/');
}
export function filterUsers(records, {search='',from='',to='',sort='newest'}={}) {
  const query=search.trim().toLowerCase();
  return records.filter(record=>{
    const day=registrationDay(record.createdAt);
    return (!query || [record.name,record.email,record.phone].some(value=>String(value||'').toLowerCase().includes(query))) && (!from || day>=from) && (!to || (day && day<=to));
  }).sort((a,b)=>{
    if(sort==='name')return (a.name||'').localeCompare(b.name||'');
    const first=registrationDay(a.createdAt),second=registrationDay(b.createdAt);
    if(!first)return second?1:0;
    if(!second)return -1;
    return sort==='oldest'?first.localeCompare(second):second.localeCompare(first);
  });
}
export function renderUsers({api, db, entries, updateAccount, emailEditingEnabled=false}) {
  const list = document.getElementById('user-list');
  const dialog = document.getElementById('edit-user-dialog');
  const form = document.getElementById('edit-user-form');
  const status = document.getElementById('edit-user-status');
  form.elements.email.readOnly = !emailEditingEnabled;
  document.getElementById('email-edit-help').textContent = emailEditingEnabled ? 'Changing an email updates the login address. The user must verify the new email after signing in.' : 'Email editing is unavailable until the Firebase email-editing function is deployed. You can still save name and phone changes.';
  const notice = document.getElementById('user-list-status');
  const filters = document.getElementById('user-filters');
  const filterStatus = document.getElementById('user-filter-status');
  let selected, busy = false;
  const t = text => window.agroI18n?.t(text) ?? text;
  const records = entries.map(entry => ({uid: entry.id, ...entry.data()}));
  function render() {
    list.replaceChildren();
    document.getElementById('user-count').textContent = records.length;
    const options=Object.fromEntries(new FormData(filters));
    const invalidRange=options.from && options.to && options.from>options.to;
    const visible=invalidRange?[]:filterUsers(records,options);
    filterStatus.textContent=invalidRange?t('The end date must be on or after the start date.'):`${t('Matching users')}: ${visible.length} / ${records.length}`;
    for (const record of visible) {
      const row = document.createElement('article'); row.className = 'member-row';
      const details = document.createElement('dl'); details.className = 'member-details';
      for (const [label, value] of [['Full name', record.name], ['Email address', record.email], ['Phone number', record.phone], ['Registered on', formatRegistrationDate(record.createdAt)]]) {
        const group = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = t(label); dd.textContent = value || t('Not provided');
        if(value) dd.setAttribute('translate', 'no');
        group.append(dt, dd); details.append(group);
      }
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'member-edit';
      const pencil = document.createElement('span'); pencil.className = 'member-edit-icon'; pencil.textContent = '✎'; pencil.setAttribute('aria-hidden', 'true'); edit.append(pencil); edit.setAttribute('aria-label', t('Edit user details')); edit.title = t('Edit user details');
      edit.onclick = () => {
        selected = record;
        for (const field of ['name', 'email', 'phone']) form.elements[field].value = record[field] || '';
        status.textContent = ''; dialog.showModal(); form.elements.name.focus();
      };
      row.append(details, edit); list.append(row);
    }
    if (!visible.length) list.textContent = t(records.length ? 'No users match these filters.' : 'No member profiles yet.');
  }
  filters.addEventListener('input',render);
  filters.addEventListener('change',render);
  filters.addEventListener('submit',event=>event.preventDefault());
  filters.addEventListener('reset',()=>queueMicrotask(render));
  document.getElementById('cancel-edit-user').onclick = () => dialog.close();
  dialog.addEventListener('cancel', event => {if (busy) event.preventDefault();});
  form.onsubmit = async event => {
    event.preventDefault(); if (busy || !selected || !form.reportValidity()) return;
    const patch = Object.fromEntries(['name','email','phone'].map(key => [key, form.elements[key].value.trim()]));
    if (!/^[6-9][0-9]{9}$/.test(patch.phone)) {status.textContent = t('Enter exactly 10 digits starting with 6, 7, 8, or 9.'); return;}
    if (patch.email !== selected.email && !emailEditingEnabled) {status.textContent=t('Email editing is unavailable until the Firebase email-editing function is deployed. You can still save name and phone changes.');return;}
    if (!navigator.onLine) {status.textContent=t('Account changes need an internet connection.');return;}
    busy = true; [...form.elements].forEach(el => el.disabled = true); status.textContent = t('Saving…');
    try {
      if (patch.email !== selected.email) {
        const result = await withSaveTimeout(updateAccount({uid: selected.uid, ...patch}));
        Object.assign(selected, result.data);
      } else {
        await withSaveTimeout(api.updateDoc(api.doc(db, 'users', selected.uid), {name: patch.name, phone: patch.phone}));
        Object.assign(selected, patch);
      }
      render(); dialog.close(); notice.textContent = t('User details saved.');
    } catch (error) {
      status.textContent = ['functions/deadline-exceeded','deadline-exceeded'].includes(error.code) ? t('The save request timed out. Refresh the user list to check whether the change was saved before trying again.') : !error.code ? t(error.message) : error.code === 'functions/unavailable' && error.message.includes('login account was updated')
        ? error.message : error.code?.startsWith('functions/') && !['functions/internal','functions/not-found','functions/unavailable'].includes(error.code)
        ? error.message : t('Could not finish saving. Check your connection and Firebase deployment, then retry Save.');
    } finally {busy = false; [...form.elements].forEach(el => el.disabled = false);}
  };
  render();
}
