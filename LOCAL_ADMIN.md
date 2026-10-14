# Local administrator email changes

This tool runs on the project administrator's computer. It is not a website button or a local web server, and requires no deployed Cloud Function or Firebase Blaze upgrade. Only someone with privileged Google credentials for the project can run it. Typing an administrator email alone does not grant Google access.

## One-time credentials setup

Use Application Default Credentials if already configured with the Google Cloud CLI (`gcloud auth application-default login`). The Google account must have Firebase Authentication user-update and Firestore read/write permissions for `agroestimate`.

Alternatively, in Firebase Console → Project settings → Service accounts → Firebase Admin SDK, generate a private key using an account authorized to do so. Store it outside this project (for example, in a private folder in your home directory). Do not upload it, commit it, or paste it into chat. Set its path in your terminal:

```sh
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/path/outside/project/private-key.json"
```

A service-account key grants privileged project access: keep it only on the trusted administrator's computer.

## Run

From the AgroEstimate folder:

```sh
npm --prefix functions install
node functions/local-admin.cjs
```

Enter the existing administrator email, the member's current login email, and the new email. If a pending request exists, press Enter to use its requested email. Check the displayed change, then type `CHANGE` to apply it.

The tool updates Firebase Authentication and the member profile, completes the email request, and creates the existing in-app notification. It keeps the same account ID and password. The user signs in with the new email and verifies it. No email or SMS notification is sent.

If Firebase Auth updates but the database save fails, rerun with the **new** login email and approve the existing request to finish. Administrator accounts are excluded because their email is also configured as the application's login alias.

The website's email field stays read-only until a secure backend is deployed. This local tool does not make remote dashboard email editing available.
