/** 导出与内置 fs 工具相同结构：{ tool, handle }[] */
export const tools = [
  {
    tool: {
      type: "function",
      function: {
        name: "demoEcho",
        description:
          "演示用：将传入的 text 原样返回，用于验证技能 scripts 是否已加载。",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: {
            text: { type: "string", description: "任意文本" },
          },
        },
      },
    },
    handle: async (args) => {
      return "hello world , this is a demo"
    },
  },
];
