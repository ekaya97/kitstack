import { Resource } from "sst";

console.log("MCP:", (Resource as any).McpRouter?.url);
console.log("RELAY:", (Resource as any).DevRelay?.url);
console.log("APP_DATA:", (Resource as any).AppData?.url);
process.exit(0);
