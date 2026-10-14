# AgroEstimate

AgroEstimate is a Firebase-backed farm-planning website for estimating fertilizer costs, seed requirements and spacing, and crop yield. It supports English and Marathi, works with hectare, acre, guntha and are units, and includes an administrator area for managing approved calculator datasets and reviewing usage.

**Live site:** [agroestimate.web.app](https://agroestimate.web.app)

## What it does

- Calculates fertilizer quantities and estimated cost from an uploaded crop-rate dataset.
- Calculates seed quantity, row spacing, plant spacing and expected population.
- Estimates yield from an uploaded expected-yield dataset.
- Stores signed-in users' calculation history securely in Cloud Firestore.
- Requires email verification before users can access calculator data.
- Provides administrator tools for calculator-data uploads, registered profiles, change requests and analytics.
- Provides a bilingual interface in English and Marathi.

## Technology

| Area | Technology |
| --- | --- |
| Front end | Static HTML, CSS and browser JavaScript modules |
| Authentication | Firebase Authentication with Email/Password and email verification |
| Data | Cloud Firestore with checked-in security rules and indexes |
| Admin-only workflows | Firebase Cloud Functions for approved email changes and profile editing |
| Hosting | Firebase Hosting |
| Continuous deployment | GitHub Actions on pushes to `main` |

## Project structure

```text
assets/                 Images and branding
functions/              Firebase Cloud Functions
templates/              Spreadsheet templates for calculator data
tests/                  Node.js test suite
firestore.rules         Firestore access controls
firestore.indexes.json  Firestore indexes
firebase.json           Firebase configuration
```

The root HTML, CSS and JavaScript files are the source website files. GitHub Actions rebuilds the deployable `public/` directory before deploying.

## Run locally

1. Clone the repository.
2. Install [Node.js 22](https://nodejs.org/).
3. Serve the project through a local web server:

   ```bash
   python3 -m http.server 8000
   ```

4. Open `http://localhost:8000`.

To use sign-in and cloud data locally, configure the Firebase project as described in [FIREBASE_SETUP.md](FIREBASE_SETUP.md). Add `localhost` to Firebase Authentication's authorized domains.

## Test

Run the complete browser-logic test suite with:

```bash
node --test tests/*.test.mjs
```

## Deploy

Every push to `main` runs the test suite and deploys the website to Firebase Hosting automatically:

```bash
git add .
git commit -m "Describe your change"
git push
```

Changes to Firestore rules, indexes or Cloud Functions are deployed separately. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for the relevant commands and setup notes.

## Data and security

The Firebase web configuration in `firebase-config.js` is public client configuration, not a private service-account credential. Access control is enforced by [Firestore security rules](firestore.rules) and verified Firebase Authentication tokens.

Do not commit service-account JSON files, Firebase tokens, passwords or other credentials. See [SECURITY.md](SECURITY.md) for responsible disclosure guidance.

## Contributing

Contributions and improvements are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

## License

A license has not yet been selected. Until one is added, the repository contents are not granted an open-source reuse license.
