import {preferredLanguage,languageUrl} from './language-preference.js?v=mr-3';
const localizedUrl=path=>{let storage;try{storage=window.localStorage;}catch{}return languageUrl(path,location.href,preferredLanguage(location,storage));};
import { firebaseConfig, adminLogin, adminEmailEditingEnabled } from './firebase-config.js?v=save-fix-2';

const protectedRole = document.body.dataset.protected;
const params = new URLSearchParams(location.search);
const destinations = ['calculators.html', 'fertilizer.html', 'seed.html', 'yield.html', 'settings.html', 'history.html'];
const next = destinations.includes(params.get('next')) ? params.get('next') : 'calculators.html';
const role = document.body.dataset.loginRole === 'admin' || params.get('role') === 'admin' ? 'admin' : 'user';
let auth, db, api;
let submittingAuth = false;
window.agriAuthenticated = false;
const message = (text) => {
  const box = document.querySelector('.form-message, #access-status');
  if (box) box.textContent = text;
};
const lock = () => {
  window.agroProfile = null;
  window.agriAuthenticated = false;
  document.body.classList.remove('access-granted');
};
const loginUrl = () => `login.html?${protectedRole === 'admin' ? 'role=admin&' : ''}next=${encodeURIComponent(location.pathname.split('/').pop())}`;
if (role === 'admin' && document.getElementById('login-form')) {
  // Support old links to login.html?role=admin as well as the dedicated page.
  const emailInput = document.getElementById('login-email');
  if (emailInput) {
    emailInput.id = 'login-username';
    emailInput.type = 'text';
    emailInput.autocomplete = 'username';
    emailInput.removeAttribute('placeholder');
    emailInput.value = adminLogin.username;
    emailInput.closest('label').firstChild.textContent = 'Username';
  }
  document.querySelector('.auth-card h1').textContent = 'Admin login';
  document.querySelector('.auth-copy').textContent = 'Enter your administrator credentials to open the dashboard.';
  document.querySelector('#login-form button[type="submit"]').textContent = 'Login as admin';
}
// Remove obsolete demo accounts, including passwords stored by the old prototype.
try { localStorage.removeItem('agriEstimateUsers'); localStorage.removeItem('agriEstimateSession'); } catch {}
const forms = [...document.querySelectorAll('#login-form, #register-form')];
forms.forEach(form => form.querySelector('button[type="submit"]').disabled = true);
const friendlyError = error => ({
  'auth/email-already-in-use': 'An account already exists with this email. Please log in.',
  'auth/weak-password': 'Please choose a stronger password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/network-request-failed': 'Unable to connect. Check your connection and try again.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'Email or password is incorrect.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled.'
}[error.code] || 'Unable to complete this request. Please try again or contact the site owner.');
async function isAdmin(user) {
  return (await api.getDoc(api.doc(db, 'admins', user.uid))).exists();
}
async function saveProfile(user, name) {
  if (!user.emailVerified || !user.email) throw new Error('Email verification required');
  const ref = api.doc(db, 'users', user.uid);
  const saved = await api.getDocFromServer(ref);
  if (!saved.exists()) {
    const registration = await api.getDocFromServer(api.doc(db, 'registrationDetails', user.uid));
    const phone = registration.exists() ? registration.data().phone : null;
    await api.setDoc(ref, {name: name || user.displayName || user.email.split('@')[0], email: user.email, ...(phone ? {phone} : {}), createdAt: api.serverTimestamp()});
  } else if (saved.data().email !== user.email) {
    await api.updateDoc(ref, {email:user.email});
  }
}
async function logout() {
  lock();
  try { await api.signOut(auth); location.replace(localizedUrl('index.html')); }
  catch { message('Unable to log out. Please retry.'); }
}
async function showVerification(user, sendNow = false) {
  forms.forEach(form => { form.hidden = true; });
  let panel = document.getElementById('email-verification');
  if (panel) panel.remove();
  panel = document.createElement('dialog'); panel.id = 'email-verification';
  panel.setAttribute('aria-labelledby','verification-heading');
  const heading = document.createElement('h2'); heading.id='verification-heading'; heading.textContent = 'Verify your email';
  const description = document.createElement('p'); description.textContent = 'Open the verification link in your inbox, then return here to continue.';
  const address = document.createElement('p'); address.textContent = user.email;
  const status = document.createElement('p'); status.setAttribute('role','status');
  const resend = document.createElement('button'); resend.type='button'; resend.textContent='Resend verification email';
  const back = document.createElement('button'); back.type='button'; back.textContent='Use another account';
  panel.append(heading,description,address,resend,back,status);
  document.body.append(panel);
  panel.addEventListener('cancel',event=>event.preventDefault());
  panel.showModal();
  message('');
  const cooldownKey = `agro-verification-resend:${user.uid}`;
  let cooldownUntil = 0;
  const remaining = () => {
    try { cooldownUntil = Math.max(cooldownUntil, Number(localStorage.getItem(cooldownKey)) || 0); } catch {}
    return cooldownUntil > Date.now();
  };
  const cooldown = ms => {
    cooldownUntil = Date.now() + ms;
    try { localStorage.setItem(cooldownKey, String(cooldownUntil)); } catch {}
    resend.disabled = true;
  };
  resend.disabled = remaining();
  if(resend.disabled) status.textContent='Please wait before requesting another verification email.';
  const cooldownTimer = setInterval(() => {
    if(!panel.isConnected) {clearInterval(cooldownTimer);return;}
    resend.disabled = remaining();
  },1000);
  const send = async () => {
    if(remaining()) return;
    cooldown(120000);
    try {
      auth.languageCode = preferredLanguage(location,window.localStorage);
      // Local addresses cannot be used from a farmer's email on another device.
      // Send once, without a return URL; the original tab resumes on focus.
      await api.sendEmailVerification(user);
      status.textContent='Verification email sent. Check your inbox and spam folder.';
    } catch(error) {
      if(error.code === 'auth/too-many-requests') {
        cooldown(15 * 60 * 1000);
        status.textContent='Firebase has temporarily limited requests. Resend is paused for 15 minutes; Firebase may require a longer wait.';
      } else {status.textContent=friendlyError(error);}
    }
  };
  resend.onclick=send;
  back.onclick=async()=>{await api.signOut(auth);location.replace(localizedUrl(role==='admin'?'admin-login.html':'login.html'));};
  let checking=false;
  let lastCheck=0;
  const checkVerification=async()=>{
    if(checking || !panel.isConnected || auth.currentUser?.uid !== user.uid || !navigator.onLine || Date.now()-lastCheck<5000) return;
    lastCheck=Date.now();
    checking=true;
    try {
      await api.reload(user);
      if (!user.emailVerified) return;
      await api.getIdToken(user,true);
      if((protectedRole==='admin' || role==='admin') && !(await isAdmin(user))) {status.textContent='This account does not have administrator access.';return;}
      await saveProfile(user,null);
      if(protectedRole) location.reload();
      else location.assign(localizedUrl(role==='admin'?'admin.html':next));
    } catch(error) {status.textContent=friendlyError(error);}
    finally {checking=false;}
  };
  const onReturn = () => {
    if(!panel.isConnected || auth.currentUser?.uid !== user.uid) {
      window.removeEventListener('focus',onReturn);
      document.removeEventListener('visibilitychange',onReturn);
      return;
    }
    if(!document.hidden) void checkVerification();
  };
  window.addEventListener('focus',onReturn);
  document.addEventListener('visibilitychange',onReturn);
  if(sendNow) await send();
}
async function start() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) throw new Error('setup');
  const [app, authentication, firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')
  ]);
  api = {...authentication, ...firestore};
  const firebase = app.initializeApp(firebaseConfig);
  auth = api.getAuth(firebase);
  db = api.getFirestore(firebase);
  await api.setPersistence(auth, api.browserSessionPersistence);
  document.getElementById('logout-button')?.addEventListener('click', logout);
  let stopNotifications;
  api.onAuthStateChanged(auth, async user => {
    stopNotifications?.();
    document.getElementById('account-notification')?.remove();
    if(user)stopNotifications=api.onSnapshot(api.doc(db,'userNotifications',user.uid),snapshot=>{
      document.getElementById('account-notification')?.remove();
      if(!snapshot.exists()||snapshot.data().read)return;
      const data=snapshot.data();
      const banner=document.createElement('aside');banner.id='account-notification';banner.className='card';banner.setAttribute('role','status');
      const text=document.createElement('p');text.textContent=(window.agroI18n?.t('Your email change was approved. Sign in with your new email and verify it:')||'Your email change was approved. Sign in with your new email and verify it:')+' '+data.email;
      const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent=window.agroI18n?.t('Dismiss')||'Dismiss';
      dismiss.onclick=async()=>{dismiss.disabled=true;try{await api.updateDoc(snapshot.ref,{read:true});}catch{dismiss.disabled=false;}};
      banner.append(text,dismiss);document.body.prepend(banner);
    },()=>{});

    lock();
    if (!protectedRole) {
      if(user && forms.length && !submittingAuth) {
        try {
          await api.reload(user);
          if(!submittingAuth && auth.currentUser?.uid === user.uid && !user.emailVerified && !document.getElementById('email-verification')) await showVerification(user);
        } catch { message('Unable to verify access or load your data. Please refresh to retry.'); }
      }
      return;
    }
    if (!user) { location.replace(localizedUrl(loginUrl())); return; }
    try {
      if (!navigator.onLine) {message('Connect to the internet to use AgroEstimate.');return;}
      await api.reload(user);
      await api.getIdToken(user,true);
      if (!user.emailVerified) { await showVerification(user); return; }
      if (protectedRole === 'admin' && !(await isAdmin(user))) { location.replace(localizedUrl('login.html?role=admin')); return; }
      if (auth.currentUser?.uid !== user.uid) return;
      await saveProfile(user,null);
      if (auth.currentUser?.uid !== user.uid) return;
      window.agriAuthenticated = true;
      document.body.classList.add('access-granted');
      window.agroProfile = {uid:user.uid, name:user.displayName || user.email?.split('@')[0] || 'User', email:user.email || ''};
      try {
        const saved = await api.getDocFromServer(api.doc(db, 'users', user.uid));
        if (auth.currentUser?.uid !== user.uid) return;
        if (saved.exists()) {
          window.agroProfile.name = saved.data().name || window.agroProfile.name;
          window.agroProfile.phone = saved.data().phone || '';
        }
      } catch { /* Authentication profile remains available if Firestore is offline. */ }
      window.dispatchEvent(new CustomEvent('agro-profile-ready', {detail:window.agroProfile}));
      if (protectedRole === 'admin') {
        const {setupAdminFertilizer} = await import('./fertilizer-ui.js?v=verified-4');
        setupAdminFertilizer({api, db, auth});
        const {setupAdminCrops} = await import('./crop-ui.js?v=verified-4');
        setupAdminCrops({api, db, auth});
        const list = document.getElementById('user-list');
        if (list || document.getElementById('admin-analytics')) {
          const result = await api.getDocs(api.collection(db, 'users'));
          if (auth.currentUser?.uid !== user.uid) return;
          if (list) {
            const {renderUsers} = await import('./admin-users.js?v=save-fix-2');
            const functions = await import('https://www.gstatic.com/firebasejs/12.2.1/firebase-functions.js');
            renderUsers({api, db, auth, entries: result.docs, emailEditingEnabled: adminEmailEditingEnabled, updateAccount: functions.httpsCallable(functions.getFunctions(firebase), 'adminUpdateUser', {timeout:15000})});
          }
          if (document.getElementById('admin-analytics')) {
            const {setupAnalytics} = await import('./analytics.js?v=history-free-8');
            setupAnalytics({api,db,auth}, result.docs.map(entry=>entry.data()));
          }
        }
        if(document.getElementById('email-requests')) {
          const {setupEmailRequests} = await import('./email-requests.js?v=details-1');
          await setupEmailRequests({api,db});
        }
        if(document.getElementById('phone-requests')) {
          const {setupPhoneRequests} = await import('./phone-requests.js?v=history-2');
          await setupPhoneRequests({api,db});
        }
      } else if (document.getElementById('personal-history')) {
        const {setupHistory} = await import('./history.js?v=online-2');
        await setupHistory({api,db,auth},user.uid);
      } else if (document.getElementById('fertilizer-form')) {
        const {setupFertilizerCalculator} = await import('./fertilizer-ui.js?v=verified-4');
        await setupFertilizerCalculator({api, db, auth});
      } else if (document.getElementById('seed-form') || document.getElementById('yield-form')) {
        const {setupCropCalculator} = await import('./crop-ui.js?v=verified-4');
        await setupCropCalculator(document.getElementById('seed-form') ? 'seed' : 'yield', {api, db, auth});
      }
    } catch { lock(); message('Unable to verify access or load your data. Please refresh to retry.'); }
  });
  forms.forEach(form => {
    form.querySelector('button[type="submit"]').disabled = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if(submittingAuth) return;
      if(!navigator.onLine){message('Connect to the internet to sign in or create an account.');return;}
      submittingAuth = true;
      const button = form.querySelector('button[type="submit"]'); button.disabled = true;
      const registering = form.id === 'register-form';
      const prefix = registering ? 'register' : 'login';
      const adminSignIn = !registering && role === 'admin';
      const username = adminSignIn ? document.getElementById('login-username').value.trim() : '';
      const email = adminSignIn ? adminLogin.email : document.getElementById(`${prefix}-email`).value.trim();
      const password = document.getElementById(`${prefix}-password`).value;
      try {
        if (adminSignIn && username !== adminLogin.username) {
          message('Username must be Admin.'); return;
        }
        if (registering && password !== document.getElementById('register-confirm-password').value) { message('Passwords do not match.'); return; }
        const phone = registering ? document.getElementById('register-phone').value : '';
        if (registering && !/^[6-9][0-9]{9}$/.test(phone)) { message('Enter exactly 10 digits starting with 6, 7, 8, or 9.'); return; }
        message(registering ? 'Creating your account…' : 'Checking your credentials…');
        const credential = registering ? await api.createUserWithEmailAndPassword(auth, email, password) : await api.signInWithEmailAndPassword(auth, email, password);
        if (registering) {
          await api.updateProfile(credential.user, {displayName: document.getElementById('register-name').value.trim()});
          try {
            // Keep the number across email verification, refreshes and other devices.
            await api.setDoc(api.doc(db, 'registrationDetails', credential.user.uid), {phone});
          } catch {
            message('Your account was created, but your phone number could not be saved. Please log in and add it in Settings.');
            await api.signOut(auth);
            return;
          }
        }
        await api.reload(credential.user);
        if (!credential.user.emailVerified) { await showVerification(credential.user,registering); return; }
        await api.getIdToken(credential.user,true);
        if (!registering && role === 'admin' && !(await isAdmin(credential.user))) {
          await api.signOut(auth); message('This account does not have administrator access.'); return;
        }
        try { await saveProfile(credential.user, registering ? document.getElementById('register-name').value.trim() : null); }
        catch { await api.signOut(auth); message('Your account exists, but its profile could not be saved. Check the database setup, then log in again.'); return; }
        location.assign(localizedUrl(!registering && role === 'admin' ? 'admin.html' : next));
      } catch (error) {
        if (auth.currentUser) await api.signOut(auth).catch(() => {});
        message(adminSignIn && ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(error.code)
          ? 'Username or password is incorrect.' : friendlyError(error));
      } finally { submittingAuth = false; button.disabled = false; }
    });
  });
}
start().catch(() => {
  lock();
  if (protectedRole) location.replace(localizedUrl(loginUrl()));
  else message('Sign-in is currently unavailable. The site owner needs to finish the Firebase setup or check the connection.');
});
// Re-check authentication when a page is restored from the browser back/forward cache.
window.addEventListener('pageshow', event => { if (event.persisted && protectedRole) { lock(); location.reload(); } });
let checkingVerification = false;
document.addEventListener('visibilitychange', async () => {
  if (document.getElementById('email-verification') || document.hidden || !protectedRole || !auth?.currentUser || checkingVerification || !navigator.onLine) return;
  checkingVerification = true;
  try {
    const user=auth.currentUser;
    await api.reload(user);
    if(auth.currentUser?.uid !== user.uid) return;
    if(!user.emailVerified) {
      lock();
      if(!document.getElementById('email-verification')) await showVerification(user);
    }
  } catch { lock(); message('Unable to verify access or load your data. Please refresh to retry.'); }
  finally { checkingVerification=false; }
});

window.saveAgroProfile = async () => {
  throw new Error('Only an administrator can edit registered details.');
};

window.resetAgroPassword = async () => {
  if (!auth?.currentUser?.email) throw new Error('Please log in again.');
  await api.sendPasswordResetEmail(auth, auth.currentUser.email);
};

window.changeAgroPassword = async (current, nextPassword) => {
 if(!navigator.onLine)throw new Error('Account changes need an internet connection.');
 const user=auth?.currentUser;
 if(!user?.email || !window.agriAuthenticated) throw new Error('Please log in again.');
 if(nextPassword.length<12 || !/[A-Z]/.test(nextPassword) || !/[a-z]/.test(nextPassword) || !/[0-9]/.test(nextPassword) || !/[^A-Za-z0-9\s]/.test(nextPassword)) throw new Error('Use at least 12 characters with uppercase, lowercase, a number, and a symbol.');
 try {
  await api.reauthenticateWithCredential(user,api.EmailAuthProvider.credential(user.email,current));
  await api.updatePassword(user,nextPassword);
 } catch(error) {
  throw new Error(['auth/invalid-credential','auth/wrong-password'].includes(error.code) ? 'Your current password is incorrect.' : error.code==='auth/weak-password' || error.code==='auth/password-does-not-meet-requirements' ? 'Choose a stronger password that meets your account password requirements.' : error.code==='auth/too-many-requests' ? 'Too many attempts. Please wait before trying again.' : 'Could not change your password. Check your connection and try again.');
 }
};

window.requestAgroEmailChange = async ({newEmail,reason,details}) => {
 if(!navigator.onLine)throw new Error('Account changes need an internet connection.');
 const user=auth?.currentUser;
 if(!user || !window.agriAuthenticated) throw new Error('Please log in again.');
 newEmail=newEmail.trim();details=details.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || newEmail.length>254) throw new Error('Enter a valid new email.');
 if(newEmail.toLowerCase()===user.email.toLowerCase()) throw new Error('Enter a different email address.');
 if(!['Lost access to my email','Incorrect email address','Switching to a new email','Other'].includes(reason)||details.length>1000||(reason==='Other'&&details.length<10)) throw new Error('Choose a reason and add at least 10 characters of explanation for Other.');
 try {await api.setDoc(api.doc(db,'emailChangeRequests',user.uid),{uid:user.uid,name:window.agroProfile.name,currentEmail:user.email,newEmail,reason,details,status:'pending',createdAt:api.serverTimestamp()});}
 catch {throw new Error('Unable to send the request. Check your connection and the updated Firebase rules.');}
};

window.requestAgroPhoneChange = async ({newPhone,reason,details}) => {
 if(!navigator.onLine)throw new Error('Account changes need an internet connection.');
 const user=auth?.currentUser;
 if(!user || !window.agriAuthenticated)throw new Error('Please log in again.');
 if(!/^[6-9][0-9]{9}$/.test(newPhone))throw new Error('Enter exactly 10 digits starting with 6, 7, 8, or 9.');
 details=details.trim();
 if(!['Lost access to my phone number','Incorrect phone number','Switching to a new phone number','Other'].includes(reason)||details.length>1000||(reason==='Other'&&details.length<10))throw new Error('Choose a reason and add at least 10 characters of explanation for Other.');
 const profile=await api.getDocFromServer(api.doc(db,'users',user.uid));
 if(!profile.exists())throw new Error('Please log in again.');
 const currentPhone=profile.data().phone||'';
 if(newPhone===currentPhone)throw new Error('Enter a different phone number.');
 try {await api.addDoc(api.collection(db,'phoneChangeRequests'),{uid:user.uid,name:profile.data().name,currentPhone,newPhone,reason,details,status:'pending',createdAt:api.serverTimestamp()});}
 catch {throw new Error('Unable to send the request. Check your connection and the updated Firebase rules.');}
};
