import { issuePrincipalCertificate } from "@bsk/crypto";
import { ca } from "./crypto.js";
import { principalKey, principals } from "./state.js";
import type { PrincipalRecord } from "./types.js";

type CertifiablePrincipal = Pick<PrincipalRecord, "role" | "subjectId" | "publicKeys">;

export type CertificateClaim = Pick<PrincipalRecord, "role" | "subjectId"> & {
  certificatePem: string;
};

const compactPem = (pem: string) => pem.replace(/\s+/g, "");

export function issueCertificate(principal: CertifiablePrincipal): string {
  return issuePrincipalCertificate({
    authority: ca,
    role: principal.role,
    subjectId: principal.subjectId,
    publicKeyPem: principal.publicKeys.exchangePublicKeyPem,
  });
}

export function validateCertificate(claim: CertificateClaim): PrincipalRecord {
  const record = principals.get(principalKey(claim.role, claim.subjectId));

  if (!record || compactPem(record.certificatePem) !== compactPem(claim.certificatePem)) {
    throw new Error(`${claim.role} certificate does not match the one issued by TTP`);
  }

  return record;
}
