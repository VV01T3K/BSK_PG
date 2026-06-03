import { beforeAll, describe, expect, it } from "bun:test";

import forge from "node-forge";

import {
  type CertificateAuthority,
  createCertificateAuthority,
  issuePrincipalCertificate,
  rsa,
} from "../src/index";

type ExtKeyUsage = { clientAuth?: boolean; serverAuth?: boolean };

describe("certificates", () => {
  let ca: CertificateAuthority;
  let principalPublicKeyPem: string;

  beforeAll(async () => {
    ca = createCertificateAuthority({ commonName: "BSK PG Test CA", organization: "BSK PG" });
    principalPublicKeyPem = (await rsa.generatePair()).publicKeyPem;
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

  it("issues a principal certificate signed by the CA", () => {
    const pem = issuePrincipalCertificate({
      authority: ca,
      role: "user",
      subjectId: "user-123",
      publicKeyPem: principalPublicKeyPem,
    });
    const cert = forge.pki.certificateFromPem(pem);

    expect(cert.subject.getField("CN")?.value).toBe("user:user-123");
    expect(cert.issuer.getField("CN")?.value).toBe("BSK PG Test CA");
    expect(ca.certificate.verify(cert)).toBe(true);
  });

  it("reflects the principal role in extKeyUsage", () => {
    const userCert = forge.pki.certificateFromPem(
      issuePrincipalCertificate({
        authority: ca,
        role: "user",
        subjectId: "u",
        publicKeyPem: principalPublicKeyPem,
      }),
    );
    const serverCert = forge.pki.certificateFromPem(
      issuePrincipalCertificate({
        authority: ca,
        role: "server",
        subjectId: "s",
        publicKeyPem: principalPublicKeyPem,
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
