import { initLogger,logger } from "./log/logger.js";
import { runAgent } from "./agent/index.js";

initLogger();
logger.info("Starting BIOS Assistant...");

await runAgent();

