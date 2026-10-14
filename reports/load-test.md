# Local load test — 14 October 2026

Target: existing Python `http.server` at `127.0.0.1:8000`. Tests and server ran on the same Mac.

100 journeys per stage, alternating home, registration and login pages. Each journey fetched the HTML and locally referenced scripts, styles, images and CSS backgrounds, with at most six parallel asset requests. No browser cache. JavaScript was downloaded but not executed; external Firebase SDK downloads, rendering and live Firebase calls are excluded.

| Concurrent journeys | Passed | Failed | p95 elapsed |
|---:|---:|---:|---:|
| 10 | 100 | 0 | 0.45 s |
| 25 | 100 | 0 | 1.00 s |
| 50 | 100 | 0 | 3.27 s |
| 100 | 72 | 28 | 7.78 s |

Failures were connection timeouts. The 100-journey stage can produce up to 600 simultaneous asset requests, so this is a cold-download burst, not 100 humans steadily browsing. Latency includes failed journeys.

An initial exploratory run excluding CSS backgrounds passed at 10 and 25 concurrency, but had 16 failures at 50 and 2 at 100. Run-to-run variation precludes a dependable capacity threshold.

These results measure the local development server and client together, not production hosting capacity. Do not use Python http.server as the production web server. No production accounts were created and no live verification emails were sent.

Reproduce static test: `node tests/load/run.mjs static`. Raw output: `reports/load-static.json`.

## Isolated Authentication test

Project: `demo-agroestimate-load`, loopback Authentication emulator on port 19099. At each of 10, 25, 50 and 100 concurrent journeys, all 100 attempts passed (400 total). Each journey creates a unique account, updates its display name, requests an emulator-only verification email, simulates successful verification using the emulator Admin API, signs in, and checks the returned UID, email, name and verification state. No live emails are sent.

These are REST/API tests reproducing the registration operations, not browser automation of `auth.js`. Emulator timings do not predict live Firebase throughput or include real password-hashing, abuse protection, email delivery or network latency.

Firestore concurrency was not tested: its 137 MB emulator download was still incomplete after several minutes and was stopped. Therefore registration profile writes and deployed security rules have not been validated under load.

Reproduce: start the Firebase Authentication emulator for project `demo-agroestimate-load` on 127.0.0.1:19099, then run `node tests/load/run.mjs auth-only`. The script also supports `registration` with Firestore on 18080 and the repository rules loaded, but that mode was not executed.

## Next validation before a large launch

Repeat bounded page tests against the deployed hosting URL, then test the full browser registration flow in a dedicated staging Firebase project. Production signup and verification-email quotas still apply.
