import { listFiles, readFile, writeFile } from "./fsTools.js";

export async function callTool(name: string, args: unknown): Promise<unknown> {
  switch (name) {
    case "listFiles":
      return await listFiles((args ?? {}) as Parameters<typeof listFiles>[0]);
    case "readFile":
      return await readFile((args ?? {}) as Parameters<typeof readFile>[0]);
    case "writeFile":
      return await writeFile((args ?? {}) as Parameters<typeof writeFile>[0]);
    default:
      throw new Error(`未知工具: ${name}`);
  }
}

