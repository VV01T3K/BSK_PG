import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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

function normalizeLogValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatLogEntry(entry: EventLogEntry): string {
  const level = entry.level.toUpperCase().padEnd(5, " ");
  return `[${entry.timestamp}] ${level} ${entry.actor}: ${normalizeLogValue(entry.event)} - ${normalizeLogValue(entry.details)}`;
}

export function createFileLogger(filePaths: string | string[]) {
  const resolvedPaths = (Array.isArray(filePaths) ? filePaths : [filePaths]).map(resolveLogPath);

  function log(actor: EventLogEntry["actor"], event: string, details: string, level: EventLogEntry["level"] = "info") {
    const entry: EventLogEntry = {
      timestamp: new Date().toISOString(),
      actor,
      level,
      event,
      details,
    };
    for (const resolvedPath of resolvedPaths) {
      mkdirSync(dirname(resolvedPath), { recursive: true });
      appendFileSync(resolvedPath, `${formatLogEntry(entry)}\n`);
    }
  }

  function reset() {
    for (const resolvedPath of resolvedPaths) {
      if (existsSync(resolvedPath)) {
        writeFileSync(resolvedPath, "");
      }
    }
  }

  return { log, reset };
}
