import { createKitHandler } from "../../../../packages/mcp-server/src/framework";
import meetingKit from "./index";

export const handler = createKitHandler(meetingKit);
