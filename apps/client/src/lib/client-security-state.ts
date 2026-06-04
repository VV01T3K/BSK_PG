import { hash, type RsaPair } from "@bsk/crypto";

export type RegisteredUser = {
  id: string;
  authKeyPair: RsaPair;
  exchangeKeyPair: RsaPair;
  certificatePem: string;
};

type ActiveSession = {
  sessionId: string;
  userSessionKey: string;
};

const current: {
  user?: RegisteredUser;
  session?: ActiveSession;
} = {};

export const clientSecurityState = {
  reset() {
    current.user = undefined;
    current.session = undefined;
  },

  storeUser(user: RegisteredUser) {
    current.user = user;
    current.session = undefined;
  },

  storeSession(session: ActiveSession) {
    current.session = session;
  },

  clearSession() {
    current.session = undefined;
  },

  read() {
    return { ...current };
  },

  readPublicStatus() {
    const { user, session } = current;

    return {
      userRegistered: Boolean(user),
      userId: user?.id,
      userCertificateFingerprint: user ? hash.of(user.certificatePem).fingerprint() : undefined,
      sessionId: session?.sessionId,
    };
  },
};
