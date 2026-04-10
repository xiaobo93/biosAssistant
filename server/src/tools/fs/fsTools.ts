import fs from "node:fs/promises";
import path from "node:path";
import { assertInsideCwd, resolveCwdPath } from "../pathSafety.js";

type ListFilesArgs = {
  path?: string;
  recursive?: boolean;
  maxEntries?: number;
};

type ReadFileArgs = {
  path: string;
  maxBytes?: number;
};

type WriteFileArgs = {
  path: string;
  content: string;
  overwrite?: boolean;
};

export async function handleListFiles(args: unknown): Promise<unknown> {
  const a = (args ?? {}) as ListFilesArgs;
  const rel = a.path ?? ".";
  const recursive = a.recursive ?? false;
  const maxEntries = Math.max(1, Math.min(a.maxEntries ?? 200, 2000));

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

export async function handleReadFile(args: unknown): Promise<unknown> {
  const a = (args ?? {}) as Partial<ReadFileArgs>;
  if (typeof a.path !== "string" || !a.path) {
    throw new Error("readFile 需要有效的 path 参数");
  }
  const maxBytes = Math.max(1, Math.min(a.maxBytes ?? 200_000, 2_000_000));
  const { absPath, cwd } = resolveCwdPath(a.path);
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

export async function handleWriteFile(args: unknown): Promise<unknown> {
  const a = (args ?? {}) as Partial<WriteFileArgs>;
  if (typeof a.path !== "string" || !a.path) {
    throw new Error("writeFile 需要有效的 path 参数");
  }
  if (typeof a.content !== "string") {
    throw new Error("writeFile 需要有效的 content 参数");
  }
  const relPath = a.path;
  const body = a.content;
  const { absPath, cwd } = resolveCwdPath(relPath);
  assertInsideCwd(absPath, cwd);

  const overwrite = a.overwrite ?? false;
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
  await fs.writeFile(absPath, body, "utf8");
  return { path: path.relative(cwd, absPath) || ".", bytesWritten: Buffer.byteLength(body, "utf8") };
}
