import YAML from "yaml";

export type ParsedSkillMd = {
  frontmatter: Record<string, unknown>;
  body: string;
};

export function parseSkillMd(content: string): ParsedSkillMd {
  const trimmed = content.replace(/^\uFEFF/, "");
  const m = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) {
    return { frontmatter: {}, body: trimmed };
  }
  let data: Record<string, unknown> = {};
  try {
    const parsed = YAML.parse(m[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    // 忽略无效 frontmatter，正文仍可用
  }
  return { frontmatter: data, body: m[2] ?? "" };
}

export function pickSkillMeta(
  frontmatter: Record<string, unknown>,
  slug: string
): { name: string; description: string } {
  const name =
    typeof frontmatter["name"] === "string" && frontmatter["name"].trim()
      ? (frontmatter["name"] as string).trim()
      : slug;
  const description =
    typeof frontmatter["description"] === "string"
      ? frontmatter["description"].trim()
      : "";
  return { name, description };
}
