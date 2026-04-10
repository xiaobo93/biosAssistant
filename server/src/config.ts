import path from "node:path";

export type AppConfig = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
};

export const config: AppConfig = {
  openaiApiKey: process.env["OPENAI_API_KEY"] ?? "sk-bf7a2caa3ecd4763b980e6b23f0f8c4d",
  openaiBaseUrl: process.env["OPENAI_BASE_URL"] ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
  openaiModel: process.env["OPENAI_MODEL"] ?? "qwen3.6-plus",
};

/** 技能根目录：默认 <cwd>/skill，可用 BIOS_SKILL_DIR 覆盖为绝对或相对路径（相对则 resolve 到 cwd） */
export function resolveSkillRoot(): string {
  const env = process.env["BIOS_SKILL_DIR"];
  if (typeof env === "string" && env.trim()) {
    return path.resolve(env.trim());
  }
  return path.join(process.cwd(), "skill");
}


