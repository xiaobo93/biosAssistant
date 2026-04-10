import { fsTools } from "./fs/fsSpecs.js";

/** 按名称在声明列表中命中后，直接调用对应 handle；后续可合并多组 fsTools / Skill / MCP 声明再查找 */
export async function runFsTool(name: string, args: unknown): Promise<unknown> {
  const entry = fsTools.find((t) => t.tool.function.name === name);
  if (!entry) {
    throw new Error(`未知工具: ${name}`);
  }
  return entry.handle(args);
}
