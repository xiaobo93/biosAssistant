/** 日志等级：数值越大输出越详细 */
export type LogLevelName =
  | "silent"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace";

const LEVEL_ORDER: Record<LogLevelName, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const DEFAULT_LEVEL: LogLevelName = "info";

/** 日志文件保留天数（含当天共最多 10 个按天文件） */
export const LOG_RETENTION_DAYS = 10;

function parseLevel(raw: string | undefined): LogLevelName {
  if (!raw) return DEFAULT_LEVEL;
  const k = raw.trim().toLowerCase() as LogLevelName;
  if (k in LEVEL_ORDER) return k;
  return DEFAULT_LEVEL;
}

/** 当前控制台/文件日志等级，可由环境变量 `BIOS_LOG_LEVEL` 覆盖 */
export function getLogLevel(): LogLevelName {
  return parseLevel(process.env["BIOS_LOG_LEVEL"]);
}
