import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

export interface EventLogEntry {
  timestamp: string;
  actor: "ttp" | "user" | "server";
  level: "info" | "warn" | "error";
  event: string;
  details: string;
}

function resolveLogPath(filePath: string): string {
  if (isAbsolute(filePath)) {
    return filePath;
  }
  const baseDir = process.env.LOG_DIR ?? (process.env.NODE_ENV === "test" ? tmpdir() : "../../logs");
  return join(baseDir, filePath);
}

export function createFileLogger(filePath: string) {
  const resolvedPath = resolveLogPath(filePath);

  function log(actor: EventLogEntry["actor"], event: string, details: string, level: EventLogEntry["level"] = "info") {
    const entry: EventLogEntry = {
      timestamp: new Date().toISOString(),
      actor,
      level,
      event,
      details,
    };
    mkdirSync(dirname(resolvedPath), { recursive: true });
    appendFileSync(resolvedPath, `${JSON.stringify(entry)}\n`);
  }

  function readLogs(limit = 80): EventLogEntry[] {
    if (!existsSync(resolvedPath)) {
      return [];
    }
    const lines = readFileSync(resolvedPath, "utf8").split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((line) => JSON.parse(line) as EventLogEntry);
  }

  function reset() {
    if (existsSync(resolvedPath)) {
      writeFileSync(resolvedPath, "");
    }
  }

  return { log, readLogs, reset };
}
