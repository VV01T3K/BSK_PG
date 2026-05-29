# Security of Computer Systems Project Report

## 1. Realized Task

The project implements a three-application environment for authenticated and encrypted Client-Server data exchange with a Trusted Third Party.

The applications are:

- **Client** (`apps/client`) - browser application used by the User to register, request service access, authenticate through the TTP, exchange encrypted service data, and run attack demonstrations.
- **Server** (`apps/server`) - protected service provider. It registers with the TTP, authenticates itself, receives the AES session key encrypted for its RSA public key, decrypts Client service requests, and returns encrypted responses.
- **TTP** (`apps/ttp`) - Trusted Third Party. It issues X.509 certificates, validates User and Server certificates, generates AES-256 session keys, distributes session keys encrypted with public RSA keys, and logs authentication events.

Docker Compose runs the three applications as separate services:

- Client: `http://localhost:3000`
- TTP: `http://localhost:3001`
- Server: `http://localhost:3002`

## 2. Architecture and Protocol Flow

The implemented flow follows the assignment scenario:

1. Client and Server generate SHA-256 based public IDs.
2. Client and Server generate two RSA-4096 key pairs.
3. Client and Server encrypt their IDs with the TTP public key and register with the TTP.
4. TTP issues X.509 certificates for both parties.
5. Client requests access to the protected Server service.
6. Server asks TTP to authenticate its certificate.
7. Client sends encrypted authentication material to TTP.
8. TTP validates both certificates and generates an AES-256 session key.
9. TTP encrypts the session key separately for Client and Server.
10. Client and Server exchange AES-256-GCM encrypted service messages.
11. Demo actions show forged-certificate rejection and tampered-message rejection.

## 3. Key Implementation Details

### TTP certificate issuing and validation

The TTP creates an RSA-4096 certificate authority key pair when it starts. During registration, it decrypts the submitted ID, stores the submitted public keys, and signs an X.509 certificate for the registering role.

Relevant code:

- `apps/ttp/src/index.ts`
- functions: `createCertificateAuthority`, `issueCertificate`, `validateCertificate`

### Session key generation and distribution

After validating User and Server certificates, the TTP creates a 32-byte AES-256 session key using a cryptographically secure pseudorandom generator. It sends the key encrypted separately for the User and Server exchange public keys.

Relevant code:

- `apps/ttp/src/index.ts`
- endpoint: `POST /api/auth/user`

### Protected Server service

The Server application registers independently with TTP and keeps its own private exchange key. It accepts the session key envelope intended for the Server, decrypts it locally, and uses AES-256-GCM to decrypt Client requests and encrypt service responses.

Relevant code:

- `apps/server/src/routes.ts`
- `apps/server/src/crypto.ts`
- `apps/server/src/state.ts`
- endpoints: `POST /api/server/register`, `POST /api/server/authenticate`, `POST /api/server/accept-session`, `POST /api/service/exchange`

### Client application

The Client drives the demonstration from a TanStack Start SPA. It uses browser Web Crypto for User RSA/AES operations, keeps keys and session material in memory, calls TTP and Server through Hono RPC clients, decrypts the Client session key, and sends encrypted requests to the Server.

Relevant code:

- `apps/client/src/demo/actions.ts`
- `apps/client/src/demo/browser-crypto.ts`
- `apps/client/src/api/ttp-client.ts`
- `apps/client/src/routes/_guard/index.tsx`

## 4. Tests and Demonstration Scenarios

Automated tests cover:

- User and Server registration.
- X.509 certificate issuance and validation.
- AES-256 session key generation and distribution.
- AES-256-GCM encryption/decryption round trip.
- Forged certificate rejection.
- Tampered ciphertext rejection.
- Full three-application flow using Client, Server, and TTP apps.

Run tests with:

```sh
bun run test
```

Run all checks with:

```sh
bun run ready
```

## 5. Docker Compose Environment

The final demo environment is started with:

```sh
docker compose up --build
```

Health endpoints:

- `GET http://localhost:3000/`
- `GET http://localhost:3001/api/health`
- `GET http://localhost:3002/api/health`

This setup represents the required separated environment: TTP and Server run as distinct services, and the Client runs separately as the user-facing application.

## 6. Doxygen Documentation

Doxygen configuration is stored in `Doxyfile`.

Generate documentation with:

```sh
doxygen Doxyfile
```

Generated HTML output is written to:

```text
docs/doxygen-output/html/index.html
```

The generated output is ignored by Git to avoid committing generated files.

## 7. Bibliography

- Project specification: `docs/ENG_SCS_2026_project_v1.1_markdown.md`
- Node.js Crypto API documentation
- node-forge documentation
- Hono documentation
- TanStack Start documentation
- Docker Compose documentation
