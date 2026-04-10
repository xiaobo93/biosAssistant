import fs from "node:fs/promises";
import path from "node:path";
import { assertInsideCwd, resolveCwdPath } from "./pathSafety.js";

export async function listFiles(args: {
  path?: string;
  recursive?: boolean;
  maxEntries?: number;
}): Promise<{ entries: Array<{ path: string; type: "file" | "dir" | "other" }> }> {
  const rel = args.path ?? ".";
  const recursive = args.recursive ?? false;
  const maxEntries = Math.max(1, Math.min(args.maxEntries ?? 200, 2000));

  const { absPath, cwd } = resolveCwdPath(rel);
  assertInsideCwd(absPath, cwd);

  const out: Array<{ path: string; type: "file" | "dir" | "other" }> = [];

  async function walk(dirAbs: string): Promise<void> {
    if (out.length >= maxEntries) return;
    const dirents = await fs.readdir(dirAbs, { withFileTypes: true });
    for (const d of dirents) {
      if (out.length >= maxEntries) return;
      const childAbs = path.join(dirAbs, d.name);
      assertInsideCwd(childAbs, cwd);
      const relPath = path.relative(cwd, childAbs) || ".";
      const type = d.isDirectory() ? "dir" : d.isFile() ? "file" : "other";
      out.push({ path: relPath, type });
      if (recursive && d.isDirectory()) {
        await walk(childAbs);
      }
    }
  }

  const st = await fs.stat(absPath);
  if (st.isDirectory()) {
    await walk(absPath);
  } else {
    out.push({ path: path.relative(cwd, absPath) || ".", type: st.isFile() ? "file" : "other" });
  }

  return { entries: out };
}

export async function readFile(args: {
  path: string;
  maxBytes?: number;
}): Promise<{ path: string; content: string; truncated: boolean }> {
  const maxBytes = Math.max(1, Math.min(args.maxBytes ?? 200_000, 2_000_000));
  const { absPath, cwd } = resolveCwdPath(args.path);
  assertInsideCwd(absPath, cwd);

  const buf = await fs.readFile(absPath);
  const truncated = buf.byteLength > maxBytes;
  const slice = truncated ? buf.subarray(0, maxBytes) : buf;

  return {
    path: path.relative(cwd, absPath) || ".",
    content: slice.toString("utf8"),
    truncated,
  };
}

export async function writeFile(args: {
  path: string;
  content: string;
  overwrite?: boolean;
}): Promise<{ path: string; bytesWritten: number }> {
  const { absPath, cwd } = resolveCwdPath(args.path);
  assertInsideCwd(absPath, cwd);

  const overwrite = args.overwrite ?? false;
  if (!overwrite) {
    try {
      await fs.stat(absPath);
      throw new Error("目标文件已存在；如需覆盖请设置 overwrite=true");
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code && code !== "ENOENT") throw e;
    }
  }

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, args.content, "utf8");
  return { path: path.relative(cwd, absPath) || ".", bytesWritten: Buffer.byteLength(args.content, "utf8") };
}

