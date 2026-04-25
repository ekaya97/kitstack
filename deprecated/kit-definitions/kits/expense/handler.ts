import { createKitHandler } from "../../../../packages/mcp-server/src/framework";
import expenseKit from "./index";

export const handler = createKitHandler(expenseKit);
