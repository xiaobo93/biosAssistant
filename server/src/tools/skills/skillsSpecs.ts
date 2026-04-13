import { RegisteredTool,ToolRegistry } from "../types.js";
import { loadOneSkill } from "./loadOneSkill.js";
import { logger } from "../../log/logger.js";
function toolName(t: RegisteredTool): string {
  return t.tool.function.name;
}

export function makeLoadSkillTool(registry: ToolRegistry): RegisteredTool {
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
      //logger.info("Skill information :",loaded);
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