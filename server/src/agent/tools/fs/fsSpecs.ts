import {
  handleListFiles,
  handleReadFile,
  handleWriteFile,
} from "./fsTools.js";

/** 内置文件系统工具：OpenAI function 声明 + handle，同一处维护 */
export const fsTools = [
  {
    tool: {
      type: "function" as const,
      function: {
        name: "listFiles",
        description: "列出当前工作目录内的文件/目录（可递归）。path 相对于当前工作目录。",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            path: { type: "string", description: "相对路径，默认 '.'" },
            recursive: { type: "boolean", description: "是否递归遍历，默认 false" },
            maxEntries: { type: "integer", description: "最多返回条目数，默认 200（上限 2000）" },
          },
        },
      },
    },
    handle: handleListFiles,
  },
  {
    tool: {
      type: "function" as const,
      function: {
        name: "readFile",
        description: "读取当前工作目录内的文本文件内容。path 相对于当前工作目录。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["path"],
          properties: {
            path: { type: "string", description: "相对路径（必填）" },
            maxBytes: { type: "integer", description: "最大读取字节数，默认 200000（上限 2000000）" },
          },
        },
      },
    },
    handle: handleReadFile,
  },
  {
    tool: {
      type: "function" as const,
      function: {
        name: "writeFile",
        description:
          "在当前工作目录内写入文本文件；默认不覆盖已存在文件，如需覆盖设置 overwrite=true。path 相对于当前工作目录。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["path", "content"],
          properties: {
            path: { type: "string", description: "相对路径（必填）" },
            content: { type: "string", description: "要写入的文本内容（必填）" },
            overwrite: { type: "boolean", description: "是否覆盖已存在文件，默认 false" },
          },
        },
      },
    },
    handle: handleWriteFile,
  },
] as const;

export const toolSpecs = fsTools.map((t) => t.tool);
