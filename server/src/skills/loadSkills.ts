import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveSkillRoot } from "../config.js";
import { parseSkillMd, pickSkillMeta } from "./parseSkillMd.js";
import type { RegisteredTool, SkillSummary } from "./types.js";

async function readSkillMd(skillDir: string): Promise<string | null> {
  for (const name of ["SKILL.md", "skill.md"]) {
    const p = path.join(skillDir, name);
    if (fsSync.existsSync(p)) {
      return fs.readFile(p, "utf8");
    }
  }
  return null;
}

function isRegisteredTool(x: unknown): x is RegisteredTool {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const tool = o["tool"];
  if (!tool || typeof tool !== "object") return false;
  const t = tool as Record<string, unknown>;
  if (t["type"] !== "function") return false;
  const fn = t["function"];
  if (!fn || typeof fn !== "object") return false;
  const name = (fn as Record<string, unknown>)["name"];
  if (typeof name !== "string" || !name) return false;
  return typeof o["handle"] === "function";
}

function validateTools(raw: unknown, source: string): RegisteredTool[] {
  if (!Array.isArray(raw)) {
    console.warn(`[skill] ${source}: tools 不是数组，已忽略`);
    return [];
  }
  const out: RegisteredTool[] = [];
  for (const item of raw) {
    if (isRegisteredTool(item)) {
      out.push(item);
    } else {
      console.warn(`[skill] ${source}: 跳过无效 tools 项`);
    }
  }
  return out;
}

async function tryImportScriptsEntry(scriptsDir: string): Promise<RegisteredTool[]> {
  const candidates = ["index.js", "index.mjs", "index.ts"];
  for (const file of candidates) {
    const abs = path.join(scriptsDir, file);
    if (!fsSync.existsSync(abs)) continue;
    try {
      const href = pathToFileURL(abs).href;
      const mod = (await import(href)) as Record<string, unknown>;
      const raw = mod["tools"];
      return validateTools(raw, abs);
    } catch (e) {
      console.warn(
        `[skill] 加载 ${abs} 失败:`,
        e instanceof Error ? e.message : String(e)
      );
      return [];
    }
  }
  return [];
}

export type LoadedSkillsResult = {
  summaries: SkillSummary[];
  tools: RegisteredTool[];
};

/**
 * 扫描 skill 根目录下子文件夹：读取 SKILL.md，可选加载 scripts/index.{js,mjs,ts}
 */
export async function loadSkills(): Promise<LoadedSkillsResult> {
  const root = resolveSkillRoot();
  const summaries: SkillSummary[] = [];
  const tools: RegisteredTool[] = [];
  const seenNames = new Set<string>();

  if (!fsSync.existsSync(root)) {
    return { summaries, tools };
  }

  let entries: fsSync.Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (e) {
    console.warn(
      `[skill] 无法读取目录 ${root}:`,
      e instanceof Error ? e.message : String(e)
    );
    return { summaries, tools };
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith(".")) continue;
    const slug = ent.name;
    const skillDir = path.join(root, slug);

    const md = await readSkillMd(skillDir);
    if (!md) {
      console.warn(`[skill] ${slug}: 未找到 SKILL.md 或 skill.md，已跳过`);
      continue;
    }

    const { frontmatter } = parseSkillMd(md);
    const meta = pickSkillMeta(frontmatter, slug);
    summaries.push({
      slug,
      name: meta.name,
      description: meta.description,
    });

    const scriptsDir = path.join(skillDir, "scripts");
    if (!fsSync.existsSync(scriptsDir)) {
      continue;
    }

    const fromScripts = await tryImportScriptsEntry(scriptsDir);
    for (const t of fromScripts) {
      const n = t.tool.function.name;
      if (seenNames.has(n)) {
        throw new Error(
          `[skill] 工具名冲突: ${n}（技能 ${slug}）。请保证全局工具名唯一。`
        );
      }
      seenNames.add(n);
      tools.push(t);
    }
  }

  return { summaries, tools };
}
