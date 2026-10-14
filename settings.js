(() => {
 const requestForm=document.getElementById('email-request-form');
 requestForm.elements.reason.onchange=()=>{requestForm.elements.details.required=requestForm.elements.reason.value==='Other';};
 requestForm.onsubmit=async e=>{e.preventDefault();const button=requestForm.querySelector('button');const status=document.getElementById('email-request-status');button.disabled=true;try{await window.requestAgroEmailChange(Object.fromEntries(new FormData(requestForm)));requestForm.reset();requestForm.elements.details.required=false;status.textContent='Request sent to the administrator. Your current email remains unchanged.';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
 const phoneForm=document.getElementById('phone-request-form');
 phoneForm.elements.reason.onchange=()=>{phoneForm.elements.details.required=phoneForm.elements.reason.value==='Other';};
 phoneForm.onsubmit=async e=>{e.preventDefault();const button=phoneForm.querySelector('button');const status=document.getElementById('phone-request-status');button.disabled=true;try{await window.requestAgroPhoneChange(Object.fromEntries(new FormData(phoneForm)));phoneForm.reset();phoneForm.elements.details.required=false;status.textContent='Request sent to the administrator. Your current phone number remains unchanged.';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
 const form=document.getElementById('settings-form');
 const status=document.getElementById('settings-status');
 const passwordForm=document.getElementById('password-change-form');
 const passwordButton=passwordForm.querySelector('button[type="submit"]');
 const passwordStatus=document.getElementById('password-status');
 let loaded=false;
 const passwordInput=passwordForm.elements.newPassword;
 const strength=document.getElementById('password-strength');
 function updateStrength() {
  const value=passwordInput.value;
  const rules={length:value.length>=12,upper:/[A-Z]/.test(value),lower:/[a-z]/.test(value),number:/[0-9]/.test(value),symbol:/[^A-Za-z0-9\s]/.test(value)};
  const score=Object.values(rules).filter(Boolean).length;
  const strong=score===5;
  strength.querySelectorAll('[data-rule]').forEach(item=>item.classList.toggle('met',rules[item.dataset.rule]));
  document.getElementById('strength-label').textContent='Password strength: '+(!value?'enter a new password':strong?'Strong':score>=3?'Medium':'Weak');
  const fill=strength.querySelector('.strength-fill');fill.style.width=(score*20)+'%';fill.style.background=strong?'#286442':score>=3?'#a47820':'#b34639';
  const warning=value&&!strong?'Use at least 12 characters with uppercase, lowercase, a number, and a symbol.':'';
  passwordInput.setCustomValidity(window.agroI18n?.t(warning) ?? warning);
  return strong;
 }
 passwordInput.addEventListener('input',updateStrength);
 window.addEventListener('agro-language-change',updateStrength);
 function load(data) {
  if(!loaded) {for(const key of ['name','email','phone'])form.elements[key].value=data[key]||'';loaded=true;}
  passwordButton.disabled=false;
 }
 window.addEventListener('agro-profile-ready',e=>load(e.detail));
 if(window.agroProfile)load(window.agroProfile);
 form.onsubmit=e=>e.preventDefault();
 passwordForm.onsubmit=async e=>{
  e.preventDefault();
  const fields=passwordForm.elements;
  if(!updateStrength()){passwordInput.reportValidity();return;}
  if(fields.newPassword.value!==fields.confirm.value){passwordStatus.textContent='The new passwords do not match.';fields.confirm.focus();return;}
  if(fields.current.value===fields.newPassword.value){passwordStatus.textContent='Choose a password different from your current password.';return;}
  passwordButton.disabled=true;passwordStatus.textContent='Updating password…';
  try{await window.changeAgroPassword(fields.current.value,fields.newPassword.value);passwordForm.reset();updateStrength();passwordStatus.textContent='Password updated successfully.';}catch(error){passwordStatus.textContent=error.message;}finally{passwordButton.disabled=false;}
 };
})();
