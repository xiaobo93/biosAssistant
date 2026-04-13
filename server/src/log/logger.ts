import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import callsites from "callsites";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { getLogLevel, LOG_RETENTION_DAYS, type LogLevelName } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Winston 自定义等级：数值越大越「啰嗦」，与原先 `shouldLog` 语义一致 */
const WINSTON_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
} as const;

type WinstonLevelKey = keyof typeof WINSTON_LEVELS;

function getServerRoot(): string {
  return path.resolve(__dirname, "..", "..");
}

function getLogsDir(): string {
  return path.join(getServerRoot(), "logs");
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLocalTimeToSecond(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${localDateKey(d)} ${hh}:${mm}:${ss}`;
}

function toLocalPath(filePath: string): string {
  if (filePath.startsWith("file://")) {
    try {
      return fileURLToPath(filePath);
    } catch {
      return filePath;
    }
  }
  return filePath;
}

function isLoggerInternalFile(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  return (
    norm.includes("/logs/logger.") ||
    norm.includes("\\logs\\logger.") ||
    norm.endsWith("logger.ts") ||
    norm.endsWith("logger.js")
  );
}

function getCallSiteFromCallsites(): {
  file: string;
  fn: string;
  line: number;
} {
  for (const s of callsites()) {
    const raw = s.getFileName();
    if (!raw) continue;
    const fileName = toLocalPath(raw);
    if (isLoggerInternalFile(fileName)) continue;
    if (fileName.startsWith("node:")) continue;
    return {
      file: fileName,
      fn: s.getFunctionName() || "<anonymous>",
      line: s.getLineNumber() ?? 0,
    };
  }
  return { file: "?", fn: "?", line: 0 };
}

function displayFile(filePath: string): string {
  const abs = toLocalPath(filePath);
  try {
    const rel = path.relative(getServerRoot(), abs);
    if (rel && !rel.startsWith("..")) return rel.replace(/\\/g, "/");
  } catch {
    /* fall through */
  }
  return path.basename(abs);
}

const INSPECT_OPTS = {
  depth: 6,
  breakLength: 120,
  maxStringLength: 8000,
} as const;

function formatExtras(parts: unknown[]): string {
  if (parts.length === 0) return "";
  return (
    " " +
    parts
      .map((p) => (typeof p === "string" ? p : inspect(p, INSPECT_OPTS)))
      .join(" ")
  );
}

type NormalizedLogArgs =
  | { kind: "plain"; message: string; extras: unknown[] }
  | {
      kind: "meta";
      meta: Record<string, unknown>;
      message: string;
      extras: unknown[];
    };

function normalizeLogArgs(args: unknown[]): NormalizedLogArgs {
  if (
    args.length >= 2 &&
    typeof args[0] === "object" &&
    args[0] !== null &&
    !Array.isArray(args[0]) &&
    typeof args[1] === "string"
  ) {
    return {
      kind: "meta",
      meta: args[0] as Record<string, unknown>,
      message: args[1],
      extras: args.slice(2),
    };
  }
  if (args.length >= 1 && typeof args[0] === "string") {
    return { kind: "plain", message: args[0], extras: args.slice(1) };
  }
  return {
    kind: "plain",
    message: args.map((a) => inspect(a, INSPECT_OPTS)).join(" "),
    extras: [],
  };
}

type CallSite = { file: string; fn: string; line: number };

function pickCallSite(
  meta: Record<string, unknown> | undefined,
  stackSite: CallSite
): CallSite {
  if (!meta) return stackSite;
  const file = meta["file"];
  const fn = meta["fn"];
  const line = meta["line"];
  if (
    typeof file === "string" &&
    typeof fn === "string" &&
    typeof line === "number"
  ) {
    return { file, fn, line };
  }
  return stackSite;
}

function stripCallSiteKeys(meta: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...meta };
  delete rest["file"];
  delete rest["fn"];
  delete rest["line"];
  return rest;
}

type LogInfo = winston.Logform.TransformableInfo & {
  srcFile?: string;
  srcLine?: number;
  srcFn?: string;
};

function buildPrettyFormat() {
  return winston.format.combine(
    winston.format.timestamp({
      format: () => formatLocalTimeToSecond(new Date()),
    }),
    winston.format.printf((raw) => {
      const info = raw as LogInfo;
      const ts = String(info.timestamp ?? formatLocalTimeToSecond(new Date()));
      const lvl = String(info.level).toUpperCase();
      const srcFile = String(info.srcFile ?? "?");
      const srcLine = Number(info.srcLine ?? 0);
      const srcFn = String(info.srcFn ?? "?");
      const message =
        typeof info.message === "string" ? info.message : String(info.message ?? "");
      return `${ts} [${lvl}] ${srcFile}:${srcLine} ${srcFn} - ${message}`;
    })
  );
}

let winstonInstance: winston.Logger | null = null;

function createWinstonLogger(): winston.Logger {
  const configured = getLogLevel();
  const isSilent = configured === "silent";
  const activeLevel: WinstonLevelKey = isSilent ? "error" : (configured as WinstonLevelKey);

  const pretty = buildPrettyFormat();
  const stderrLevels = Object.keys(WINSTON_LEVELS) as WinstonLevelKey[];

  return winston.createLogger({
    levels: { ...WINSTON_LEVELS },
    level: activeLevel,
    silent: isSilent,
    format: pretty,
    transports: [
      new winston.transports.Console({
        stderrLevels,
      }),
      new DailyRotateFile({
        dirname: getLogsDir(),
        filename: "%DATE%.log",
        datePattern: "YYYY-MM-DD",
        zippedArchive: false,
        maxFiles: `${LOG_RETENTION_DAYS}d`,
      }),
    ],
  });
}

function getWinston(): winston.Logger {
  if (!winstonInstance) winstonInstance = createWinstonLogger();
  return winstonInstance;
}

function emit(level: WinstonLevelKey, args: unknown[]): void {
  const stackSite = getCallSiteFromCallsites();
  const norm = normalizeLogArgs(args);
  let site: CallSite;
  let body: string;
  if (norm.kind === "meta") {
    site = pickCallSite(norm.meta, stackSite);
    const restMeta = stripCallSiteKeys(norm.meta);
    const metaStr =
      Object.keys(restMeta).length > 0
        ? ` ${inspect(restMeta, INSPECT_OPTS)}`
        : "";
    body = norm.message + metaStr + formatExtras(norm.extras);
  } else {
    site = stackSite;
    body = norm.message + formatExtras(norm.extras);
  }

  getWinston().log({
    level,
    message: body,
    srcFile: displayFile(site.file),
    srcLine: site.line,
    srcFn: site.fn,
  });
}

function emitAt(level: LogLevelName, args: unknown[]): void {
  if (level === "silent") return;
  emit(level as WinstonLevelKey, args);
}

/** 启动时创建 Winston 实例（目录由 DailyRotateFile 首次写入时创建） */
export function initLogger(): void {
  getWinston();
}

export const logger = {
  trace(...args: unknown[]): void {
    emitAt("trace", args);
  },
  debug(...args: unknown[]): void {
    emitAt("debug", args);
  },
  info(...args: unknown[]): void {
    emitAt("info", args);
  },
  warn(...args: unknown[]): void {
    emitAt("warn", args);
  },
  error(...args: unknown[]): void {
    emitAt("error", args);
  },
};
