import type { RegisteredTool } from "./types.js";

/** 在已注册工具列表中按名称调用 handle */
export async function runRegisteredTool(
  allTools: RegisteredTool[],
  name: string,
  args: unknown
): Promise<unknown> {
  const entry = allTools.find((t) => t.tool.function.name === name);
  if (!entry) {
    throw new Error(`未知工具: ${name}`);
  }
  return entry.handle(args);
}

export function getAllRegisteredToolsFromRegistry(registry: {
  baseTools: RegisteredTool[];
  loadedTools: Map<string, RegisteredTool>;
}): RegisteredTool[] {
  return [...registry.baseTools, ...registry.loadedTools.values()];
}
