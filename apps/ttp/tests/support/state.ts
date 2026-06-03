import { pendingAuths, principals, sessions, sessionsByRequest } from "../../src/state";

export function resetTtpTestState() {
  principals.clear();
  sessions.clear();
  sessionsByRequest.clear();
  pendingAuths.clear();
}
