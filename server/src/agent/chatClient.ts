import OpenAI from "openai";
import { inspect } from "node:util";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";
import { config } from "../config.js";
import type { AgentMessage, AssistantFunctionToolCall } from "./agentTypes.js";
import { ToolRegistry } from "../tools/types.js";
import {
  getAllRegisteredToolsFromRegistry,
  runRegisteredTool,
} from "../tools/toolRouter.js";

function toStoredToolCalls(
  calls: ChatCompletionMessageFunctionToolCall[] | undefined
): AssistantFunctionToolCall[] | undefined {
  if (!calls?.length) return undefined;
  return calls.map((tc) => ({
    id: tc.id,
    type: "function" as const,
    function: {
      name: tc.function.name,
      arguments: tc.function.arguments ?? "{}",
    },
  }));
}

function onlyFunctionToolCalls(
  calls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined
): ChatCompletionMessageFunctionToolCall[] {
  if (!calls?.length) return [];
  return calls.filter(
    (tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === "function"
  );
}

function requireApiKey(): string {
  if (!config.openaiApiKey) {
    throw new Error(
      "未设置 OPENAI_API_KEY。请先在环境变量中设置 OPENAI_API_KEY，然后重新运行。"
    );
  }
  return config.openaiApiKey;
}

function safeJsonParse<T>(s: string): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    throw new Error("工具参数不是合法 JSON");
  }
}

/** 工具返回值写入 role=tool 的 content：始终为字符串，不用 JSON 包装 */
function toolResultToContent(value: unknown): string {
  if (typeof value === "string") return value;
  return inspect(value, { depth: null, maxStringLength: null, breakLength: 120 });
}

async function chatOnceWithToolsInternal(
  messages: AgentMessage[],
  registry: ToolRegistry
): Promise<{ messages: AgentMessage[]; replyText: string }> {
  const client = new OpenAI({
    apiKey: requireApiKey(),
    baseURL: config.openaiBaseUrl.trim().replace(/\/+$/, ""),
  });

  const nextMessages: AgentMessage[] = [...messages];
  let finalText = "";

  for (let i = 0; i < 8; i++) {
    const resp = await client.chat.completions.create({
      model: config.openaiModel,
      messages: nextMessages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: registry.toolSpecs as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
      tool_choice: "auto",
    });

    const msg = resp.choices?.[0]?.message;
    if (!msg) throw new Error("OpenAI 返回为空");

    const functionCalls = onlyFunctionToolCalls(msg.tool_calls);
    const assistantMessage: AgentMessage = {
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: toStoredToolCalls(functionCalls),
    };
    nextMessages.push(assistantMessage);

    const toolCalls = functionCalls;
    if (toolCalls.length === 0) {
      finalText = msg.content?.trim() || "(空回复)";
      break;
    }

    for (const tc of toolCalls) {
      const toolName = tc.function.name;
      const toolArgs = safeJsonParse<unknown>(tc.function.arguments || "{}");
      try {
        const allTools = getAllRegisteredToolsFromRegistry(registry);
        const result = await runRegisteredTool(allTools, toolName, toolArgs);
        nextMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResultToContent(result),
        });
      } catch (e: unknown) {
        nextMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  if (!finalText) {
    finalText = "（未能在限定轮次内完成工具调用与回复）";
  }

  return { messages: nextMessages, replyText: finalText };
}

function buildLoadedSkillSystemNote(registry: ToolRegistry): string | null {
  if (registry.loadedSkillDocs.size === 0) return null;
  const parts: string[] = [];
  for (const [slug, md] of registry.loadedSkillDocs.entries()) {
    parts.push(`【skill=${slug}】\n${md}`);
  }
  return (
    "已按需加载以下 skill 的完整文档与 tools。请结合这些 skill 重新思考并回答用户上一条问题。\n\n" +
    parts.join("\n\n---\n\n")
  );
}

/**
 * 两阶段按需加载：
 * - 第 1 阶段：仅 FS + loadSkill
 * - 若调用 loadSkill：加载文档+tools，注入 system，自动重试同一问题（第 2 阶段）
 */
export async function chatOnceWithTools(
  messages: AgentMessage[],
  registry: ToolRegistry
): Promise<{ messages: AgentMessage[]; replyText: string }> {
  // phase1
  const phase1 = await chatOnceWithToolsInternal(messages, registry);
  const didLoadSkill = phase1.messages.some(
    (m) =>
      m.role === "assistant" &&
      Array.isArray(m.tool_calls) &&
      m.tool_calls.some((c) => c.function.name === "loadSkill")
  );
  if (!didLoadSkill) return phase1;

  const note = buildLoadedSkillSystemNote(registry);
  const phase2Messages = note
    ? ([...phase1.messages, { role: "system", content: note } as AgentMessage] as AgentMessage[])
    : phase1.messages;

  return await chatOnceWithToolsInternal(phase2Messages, registry);
}
