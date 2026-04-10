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


export type ToolRegistry = {
  /** 固定工具：内置 FS + loadSkill */
  baseTools: RegisteredTool[];
  /** 动态工具：按需加载 skill 后注入（允许后加载覆盖先加载） */
  loadedTools: Map<string, RegisteredTool>;
  /** 给模型的 tools 声明（base + loaded） */
  toolSpecs: RegisteredTool["tool"][];
  /** 启动时的技能索引（仅 name/description） */
  skillIndex: SkillIndexEntry[];
  /** 已加载 skill 的完整文档（用于二次思考注入 system） */
  loadedSkillDocs: Map<string, string>;
};