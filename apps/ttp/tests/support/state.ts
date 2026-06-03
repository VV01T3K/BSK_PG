import { pendingAuths, registeredIdentities, sessions, sessionsByRequest } from "../../src/state";

export function resetTtpTestState() {
  registeredIdentities.clear();
  sessions.clear();
  sessionsByRequest.clear();
  pendingAuths.clear();
}
