# Performance issue fixed: in-browser RSA-4096 key generation froze the UI

## Symptom before the fix

Clicking **Register** in the client used to freeze the page for tens of seconds. The whole
tab was unresponsive (no spinner animation, no input) until registration finished.
This first surfaced when adding the Playwright E2E tests: the happy-path test needed
30–60 s timeouts, and a single click that triggers key generation blocked Playwright
from talking to the page for longer than its default 15 s action timeout.

Measured wall-clock for the keygen-heavy steps in the E2E run (headless Chromium):

| Step (E2E test)                            | Time  |
| ------------------------------------------ | ----- |
| Register (2× RSA-4096 keygen, browser)     | ~33 s |
| Close session (register + authenticate)    | ~56 s |
| Reset (register + authenticate + exchange) | ~30 s |

## Root cause

### 1. RSA-4096 is mandated, so it is not the thing to change

The formal requirements state:

> The RSA algorithm with a 4096-length key must be used.

So the **key size is fixed at 4096 bits** and the algorithm is fixed to RSA. We keep
both. (Other mandated parameters we already satisfy and keep: AES-256 for session
keys, a PRNG for session-key generation, SHA-256 for hashing/signatures.)

### 2. Each identity needs two key pairs (by design, not waste)

Registration generates **two** 4096-bit pairs per identity:

- `apps/client/src/lib/security-flow.ts:21-22` (User)
- `apps/server/src/protocol.ts:26-27` (Server)

```ts
const [authKeyPair, exchangeKeyPair] = await Promise.all([rsa.generatePair(), rsa.generatePair()]);
```

The split is intentional: the **auth key** is used only for signing
(`rsa.privateKey(...).sign(...)`), and the **exchange key** is used only for
encryption (the TTP encrypts the AES session key to the exchange public key with
RSA-OAEP-SHA256; the identity decrypts it with the exchange private key). Separating
signing and encryption keys is standard hygiene — and it is also required if we move
to the Web Crypto API, where a key is bound to one algorithm/usage at generation time.
So two pairs stays.

### 3. The culprit was synchronous, pure-JS keygen on the browser main thread

Before the fix, all key generation went through `node-forge`
(`packages/crypto/src/crypto.ts`). Identity key generation was:

```ts
// packages/crypto/src/crypto.ts:146
generatePair(): RsaPair {
  const pair = forge.pki.rsa.generateKeyPair({ bits: RSA_BITS, workers: -1 });
  ...
}
```

Two problems made this slow:

- **It is the synchronous form.** `generateKeyPair(options)` with no callback runs the
  entire prime search on the calling thread. In the browser that is the **main/UI
  thread**, so the page is frozen for the whole computation.
- **`workers: -1` does nothing here.** The `workers` option only takes effect in the
  _asynchronous_ form `generateKeyPair(options, callback)`, which offloads the prime
  search to Web Workers. In the synchronous form it is silently ignored. So the code
  _looks_ like it intends to parallelize, but it never does.

**Why pure-JS keygen is slow:** generating a 4096-bit RSA key means finding two random
~2048-bit primes and running Miller–Rabin primality tests, i.e. heavy big-integer
modular exponentiation. node-forge does this in hand-rolled JavaScript bignum. A
browser JS engine is far slower at this than a native bignum (OpenSSL/BoringSSL).

**Why it was fine on the server but not the client:** the same call took ~0.5 s under
Bun (`apps/server`, `apps/ttp`) but tens of seconds in the browser, because Bun's
node-forge runs on a much faster runtime/bignum path. The bottleneck is **browser-only**.

Measured here:

| Environment                                             | One RSA-4096 keygen                      |
| ------------------------------------------------------- | ---------------------------------------- |
| node-forge, sync, Bun                                   | ~0.5 s                                   |
| node-forge, sync, browser (observed)                    | ~15–25 s each (×2 ≈ 30–50 s, UI blocked) |
| **Web Crypto API, native** (Bun, ≈ browser native path) | ~0.5–1.4 s, non-blocking                 |
| **Web Crypto API, two keys in parallel**                | ~0.6 s                                   |

## Implemented fix

### Use the Web Crypto API for key generation, keep node-forge for everything else

`crypto.subtle.generateKey` is built into every modern browser (and Bun/Node). It is
**native** (BoringSSL-class speed) and **asynchronous** (runs off the UI thread, so no
freeze). It keeps the 4096-bit requirement.

Integration is small because we only use Web Crypto for the _generation_ step, then
export to PEM and let node-forge keep doing all certificate/signing/OAEP work exactly
as today:

- Generate RSA-4096 key material with Web Crypto.
- `exportKey("spki" | "pkcs8")` → wrap in PEM → this yields the same `RsaPair`
  `{ publicKeyPem, privateKeyPem }` shape the rest of the code already consumes.
- Forge still applies the existing signature and RSA-OAEP-SHA256 behavior when the
  keys are used.

This was verified end-to-end: a key generated by Web Crypto, exported to PEM, and
imported by node-forge produces a valid `forge` sign/verify **and** a valid RSA-OAEP
encrypt/decrypt roundtrip. No changes are needed to certificates, signing, or the
hybrid-encryption helpers.

Additional easy wins that stack on top:

- **Generate the two pairs in parallel** with `Promise.all([...])` (implemented):
  two pairs complete in ~0.6 s instead of running sequentially.
- **Pre-warm on page load**: kick off the user's key generation in the background when
  the page mounts, so the keys are usually ready by the time the user clicks Register.
- **Cache/reuse** the user's keys (e.g. in `sessionStorage`) so repeated
  Register/Reset cycles during a demo don't regenerate from scratch.

### API change

`rsa.generatePair()` is now async and returns a `Promise<RsaPair>`.

Both real identity registration call sites (`registerIdentities`,
`registerProtectedServer`) now generate the auth and exchange pairs in parallel. The
TTP CA keygen (`createCertificateAuthority`, server-side, ~0.5 s) stays on synchronous
node-forge because it is startup-only and not the bottleneck.

### Status

- **Implemented:** Web Crypto key generation across both browser and server/Bun
  identity registration paths.
- **Not included:** pre-warm / sessionStorage caching. That remains an optional
  follow-up.

### Alternatives considered

- **node-forge async + Web Workers** (`generateKeyPair({ bits, workers }, cb)`): keeps
  pure JS so it is still much slower than native, and wiring the forge worker script
  through Vite is fragile. Rejected in favour of Web Crypto.
- **Server-side keygen** (generate the user's keys in Bun, send to the browser):
  fast, but the private key would leave the machine it belongs to, weakening the
  security model the project is meant to demonstrate. Rejected.
- **Smaller keys / fewer keys**: not allowed — 4096-bit is mandated, and the two-key
  split is needed for correct sign-vs-encrypt separation.

## Requirements compliance after the fix

| Requirement                       | Still satisfied?                         |
| --------------------------------- | ---------------------------------------- |
| RSA with 4096-bit key             | Yes — same size, just generated natively |
| PRNG for session keys             | Yes — unchanged                          |
| AES-256 session key               | Yes — unchanged                          |
| SHA-256                           | Yes — unchanged                          |
| Status icons / Server & TTP logs  | Yes — unchanged                          |
| "Available libraries may be used" | Yes — Web Crypto is a standard library   |
