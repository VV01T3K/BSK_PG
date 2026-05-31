import { createCertificateAuthority } from "@bsk/crypto";

export const ca = createCertificateAuthority({
  commonName: "BSK PG Trusted Third Party",
  organization: "BSK PG Demo",
});
