export type AgentRole = "system" | "user" | "assistant" | "tool";

export type AssistantFunctionToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AgentMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: AssistantFunctionToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };
