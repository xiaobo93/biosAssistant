import OpenAI from "openai";
import { inspect } from "node:util";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";
import { config } from "../config.js";
import type { AgentMessage, AssistantFunctionToolCall } from "./agentTypes.js";
import { toolSpecs } from "./tools/fs/fsSpecs.js";
import { runFsTool } from "./tools/toolRouter.js";

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

export async function chatOnceWithTools(
  messages: AgentMessage[]
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
      tools: toolSpecs as unknown as OpenAI.Chat.Completions.ChatCompletionTool[],
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
        const result = await runFsTool(toolName, toolArgs);
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
