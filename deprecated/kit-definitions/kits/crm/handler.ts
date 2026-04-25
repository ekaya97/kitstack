import { createKitHandler } from "../../../../packages/mcp-server/src/framework";
import crmKit from "./index";

export const handler = createKitHandler(crmKit);
