import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { RegisteredTool, SkillIndexEntry } from "./types.js";

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
    if (isRegisteredTool(item)) out.push(item);
    else console.warn(`[skill] ${source}: 跳过无效 tools 项`);
  }
  return out;
}

async function importScriptsTools(skillDirAbs: string): Promise<RegisteredTool[]> {
  const scriptsDir = path.join(skillDirAbs, "scripts");
  if (!fsSync.existsSync(scriptsDir)) return [];

  for (const file of ["index.js", "index.mjs", "index.ts"]) {
    const abs = path.join(scriptsDir, file);
    if (!fsSync.existsSync(abs)) continue;
    const href = pathToFileURL(abs).href;
    const mod = (await import(href)) as Record<string, unknown>;
    return validateTools(mod["tools"], abs);
  }
  return [];
}

export type LoadedSkill = {
  entry: SkillIndexEntry;
  skillMd: string;
  tools: RegisteredTool[];
};

/** 按需：读取完整 SKILL.md（含正文），并加载 scripts tools */
export async function loadOneSkill(entry: SkillIndexEntry): Promise<LoadedSkill> {
  const skillMd = await fs.readFile(entry.skillMdAbs, "utf8");
  const tools = await importScriptsTools(entry.dirAbs);
  return { entry, skillMd, tools };
}

