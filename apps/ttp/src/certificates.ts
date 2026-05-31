import { randomHex } from "@bsk/crypto";
import forge from "node-forge";
import { ca } from "./crypto.js";
import { principalKey, principals } from "./state.js";
import type { PrincipalRecord, Role } from "./types.js";

const compactPem = (pem: string) => pem.replace(/\s+/g, "");

export function issueCertificate(role: Role, subjectId: string, exchangePublicKeyPem: string): string {
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(exchangePublicKeyPem);
  cert.serialNumber = randomHex(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  cert.setSubject([
    { name: "commonName", value: `${role}:${subjectId}` },
    { name: "organizationName", value: "BSK PG Demo Principal" },
  ]);
  cert.setIssuer(forge.pki.certificateFromPem(ca.certificatePem).subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    {
      name: "extKeyUsage",
      clientAuth: role === "user",
      serverAuth: role === "server",
    },
    {
      name: "subjectAltName",
      altNames: [{ type: 6, value: `urn:bsk-pg:${role}:${subjectId}` }],
    },
  ]);
  cert.sign(ca.privateKey, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

export function validateCertificate(role: Role, subjectId: string, certificatePem: string): PrincipalRecord {
  const record = principals.get(principalKey(role, subjectId));

  if (!record) {
    throw new Error(`${role} ${subjectId} is not registered`);
  }

  const cert = forge.pki.certificateFromPem(certificatePem);
  const caCert = forge.pki.certificateFromPem(ca.certificatePem);
  const commonName = cert.subject.getField("CN")?.value;
  const certPublicPem = forge.pki.publicKeyToPem(cert.publicKey);

  if (commonName !== `${role}:${subjectId}`) {
    throw new Error(`certificate subject ${commonName ?? "unknown"} does not match ${role}:${subjectId}`);
  }

  if (!caCert.verify(cert)) {
    throw new Error("certificate was not signed by the trusted TTP CA");
  }

  const now = new Date();
  if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
    throw new Error("certificate is outside its validity window");
  }

  if (compactPem(certPublicPem) !== compactPem(record.publicKeys.exchangePublicKeyPem)) {
    throw new Error("certificate public key does not match the registered exchange key");
  }

  if (compactPem(certificatePem) !== compactPem(record.certificatePem)) {
    throw new Error("certificate PEM does not match the registered certificate");
  }

  return record;
}
