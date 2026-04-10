import { fsTools } from "./fs/fsSpecs.js";
import { ToolRegistry,RegisteredTool } from "./types.js";
import { buildSkillIndex } from "./skills/skillIndex.js";
import { makeLoadSkillTool } from "./skills/skillsSpecs.js";

export async function buildToolRegistry(): Promise<ToolRegistry> {
  const skillIndex = await buildSkillIndex();

  // 先构建空 registry，再把 loadSkill tool 以闭包方式注入
  const registry: ToolRegistry = {
    baseTools: [],
    loadedTools: new Map(),
    toolSpecs: [],
    skillIndex,
    loadedSkillDocs: new Map(),
  };

  registry.baseTools = [...(fsTools as unknown as RegisteredTool[]), makeLoadSkillTool(registry)];
  registry.toolSpecs = registry.baseTools.map((t) => t.tool);
  return registry;
}
