(() => {
  if (!document.body.dataset.protected) return;
  const header = document.querySelector('.page-header nav');
  const logout = document.getElementById('logout-button');
  if (!header || !logout) return;
  let profile;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(`agro:${profile.uid}:${key}`)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(`agro:${profile.uid}:${key}`, JSON.stringify(value)); return true; } catch { return false; } };
  const menu = document.createElement('button');
  menu.className = 'menu-toggle'; menu.type = 'button'; menu.setAttribute('aria-label','Open navigation'); menu.setAttribute('aria-expanded','false');
  menu.innerHTML = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  header.prepend(menu);
  const avatar = document.createElement('button'); avatar.className='profile-button'; avatar.type='button'; avatar.setAttribute('aria-label','Open profile');
  avatar.innerHTML='<span class="avatar-dot">?</span>';
  logout.replaceWith(avatar);
  const drawer = document.createElement('dialog'); drawer.className='sidebar-drawer'; drawer.id='sidebar-menu'; menu.setAttribute('aria-controls',drawer.id);
  drawer.innerHTML='<div class="drawer-top"><strong>AgroEstimate</strong><button type="button" class="dialog-close" aria-label="Close navigation">×</button></div><div class="sidebar-profile"><span class="avatar-dot">?</span><div><strong class="profile-name">Your account</strong></div></div><nav class="sidebar-links" aria-label="Main menu"></nav><div class="sidebar-bottom"></div>';
  document.body.append(drawer);
  const links=drawer.querySelector('nav');
  const isAdmin = document.body.dataset.protected === 'admin';
  if (!isAdmin) for(const [url,title] of [['index.html','Home'],['calculators.html','Overview'],['fertilizer.html','Fertilizer'],['seed.html','Seed rate & spacing'],['yield.html','Yield estimation']]) {
    const a=document.createElement('a'); a.href=url; a.textContent=title; if(location.pathname.endsWith('/'+url)) a.setAttribute('aria-current','page'); links.append(a);
  }
  if (isAdmin) {
    for (const [url,title] of [
      ['admin.html','Dashboard'],
      ['admin-fertilizer.html','Fertilizer data'],
      ['admin-seed.html','Seed rate & spacing data'],
      ['admin-yield.html','Yield estimation data'],
      ['admin-email-requests.html','Email change requests'],
      ['admin-phone-requests.html','Phone number change requests'],
      ['admin-users.html','Registered users']
    ]) {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = title;
      if (location.pathname.endsWith('/'+url)) link.setAttribute('aria-current','page');
      links.append(link);
    }
  }
  drawer.querySelector('.sidebar-bottom').append(logout);
  const panel=document.createElement('dialog');panel.className='account-dialog'; panel.innerHTML='<button type="button" class="dialog-close" aria-label="Close panel">×</button><h2></h2><div class="panel-content"></div>';document.body.append(panel);
  for(const dialog of [drawer,panel]) {dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});}
  drawer.addEventListener('close',()=>menu.setAttribute('aria-expanded','false'));
  menu.onclick=()=>{drawer.showModal();menu.setAttribute('aria-expanded','true');};
  const content=panel.querySelector('.panel-content');
  function open(title) {drawer.close();panel.querySelector('h2').textContent=title;content.replaceChildren();panel.showModal();}
  function paragraph(text) {const p=document.createElement('p');p.textContent=text;content.append(p);return p;}
  function paint() {
    if(!profile)return;
    document.querySelectorAll('.profile-name').forEach(n=>n.textContent=profile.name);
    document.querySelectorAll('.avatar-dot').forEach(n=>{n.textContent=(profile.name.trim().charAt(0)||'A').toUpperCase();});
  }
  const profileBox=document.createElement('div'); profileBox.className='profile-popover'; profileBox.id='profile-popover'; profileBox.setAttribute('popover','auto');
  document.body.append(profileBox);
  avatar.setAttribute('popovertarget',profileBox.id);
  avatar.setAttribute('aria-label','Your profile');
  function positionProfile() {const r=avatar.getBoundingClientRect();profileBox.style.top=(r.bottom+10)+'px';profileBox.style.right=Math.max(16,innerWidth-r.right)+'px';}
  function renderProfile(edit=false) {
    profileBox.replaceChildren();
    if(!profile)return;
    const title=document.createElement('h3');title.textContent=edit?'Edit details':'Your details';profileBox.append(title);
    const close=document.createElement('button');close.type='button';close.className='profile-close';close.textContent='×';close.setAttribute('aria-label','Close profile');close.onclick=()=>{profileBox.hidePopover();avatar.focus();};profileBox.append(close);
    const form=document.createElement('form');form.className='profile-edit';
    for(const [key,label,type] of [['name','Name','text'],['email','Email address','email'],['phone','Phone number','tel']]) {
      const row=document.createElement('label');row.textContent=label;
      if(edit) {const input=document.createElement('input');input.name=key;input.type=type;input.value=profile[key]||'';input.required=key!=='phone';input.maxLength=key==='name'?200:key==='phone'?25:254;row.append(input);}
      else {const value=document.createElement('span');value.textContent=profile[key]||'Not added';if(profile[key])value.setAttribute('translate','no');row.append(value);}
      form.append(row);
    }
    const button=document.createElement('button');button.type=edit?'submit':'button';button.className='primary-button';button.textContent=edit?'Save changes':'Edit details';form.append(button);
    if(!edit)button.onclick=()=>{location.href='settings.html';};
    else {const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.className='profile-cancel';cancel.onclick=()=>renderProfile();form.append(cancel);}
    const status=document.createElement('p');status.setAttribute('role','status');form.append(status);
    form.onsubmit=async e=>{e.preventDefault();button.disabled=true;try{status.textContent=await window.saveAgroProfile(Object.fromEntries(new FormData(form)));}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
    profileBox.append(form);
  }
  avatar.addEventListener('click',()=>{positionProfile();renderProfile();});
  window.addEventListener('resize',positionProfile);

  function action(title,fn){const b=document.createElement('button');b.type='button';b.textContent=title;b.onclick=fn;links.append(b);}
  if (!isAdmin) {
  const historyLink=document.createElement('a');historyLink.href='history.html';historyLink.textContent='History';if(location.pathname.endsWith('/history.html'))historyLink.setAttribute('aria-current','page');links.append(historyLink);
  const settingsLink=document.createElement('a');settingsLink.href='settings.html';settingsLink.textContent='Settings';if(location.pathname.endsWith('/settings.html'))settingsLink.setAttribute('aria-current','page');links.append(settingsLink);
  }
  const updateProfile = data => {profile=data;paint();document.body.classList.toggle('reduce-motion',read('reduce-motion',false));};
  window.addEventListener('agro-profile-ready',e=>updateProfile(e.detail));
  if (window.agroProfile) updateProfile(window.agroProfile);
})();
