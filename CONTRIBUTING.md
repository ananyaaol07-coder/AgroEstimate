# Contributing to AgroEstimate

Thank you for improving AgroEstimate.

## Before you start

- Search existing issues before reporting a new bug or requesting a feature.
- Keep changes focused on one problem.
- Do not include personal data, Firebase credentials, service-account files or screenshots containing account information.

## Local checks

Run the tests before opening a pull request:

```bash
node --test tests/*.test.mjs
```

For changes to visible pages, also test the relevant page in a browser at desktop and mobile widths.

## Pull requests

1. Create a branch from `main`.
2. Make the smallest useful change.
3. Add or update a meaningful test when behavior changes.
4. Explain the user-visible result and how you tested it.
5. Keep generated credentials and local Firebase files out of commits.

GitHub Actions runs the test suite and deploys approved changes pushed to `main`.

## Calculator data

Calculator datasets are managed through the administrator interface. Do not treat the sample spreadsheet values as agricultural recommendations. Use reviewed, locally appropriate data before publishing it for real users.
