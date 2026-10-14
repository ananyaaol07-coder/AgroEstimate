# Set up Firebase for AgroEstimate

You create the Firebase project and database. The website integration is already prepared.

1. Open https://console.firebase.google.com/ and create a project. Analytics is optional.
2. In Project settings → General, add a Web app (the </> icon), name it AgroEstimate, and register it. Copy its firebaseConfig values into `firebase-config.js`, keeping the existing export. Use only the public web configuration, never a service-account private key.
3. Open Build → Authentication → Get started → Sign-in method. Enable Email/Password and save. The website uses Firebase Authentication to register users and check passwords; passwords are never stored in Firestore.
4. In Authentication → Settings → Authorized domains, add your deployed website's hostname. For local testing, add `localhost` if it is missing.
5. Open Build → Firestore Database → Create database. Choose Standard edition if prompted, the `(default)` database, and your preferred nearby region. Choose production mode rather than test mode.
6. Open the database's Rules tab. Replace the rules with the full contents of `firestore.rules` in this project and click Publish. These rules allow members to create/read their own profile and allow only administrators to list profiles. Client apps cannot grant admin access.
7. Serve the website through a local web server or your website host; do not double-click the HTML files as file:// pages. For example, from the project folder run `python3 -m http.server 8000`, then visit http://localhost:8000.
8. Register an account through the website. The `users` collection and the account's profile are created automatically. Existing demo accounts from the previous browser-only version must register again.

## Give your account administrator access

1. Register your own account through the website first.
2. In Firebase Authentication → Users, copy that account's User UID.
3. In Firestore → Data, start a collection named `admins`.
4. Use that exact UID as the document ID. Add a boolean field named `enabled` with value `true` and save. The document's existence grants administrator permission (the field is descriptive).
5. Open Login on the website, select Login as admin, and enter your registered email and password.
6. To revoke admin access, delete that UID's document from `admins`. Never grant this permission to an untrusted account.

## Checks after setup

- A signed-out visitor sees only the green landing page.
- Choose a calculator opens Login; valid credentials open the calculator selection page.
- Direct visits to calculators.html, fertilizer.html, seed.html, and yield.html while signed out return to Login.
- An incorrect password or an unregistered email cannot log in.
- A normal member cannot access admin.html or list other members' profiles.
- Logout returns to the landing page; Back/refresh must not restore calculator access.
- An admin can view member profiles from another browser after logging in.

Until Firebase is configured, login/registration remain unavailable and protected pages remain closed. No database has been created by Codex.

This is a static website: the UI requires sign-in, and Firestore rules protect member data. The calculator formulas and static HTML remain downloadable like other frontend code; making calculations themselves a private service would require a backend.

Official references:
- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/quickstart
- https://firebase.google.com/docs/rules/basics


## Fertilizer Excel uploads

After the fertilizer upload feature is added, replace the Firebase Console Rules editor contents with the current `firestore.rules` file and Publish again. This adds `calculatorData/fertilizer`: signed-in members can read it, and only administrators can save it. No manual collection creation is needed.

Open the admin dashboard through your local server. Download the sample, choose the .xlsx file, inspect the preview, then click Save fertilizer data. The website saves the parsed rows in Firestore; it does not store the original Excel file. Each save replaces the complete fertilizer dataset atomically. Up to 200 rows and a 2 MB file are supported. Keep the data on the Fertilizer sheet with the supplied headers. Use numeric values, not formulas, and place notes on another sheet.

Members select a crop, season, growing condition, area unit and area. Quantities are stored in kg per ONE selected unit. The calculator multiplies each stored quantity by area, then multiplies by the corresponding INR/kg rate. Acre values are used directly without another area conversion. Reload the calculator to fetch a newly saved dataset. The current sample contains invented quantities and prices only; replace these before real use.


## Seed and yield uploads

Publish the latest firestore.rules again to allow the calculatorData/seed and calculatorData/yield documents. The same admin-only write and signed-in read permissions apply. No manual document creation is needed.

The admin dashboard now has separate Seed rate & spacing and Yield estimation upload sections. Each has its own downloadable sample, preview and Save button. Saving one dataset does not replace another calculator's data. Samples have 120 dummy rows each, covering five crops, three seasons, two growing conditions and four area units. Replace demonstration values with approved values before real use.

Seed uses kg per area unit plus row and plant spacing in centimetres. Continuous sowing is supported instead of numeric plant spacing; no plant population is calculated for those rows. Yield uses expected kg per area unit multiplied by entered land area, with totals also shown in quintals. It no longer uses maize-specific field measurements. Both pages remain unavailable for calculations until their dataset has been uploaded; reload to read newly uploaded data.

## Administrator activity analytics

Publish the current `firestore.rules` in the existing project's Firestore Rules tab to enable the `calculationEvents` collection. The app writes one event after each successful calculator submission. Administrators may read all events, while members may read only events belonging to their own UID. Authenticated users may create validated events only for their own UID with a server timestamp. Updates and deletes are denied. These are browser-reported usage estimates, not independently verified agricultural outcomes.

The dashboard shows existing profile counts and profile creation counts from October 2026. Calculation charts cover the selected 7, 30, 90, 180 or 365 days, starting when this tracking and its rules are active. Each result counts separately. Metrics normalize areas to hectares and keep fertilizer costs, seed quantities and estimated yield separate. Averages per hectare use total output divided by total area. Dashboard queries load calculation events in pages of 10,000 so all records in the selected period contribute to the metrics. The underlying calculation records are not deleted by the app.

Publish the latest rules before using cloud history. Each new calculation is saved as an immutable `calculationEvents` document. The History page displays only the last 3 calendar months for the member on any signed-in browser or device. Administrators can report on the last calendar year. These are display windows; the ownership rules still allow members to read their own underlying records until expiration. Other members cannot read it. The browser keeps up to 200 structured calculations only as an offline cache; exceeding that cache does not delete the Firestore record. Older text-only browser history created before cloud tracking remains local because it does not contain the structured fields required for a secure calculation event.

Local analytics aggregation and calculator tests: `node --test tests/*.test.mjs`. Live rule enforcement must be verified after publishing; this update does not deploy the rules automatically.


### Free-plan history retention

User history displays the last 3 calendar months; admin reports display up to 1 calendar year. No TTL policy, billing, scheduled function, or paid service is needed. Every admin dashboard visit attempts to delete up to 100 calculation events older than 366 days. Rules restrict deletion to administrators and records older than 366 days, preserving at least one full year including leap years. Existing records are handled using their original createdAt timestamp; no migration is required. If no administrator visits or the free quota is exhausted, old records remain until a later successful cleanup. All reads/writes/deletes count against Firebase free quotas. Profiles and calculator uploads are unaffected.

Deploy rules with `npx --yes firebase-tools deploy --only firestore:rules --project agroestimate`.

### Online-only use

The website requires an internet connection. Calculator datasets and cloud history load from the server, and sign-in uses session persistence. Offline page caching and persistent Firestore caching are disabled. The retiring `sw.js` and `online-only.js` remove previously installed AgroEstimate static caches without deleting saved history. Keep these migration files available for returning visitors.

### Required email verification

Registration sends Firebase's hosted email-verification link (not an email OTP). Login and protected pages block unverified accounts, including existing accounts. Users can resend the email or check verification from the sign-in screen. Successful verification refreshes the ID token before saving the profile and continuing. Profiles for new accounts are created after verification. Firestore rules require `email_verified == true` for database access; publish these rules with the corresponding client update. Both administrators and members must verify. No SMS service or billing upgrade is used. The email sender/action template is managed in Firebase Authentication → Templates.

### Registration phone field (no SMS)

Registration requires 10 ASCII digits beginning with 6–9, without a country code. Publish the updated `firestore.rules` before releasing this change (`firebase deploy --only firestore:rules`). The private `registrationDetails/{uid}` document stores the contact number during email verification; profile creation copies it into `users/{uid}` after verification. The number is not SMS-verified. Existing profiles remain supported.

### Administrator user editor

The pencil editor shows name, email, phone and profile creation date. Missing legacy numbers display “Not provided”. Profile name/phone updates are admin-only in Firestore rules; members can still change their own password and request an email change. Passwords are never stored in profiles or returned to administrators.

Deploy updated rules before publishing the UI. Name/phone editing uses Firestore. Email editing additionally requires the `adminUpdateUser` callable function (Node 22, us-central1) and a Firebase Blaze project:

```sh
npm --prefix functions install
firebase deploy --project agroestimate --only firestore:rules,functions:adminUpdateUser
```

The function checks a verified admin token and the existing `admins/{uid}` marker. It updates Firebase Auth before the profile and resets verification for a changed email. If the profile write fails after Auth succeeds, retry Save with the same values to finish; never treat a partial failure as success. Administrator email changes are rejected because the app uses a configured admin login alias. No SMS is sent. The list contains saved member profiles, created after email verification, not unfinished Auth signups.

### Automatic email request approval

Deploy `functions:approveEmailChange` on Blaze in addition to the rules. Approve updates Firebase Authentication, resets email verification, updates the profile, completes the request and creates an in-app `userNotifications/{uid}` notification. No email/SMS notification delivery service is configured. UID remains an internal identifier and is not displayed on email request cards. Processing requests are locked against client changes; retry approval repairs an Auth-only partial success. Users verify the new email through the existing login verification flow. Function deployment was blocked by the project's non-Blaze plan on 12 October 2026.
