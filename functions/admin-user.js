// Dependency injection keeps authorization and validation testable without live accounts.
exports.makeUpdateUser = ({auth, db, HttpsError}) => async request => {
  const actor = request.auth;
  if (!actor || actor.token.email_verified !== true) throw new HttpsError('permission-denied', 'Administrator access required.');
  if (!(await db.doc(`admins/${actor.uid}`).get()).exists) throw new HttpsError('permission-denied', 'Administrator access required.');
  const {uid, name, email, phone} = request.data || {};
  if (typeof uid !== 'string' || !uid || uid.includes('/') || uid.length > 128 ||
      typeof name !== 'string' || !name.trim() || name.length > 200 ||
      typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof phone !== 'string' || !/^[6-9][0-9]{9}$/.test(phone)) {
    throw new HttpsError('invalid-argument', 'Enter a name, valid email and 10-digit phone number starting with 6–9.');
  }
  const ref = db.doc(`users/${uid}`);
  if (!(await ref.get()).exists) throw new HttpsError('not-found', 'Member profile not found.');
  const account = await auth.getUser(uid);
  const emailChanged = account.email?.toLowerCase() !== email.toLowerCase();
  if (emailChanged && (await db.doc(`admins/${uid}`).get()).exists) {
    throw new HttpsError('failed-precondition', 'Change administrator login emails in Firebase and update the configured login alias.');
  }
  try {
    await auth.updateUser(uid, {displayName: name.trim(), ...(emailChanged ? {email, emailVerified: false} : {})});
  } catch (error) {
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'This email is already used by another account.');
    throw new HttpsError('internal', 'Could not update the login account. Try again.');
  }
  // Auth is authoritative for email. Retrying completes a failed profile write.
  try { await ref.update({name: name.trim(), email: emailChanged ? email : account.email, phone}); }
  catch { throw new HttpsError('unavailable', 'The login account was updated, but profile saving failed. Retry Save to finish.'); }
  return {name: name.trim(), email: emailChanged ? email : account.email, phone, emailChanged};
};
