import { beforeEach, describe, expect, it } from "bun:test";

import { aesGcm, random } from "@bsk/crypto";

import { exchangeProtectedServiceData } from "../src/protocol";
import { resetServiceServerState, state } from "../src/state";

describe("protected demo file service", () => {
  beforeEach(() => {
    resetServiceServerState();
  });

  it("uploads and views one file through the encrypted session", () => {
    const sessionId = "session-test";
    const sessionKey = random.sessionKey();
    const sessionCipher = aesGcm.withKey(sessionKey).forSession(sessionId);
    const request = {
      kind: "file.upload",
      name: "demo.txt",
      mimeType: "text/plain",
      contentBase64: Buffer.from("hello from the protected service").toString("base64"),
    };

    state.sessionId = sessionId;
    state.sessionKey = sessionKey;

    const upload = exchangeProtectedServiceData(sessionCipher.encrypt(JSON.stringify(request)));
    const uploaded = JSON.parse(sessionCipher.decrypt(upload.payload));

    expect(uploaded).toMatchObject({
      kind: "file.current",
      name: "demo.txt",
      mimeType: "text/plain",
      contentBase64: request.contentBase64,
    });
    expect(uploaded.size).toBe(32);
    expect(state.latestDemoFile).toMatchObject({
      name: "demo.txt",
      size: 32,
      contentBase64: request.contentBase64,
    });
    expect(state.serviceExchanged).toBe(true);

    const view = exchangeProtectedServiceData(
      sessionCipher.encrypt(JSON.stringify({ kind: "file.view" })),
    );
    expect(JSON.parse(sessionCipher.decrypt(view.payload))).toMatchObject({
      kind: "file.current",
      name: "demo.txt",
    });
  });
});
