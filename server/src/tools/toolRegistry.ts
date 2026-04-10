import { fsTools } from "./fs/fsSpecs.js";
import type { RegisteredTool, SkillIndexEntry } from "../skills/types.js";
import { buildSkillIndex } from "../skills/skillIndex.js";
import { loadOneSkill } from "../skills/loadOneSkill.js";

export type ToolRegistry = {
  /** 固定工具：内置 FS + loadSkill */
  baseTools: RegisteredTool[];
  /** 动态工具：按需加载 skill 后注入（允许后加载覆盖先加载） */
  loadedTools: Map<string, RegisteredTool>;
  /** 给模型的 tools 声明（base + loaded） */
  toolSpecs: RegisteredTool["tool"][];
  /** 启动时的技能索引（仅 name/description） */
  skillIndex: SkillIndexEntry[];
  /** 已加载 skill 的完整文档（用于二次思考注入 system） */
  loadedSkillDocs: Map<string, string>;
};

function toolName(t: RegisteredTool): string {
  return t.tool.function.name;
}

function makeLoadSkillTool(registry: ToolRegistry): RegisteredTool {
  return {
    tool: {
      type: "function",
      function: {
        name: "loadSkill",
        description:
          "按需加载一个 skill：读取该 skill 的完整 SKILL.md 文档并加载 scripts/index.* 导出的 tools；加载后会在下一次思考中可用。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["slug"],
          properties: {
            slug: {
              type: "string",
              description: "skill 目录名（例如 'demo'）",
            },
          },
        },
      },
    },
    handle: async (args: unknown) => {
      const a = (args ?? {}) as { slug?: unknown };
      const slug = typeof a.slug === "string" ? a.slug.trim() : "";
      if (!slug) throw new Error("loadSkill 需要非空 slug");

      const entry = registry.skillIndex.find((s) => s.slug === slug);
      if (!entry) {
        throw new Error(`未找到 skill: ${slug}`);
      }

      const loaded = await loadOneSkill(entry);
      registry.loadedSkillDocs.set(slug, loaded.skillMd);

      // 将 tools 合并到 loadedTools：后加载覆盖先加载（last-wins）
      const baseNames = new Set(registry.baseTools.map((t) => toolName(t)));
      for (const t of loaded.tools) {
        const n = toolName(t);
        if (baseNames.has(n)) {
          throw new Error(
            `skill 工具名与内置工具冲突: ${n}（skill=${slug}）。请重命名该 skill 的 function.name。`
          );
        }
        registry.loadedTools.set(n, t);
      }

      // 重新生成 tools 声明（用于二次思考）
      registry.toolSpecs = [
        ...registry.baseTools.map((t) => t.tool),
        ...[...registry.loadedTools.values()].map((t) => t.tool),
      ];

      return {
        loaded: true,
        slug,
        toolNames: loaded.tools.map((t) => toolName(t)),
      };
    },
  };
}

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
