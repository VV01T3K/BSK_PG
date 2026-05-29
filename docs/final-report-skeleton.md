# BSK/SCS Project Final Report Skeleton

## 1. Realized Task

Describe the separate Client, Server, and Trusted Third Party applications. Note that Docker Compose is used as the final VM-like environment.

## 2. Key Functionality

- User and Server identity generation.
- RSA-4096 key-pair generation.
- TTP registration and X.509 certificate issuance.
- Server and User authentication through TTP.
- AES-256-GCM encrypted service data exchange.
- Rejection of forged certificates and tampered encrypted messages.

## 3. Code Listings

Add selected listings from:

- TTP registration and certificate issuance.
- TTP authentication and session-key distribution.
- Client-to-Server encrypted service exchange.
- Forged certificate and MITM demonstration paths.

## 4. Tests

Describe:

- correct registration and authentication,
- forged certificate rejection,
- AES encryption/decryption,
- message tamper rejection,
- Docker Compose network startup.

## 5. Doxygen Documentation

Generate documentation with:

```sh
doxygen Doxyfile
```

Output is written to `docs/doxygen-output/`.

## 6. Bibliography

- Node.js Crypto API documentation.
- node-forge documentation.
- Hono documentation.
- TanStack Start documentation.
- Course project specification.
