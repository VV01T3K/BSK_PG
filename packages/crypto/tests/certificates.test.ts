import { beforeAll, describe, expect, it } from "bun:test";

import forge from "node-forge";

import {
  type CertificateAuthority,
  createCertificateAuthority,
  issueIdentityCertificate,
  rsa,
  verifyCertificateSignedBy,
} from "../src/index";

type ExtKeyUsage = { clientAuth?: boolean; serverAuth?: boolean };

describe("certificates", () => {
  let ca: CertificateAuthority;
  let identityPublicKeyPem: string;

  beforeAll(async () => {
    ca = await createCertificateAuthority({ commonName: "BSK PG Test CA", organization: "BSK PG" });
    identityPublicKeyPem = (await rsa.generatePair()).publicKeyPem;
  }, 60_000);

  it("returns parseable PEM-encoded keys and certificate", () => {
    expect(() => forge.pki.privateKeyFromPem(ca.privateKeyPem)).not.toThrow();
    expect(() => forge.pki.publicKeyFromPem(ca.publicKeyPem)).not.toThrow();
    expect(() => forge.pki.certificateFromPem(ca.certificatePem)).not.toThrow();
  });

  it("creates a self-signed CA certificate with basicConstraints cA:true", () => {
    const cert = forge.pki.certificateFromPem(ca.certificatePem);
    const basicConstraints = cert.getExtension("basicConstraints") as { cA?: boolean } | undefined;
    expect(basicConstraints?.cA).toBe(true);
    expect(cert.subject.getField("CN")?.value).toBe("BSK PG Test CA");
    expect(cert.isIssuer(cert)).toBe(true);
  });

  it("issues an identity certificate signed by the CA", () => {
    const pem = issueIdentityCertificate({
      authority: ca,
      role: "user",
      subjectId: "user-123",
      publicKeyPem: identityPublicKeyPem,
    });
    const cert = forge.pki.certificateFromPem(pem);

    expect(cert.subject.getField("CN")?.value).toBe("user:user-123");
    expect(cert.issuer.getField("CN")?.value).toBe("BSK PG Test CA");
    expect(ca.certificate.verify(cert)).toBe(true);
  });

  it("verifies a genuine certificate and rejects a forged one (man-in-the-middle)", async () => {
    const genuine = issueIdentityCertificate({
      authority: ca,
      role: "server",
      subjectId: "s",
      publicKeyPem: identityPublicKeyPem,
    });
    const rogue = await createCertificateAuthority({ commonName: "Rogue", organization: "X" });
    const forged = issueIdentityCertificate({
      authority: rogue,
      role: "server",
      subjectId: "s",
      publicKeyPem: identityPublicKeyPem,
    });

    expect(verifyCertificateSignedBy(ca, genuine).commonName).toBe("server:s");
    expect(() => verifyCertificateSignedBy(ca, forged)).toThrow(/not signed by the trusted/);
  });

  it("reflects the identity role in extKeyUsage", () => {
    const userCert = forge.pki.certificateFromPem(
      issueIdentityCertificate({
        authority: ca,
        role: "user",
        subjectId: "u",
        publicKeyPem: identityPublicKeyPem,
      }),
    );
    const serverCert = forge.pki.certificateFromPem(
      issueIdentityCertificate({
        authority: ca,
        role: "server",
        subjectId: "s",
        publicKeyPem: identityPublicKeyPem,
      }),
    );

    const userExt = userCert.getExtension("extKeyUsage") as ExtKeyUsage;
    const serverExt = serverCert.getExtension("extKeyUsage") as ExtKeyUsage;

    expect(userExt.clientAuth).toBe(true);
    expect(userExt.serverAuth).toBeFalsy();
    expect(serverExt.serverAuth).toBe(true);
    expect(serverExt.clientAuth).toBeFalsy();
  });
});
