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


