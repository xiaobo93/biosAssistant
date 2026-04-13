import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { chatOnceWithTools } from "./chatClient.js";
import type { AgentMessage } from "./agentTypes.js";
import { buildToolRegistry } from "../tools/toolRegistry.js";
import { SkillIndexEntry } from "../tools/types.js";
import { logger } from "../log/logger.js";

function buildSystemPrompt(skillIndex: SkillIndexEntry[]): string {
  const base =
    "你是一个本地 CLI 助手。你可以通过工具在当前工作目录（process.cwd()）内安全地列目录、读文件、写文件。遇到需要文件内容才能回答的问题，优先调用工具读取相关文件再回答。严禁访问当前工作目录之外的路径。";
  if (skillIndex.length === 0) return base;
  const lines = skillIndex.map(
    (s) =>
      `- ${s.slug}（${s.name}）: ${s.description ? s.description : "（无描述）"}`
  );
  return `${base}\n\n已加载技能（OpenClaw 风格，各技能目录含 SKILL.md 与可选 scripts/）：\n${lines.join("\n")}`;
}

export async function runAgent(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  const registry = await buildToolRegistry();

  const messages: AgentMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(registry.skillIndex),
    },
  ];
  logger.info("System prompt :",messages);
  logger.info("Base tools :",registry.toolSpecs);
  stdout.write("biosAssistant CLI 已启动，输入 exit 退出。\n\n");

  try {
    while (true) {
      const input = (await rl.question("> ")).trim();
      if (!input) continue;
      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") break;

      messages.push({ role: "user", content: input });
      logger.info("User input :",`{ role: "user", content: ${input} }`);
      try {
        const { messages: nextMessages, replyText } = await chatOnceWithTools(
          messages,
          registry
        );
        messages.splice(0, messages.length, ...nextMessages);
        stdout.write(replyText + "\n\n");
      } catch (e) {
        messages.pop();
        stdout.write(`错误: ${e instanceof Error ? e.message : String(e)}\n\n`);
      }
    }
  } finally {
    rl.close();
  }
}

