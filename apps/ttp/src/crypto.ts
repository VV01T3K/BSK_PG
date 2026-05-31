import { randomHex, RSA_BITS } from "@bsk/crypto";
import forge from "node-forge";

function createCertificateAuthority() {
  const keys = forge.pki.rsa.generateKeyPair({ bits: RSA_BITS, workers: -1 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = randomHex(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [
    { name: "commonName", value: "BSK PG Trusted Third Party" },
    { name: "organizationName", value: "BSK PG Demo" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, digitalSignature: true, keyEncipherment: true },
    { name: "subjectKeyIdentifier" },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    privateKey: keys.privateKey,
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
    certificatePem: forge.pki.certificateToPem(cert),
  };
}

export const ca = createCertificateAuthority();
