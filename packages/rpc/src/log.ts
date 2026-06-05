import { truncateSync } from "node:fs";
import { join } from "node:path";

import pino from "pino";
import pretty from "pino-pretty";

export type SecurityLogActor = "ttp" | "user" | "server";
export type SecurityLogLevel = "info" | "warn" | "error";

const DEFAULT_LOG_DIR = "../../logs";

function logDirectory() {
  return process.env.LOG_DIR ?? DEFAULT_LOG_DIR;
}

function logPath(fileName: string) {
  return join(logDirectory(), fileName);
}

function artifactPath(fileName: string) {
  return join(logDirectory(), "artifacts", fileName);
}

export function createSecurityLogger(fileNames: readonly string[]) {
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

  async function artifact(actor: SecurityLogActor, fileName: string, contents: unknown) {
    const path = artifactPath(fileName);
    const body = typeof contents === "string" ? contents : JSON.stringify(contents, null, 2);
    await Bun.write(path, body);
    log(actor, "artifact saved", path);
  }

  function reset() {
    logger.flush();
    for (const path of paths) {
      truncateSync(path);
    }
  }

  return { log, artifact, reset, pino: logger };
}
