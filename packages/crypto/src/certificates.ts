import forge from "node-forge";
import { random } from "./crypto";
import type {
  CertificateAuthority,
  CertificateAuthorityOptions,
  PrincipalCertificateInput,
} from "./types";

const RSA_BITS = 4096;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createCertificateAuthority(options: CertificateAuthorityOptions): CertificateAuthority {
  const keys = forge.pki.rsa.generateKeyPair({ bits: RSA_BITS, workers: -1 });
  const cert = forge.pki.createCertificate();
  const attrs = [
    { name: "commonName", value: options.commonName },
    { name: "organizationName", value: options.organization },
  ];

  cert.publicKey = keys.publicKey;
  cert.serialNumber = random.hex(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + (options.validDays ?? 365) * DAY_MS);
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
    certificate: cert,
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
    certificatePem: forge.pki.certificateToPem(cert),
  };
}

export function issuePrincipalCertificate(input: PrincipalCertificateInput): string {
  const cert = forge.pki.createCertificate();

  cert.publicKey = forge.pki.publicKeyFromPem(input.publicKeyPem);
  cert.serialNumber = random.hex(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + (input.validDays ?? 30) * DAY_MS);
  cert.setSubject([
    { name: "commonName", value: `${input.role}:${input.subjectId}` },
    { name: "organizationName", value: input.organization ?? "BSK PG Demo Principal" },
  ]);
  cert.setIssuer(input.authority.certificate.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    {
      name: "extKeyUsage",
      clientAuth: input.role === "user",
      serverAuth: input.role === "server",
    },
    {
      name: "subjectAltName",
      altNames: [{ type: 6, value: `urn:bsk-pg:${input.role}:${input.subjectId}` }],
    },
  ]);
  cert.sign(input.authority.privateKey, forge.md.sha256.create());

  return forge.pki.certificateToPem(cert);
}
