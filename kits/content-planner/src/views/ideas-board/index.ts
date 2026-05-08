import { defineView } from "@kitstackco/sdk";
import { loader } from "./loader";
import { IdeasBoardView } from "./View";

export default defineView({
  slug: "ideas-board",
  name: "Ideas Board",
  description: "for browsing content ideas as a Kanban board with captured, developing, and ready columns",
  loader,
  component: IdeasBoardView,
  height: 480,
  placeholder: [
    { id: "idea_001", title: "AI tools for solopreneurs roundup", description: "Compare the top 5 AI tools I actually use daily", topic: "AI", targetChannel: "blog", priority: "high", status: "captured", createdAt: "2026-05-07" },
    { id: "idea_002", title: "How I price consulting projects", description: null, topic: "freelancing", targetChannel: "linkedin", priority: "medium", status: "developing", createdAt: "2026-05-05" },
    { id: "idea_003", title: "The 80/20 of content marketing", description: "Focus on what actually drives results", topic: "marketing", targetChannel: "newsletter", priority: "medium", status: "ready", createdAt: "2026-05-03" },
    { id: "idea_004", title: "Client red flags", description: "Warning signs from 5 years of freelancing", topic: "freelancing", targetChannel: "linkedin", priority: "low", status: "captured", createdAt: "2026-05-01" },
  ],
});
