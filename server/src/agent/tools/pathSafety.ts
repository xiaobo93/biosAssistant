import path from "node:path";

export function resolveCwdPath(userPath: string): { absPath: string; cwd: string } {
  const cwd = path.resolve(process.cwd());
  const absPath = path.resolve(cwd, userPath);
  return { absPath, cwd };
}

export function assertInsideCwd(absPath: string, cwd: string): void {
  const normCwd = path.resolve(cwd);
  const normAbs = path.resolve(absPath);

  const a = process.platform === "win32" ? normAbs.toLowerCase() : normAbs;
  const c = process.platform === "win32" ? normCwd.toLowerCase() : normCwd;

  if (a === c) return;
  const prefix = c.endsWith(path.sep) ? c : c + path.sep;
  if (!a.startsWith(prefix)) {
    throw new Error(`拒绝访问：路径超出当前工作目录范围 (${cwd})`);
  }
}

