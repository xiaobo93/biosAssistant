import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { resolveSkillRoot } from "../../config.js";
import { parseSkillMd, pickSkillMeta } from "./parseSkillMd.js";
import type { SkillIndexEntry } from "./types.js";

async function findSkillMdAbs(skillDirAbs: string): Promise<string | null> {
  for (const name of ["SKILL.md", "skill.md"]) {
    const p = path.join(skillDirAbs, name);
    if (fsSync.existsSync(p)) return p;
  }
  return null;
}

/** 启动时仅扫描并读取 frontmatter(name/description)，不加载 scripts */
export async function buildSkillIndex(): Promise<SkillIndexEntry[]> {
  const root = resolveSkillRoot();
  if (!fsSync.existsSync(root)) return [];

  let dirents: fsSync.Dirent[];
  try {
    dirents = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: SkillIndexEntry[] = [];
  for (const d of dirents) {
    if (!d.isDirectory()) continue;
    if (d.name.startsWith(".")) continue;
    const slug = d.name;
    const dirAbs = path.join(root, slug);
    const skillMdAbs = await findSkillMdAbs(dirAbs);
    if (!skillMdAbs) continue;

    const content = await fs.readFile(skillMdAbs, "utf8");
    const { frontmatter } = parseSkillMd(content);
    const meta = pickSkillMeta(frontmatter, slug);
    out.push({
      slug,
      name: meta.name,
      description: meta.description,
      dirAbs,
      skillMdAbs,
    });
  }
  return out;
}
