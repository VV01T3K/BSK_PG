import forge from "node-forge";

import { random, rsa } from "./crypto";
import type {
  CertificateAuthority,
  CertificateAuthorityOptions,
  IdentityCertificateInput,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Creates the self-signed TTP certificate authority.
 * @param options Certificate subject and validity settings.
 * @returns PEM keys and the forge certificate object used for signing identity certificates.
 */
export async function createCertificateAuthority(
  options: CertificateAuthorityOptions,
): Promise<CertificateAuthority> {
  const pair = await rsa.generatePair();
  const privateKey = forge.pki.privateKeyFromPem(pair.privateKeyPem);
  const cert = forge.pki.createCertificate();
  const attrs = [
    { name: "commonName", value: options.commonName },
    { name: "organizationName", value: options.organization },
  ];

  cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKeyPem);
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
  cert.sign(privateKey, forge.md.sha256.create());

  return {
    privateKey,
    certificate: cert,
    privateKeyPem: pair.privateKeyPem,
    publicKeyPem: pair.publicKeyPem,
    certificatePem: forge.pki.certificateToPem(cert),
  };
}

/**
 * Issues a TTP-signed X.509 identity certificate.
 * @param input Registered identity, exchange public key and issuing authority.
 * @returns PEM-encoded X.509 certificate for the User or Server exchange key.
 */
export function issueIdentityCertificate(input: IdentityCertificateInput): string {
  const cert = forge.pki.createCertificate();

  cert.publicKey = forge.pki.publicKeyFromPem(input.publicKeyPem);
  cert.serialNumber = random.hex(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + (input.validDays ?? 30) * DAY_MS);
  cert.setSubject([
    { name: "commonName", value: `${input.role}:${input.subjectId}` },
    { name: "organizationName", value: input.organization ?? "BSK PG Demo Identity" },
  ]);
  cert.setIssuer(input.authority.certificate.subject.attributes);
  cert.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", keyEncipherment: true },
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

/**
 * Verifies that a certificate chains to the trusted TTP authority.
 * @param authority Trusted TTP certificate authority.
 * @param certificatePem PEM-encoded certificate to validate.
 * @returns The validated certificate common name.
 */
export function verifyCertificateSignedBy(
  authority: CertificateAuthority,
  certificatePem: string,
): { commonName: string } {
  try {
    const certificate = forge.pki.certificateFromPem(certificatePem);
    if (authority.certificate.verify(certificate)) {
      return { commonName: String(certificate.subject.getField("CN")?.value ?? "") };
    }
  } catch {
    // Unparseable PEM or issuer mismatch
  }

  throw new Error("certificate is not signed by the trusted authority");
}
