import { describe, expect, it } from "bun:test";

import { serverAuthenticationPayload, userAuthenticationPayload } from "../src/contract";

describe("TTP contract payloads", () => {
  it("builds the canonical server authentication payload", () => {
    expect(
      serverAuthenticationPayload({
        serverId: "server-1",
        certificatePem: "server-cert",
        requestId: "request-1",
        userId: "user-1",
      }),
    ).toBe(
      '{"certificateHash":"54bd2779e2817d5eebb678c7f47fa262f64928971f2947992bc9c61b270db766","requestId":"request-1","role":"server","serverId":"server-1","userId":"user-1"}',
    );
  });

  it("builds the canonical user authentication payload", () => {
    expect(
      userAuthenticationPayload({
        userId: "user-1",
        userCertificatePem: "user-cert",
        serverId: "server-1",
        serverCertificatePem: "server-cert",
        requestId: "request-1",
      }),
    ).toBe(
      '{"requestId":"request-1","role":"user","serverCertificateHash":"54bd2779e2817d5eebb678c7f47fa262f64928971f2947992bc9c61b270db766","serverId":"server-1","userCertificateHash":"ac6a0d449dad39add273f55b4a3e2fad02b6af20921925fceef5bbaadce0680b","userId":"user-1"}',
    );
  });
});
