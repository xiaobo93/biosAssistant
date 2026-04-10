/** 与 fsSpecs 中单项一致：OpenAI function 声明 + 异步 handle */
export type RegisteredTool = {
  tool: {
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  };
  handle: (args: unknown) => Promise<unknown>;
};

export type SkillSummary = {
  slug: string;
  name: string;
  description: string;
};

export type SkillIndexEntry = SkillSummary & {
  dirAbs: string;
  skillMdAbs: string;
};
