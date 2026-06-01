import { truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import pino from "pino";
import pretty from "pino-pretty";

export type SecurityLogActor = "ttp" | "user" | "server";
export type SecurityLogLevel = "info" | "warn" | "error";

const DEFAULT_LOG_DIR = "../../logs";

function logDirectory() {
  return process.env.LOG_DIR ?? (process.env.NODE_ENV === "test" ? tmpdir() : DEFAULT_LOG_DIR);
}

function logPath(fileName: string) {
  return join(logDirectory(), fileName);
}

export function createSecurityLogger(fileNames: readonly string[]) {
  const sync = process.env.NODE_ENV === "test";
  const paths = fileNames.map(logPath);
  const logger = pino(
    { base: undefined },
    pino.multistream(
      paths.map((path) =>
        pretty({
          append: true,
          destination: path,
          ignore: "pid,hostname,actor,details",
          messageFormat: "{actor}: {msg} - {details}",
          mkdir: true,
          singleLine: true,
          sync,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
        }),
      ),
    ),
  );

  function log(
    actor: SecurityLogActor,
    event: string,
    details: string,
    level: SecurityLogLevel = "info",
  ) {
    logger[level]({ actor, details }, event);
  }

  function reset() {
    logger.flush();
    for (const path of paths) {
      truncateSync(path);
    }
  }

  return { log, reset, pino: logger };
}
