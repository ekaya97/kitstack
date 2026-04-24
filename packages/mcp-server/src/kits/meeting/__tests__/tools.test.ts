import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createKitTestDb } from "../../../test/create-kit-test-db";
import { migrationSql } from "../migrations";
import { meetings, actionItems, decisions } from "../schema";
import { createKitHandler } from "../../../framework";
import meetingKit from "../index";
import type { KitToolInvocation } from "../../../framework/types";
import { textOf } from "../../../test/helpers";

let db: Awaited<ReturnType<typeof createKitTestDb>>;
let handler: ReturnType<typeof createKitHandler>;

vi.mock("../../../framework/kit-db", () => ({
  createKitDbClient: () => db,
}));

beforeEach(async () => {
  db = await createKitTestDb(migrationSql);
  handler = createKitHandler(meetingKit);
});

function invoke(toolName: string, args: Record<string, unknown> = {}): KitToolInvocation {
  return { toolName, args, userId: "user-1", kitId: "meeting", dbUrl: ":memory:", dbToken: "" };
}

// --- process_meeting ---

describe("process_meeting", () => {
  it("stores a meeting with actions and decisions", async () => {
    const result = await handler(
      invoke("process_meeting", {
        title: "Sprint Planning",
        date: "2026-04-20",
        attendees: ["Alice", "Bob"],
        notes: "Discussed sprint goals...",
        extractedActions: [
          { description: "Write user stories", owner: "Alice", deadline: "2026-04-22" },
          { description: "Set up CI", owner: "Bob" },
        ],
        extractedDecisions: ["Launch date is April 30"],
      })
    );

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Sprint Planning");
    expect(textOf(result)).toContain("2 action item(s)");
    expect(textOf(result)).toContain("1 decision(s)");

    const allMeetings = await db.select().from(meetings);
    expect(allMeetings).toHaveLength(1);

    const allActions = await db.select().from(actionItems);
    expect(allActions).toHaveLength(2);
    expect(allActions[0].status).toBe("open");

    const allDecisions = await db.select().from(decisions);
    expect(allDecisions).toHaveLength(1);
  });

  it("warns about actions without owner or deadline", async () => {
    const result = await handler(
      invoke("process_meeting", {
        title: "Quick Sync",
        date: "2026-04-21",
        attendees: ["Alice"],
        notes: "Brief sync...",
        extractedActions: [{ description: "Follow up" }],
        extractedDecisions: [],
      })
    );

    expect(textOf(result)).toContain("no owner");
    expect(textOf(result)).toContain("no deadline");
  });
});

// --- list_meetings ---

describe("list_meetings", () => {
  it("returns empty when no meetings", async () => {
    const result = await handler(invoke("list_meetings"));
    expect(textOf(result)).toContain("No meetings found");
  });

  it("lists meetings sorted by date descending", async () => {
    await handler(
      invoke("process_meeting", {
        title: "Older Meeting",
        date: "2026-04-01",
        attendees: ["A"],
        notes: "old",
        extractedActions: [],
        extractedDecisions: [],
      })
    );
    await handler(
      invoke("process_meeting", {
        title: "Newer Meeting",
        date: "2026-04-20",
        attendees: ["B"],
        notes: "new",
        extractedActions: [],
        extractedDecisions: [],
      })
    );

    const result = await handler(invoke("list_meetings"));
    const text = textOf(result);
    expect(text).toContain("2 meeting(s)");
    expect(text.indexOf("Newer Meeting")).toBeLessThan(text.indexOf("Older Meeting"));
  });
});

// --- get_meeting ---

describe("get_meeting", () => {
  it("returns meeting details with actions and decisions", async () => {
    await handler(
      invoke("process_meeting", {
        title: "Kickoff",
        date: "2026-04-15",
        attendees: ["Alice", "Bob"],
        notes: "Project kickoff...",
        extractedActions: [{ description: "Draft plan", owner: "Alice", deadline: "2026-04-18" }],
        extractedDecisions: ["Use React for frontend"],
      })
    );

    const allMeetings = await db.select().from(meetings);
    const meetingId = allMeetings[0].id;

    const result = await handler(invoke("get_meeting", { meetingId }));
    const text = textOf(result);
    expect(text).toContain("Kickoff");
    expect(text).toContain("Draft plan");
    expect(text).toContain("Use React for frontend");
  });

  it("returns error for nonexistent meeting", async () => {
    const result = await handler(invoke("get_meeting", { meetingId: "nope" }));
    expect(result.isError).toBe(true);
  });
});

// --- list_actions ---

describe("list_actions", () => {
  beforeEach(async () => {
    await handler(
      invoke("process_meeting", {
        title: "Meeting 1",
        date: "2026-04-10",
        attendees: ["Alice", "Bob"],
        notes: "...",
        extractedActions: [
          { description: "Task A", owner: "Alice", deadline: "2026-04-12" },
          { description: "Task B", owner: "Bob", deadline: "2026-04-15" },
        ],
        extractedDecisions: [],
      })
    );
  });

  it("lists all actions", async () => {
    const result = await handler(invoke("list_actions"));
    expect(textOf(result)).toContain("2 action item(s)");
  });

  it("filters by owner", async () => {
    const result = await handler(invoke("list_actions", { owner: "Alice" }));
    expect(textOf(result)).toContain("Task A");
    expect(textOf(result)).not.toContain("Task B");
  });

  it("filters by status", async () => {
    const result = await handler(invoke("list_actions", { status: "done" }));
    expect(textOf(result)).toContain("No action items found");
  });
});

// --- update_action ---

describe("update_action", () => {
  it("marks an action as done", async () => {
    await handler(
      invoke("process_meeting", {
        title: "Test",
        date: "2026-04-10",
        attendees: ["A"],
        notes: "...",
        extractedActions: [{ description: "Do something", owner: "A" }],
        extractedDecisions: [],
      })
    );

    const actions = await db.select().from(actionItems);
    const actionId = actions[0].id;

    const result = await handler(invoke("update_action", { actionId, status: "done" }));
    expect(textOf(result)).toContain("completed");

    const updated = await db.select().from(actionItems).where(eq(actionItems.id, actionId));
    expect(updated[0].status).toBe("done");
  });

  it("returns error for nonexistent action", async () => {
    const result = await handler(invoke("update_action", { actionId: "nope", status: "done" }));
    expect(result.isError).toBe(true);
  });
});

// --- open_items_summary ---

describe("open_items_summary", () => {
  it("returns all-caught-up when no open items", async () => {
    const result = await handler(invoke("open_items_summary"));
    expect(textOf(result)).toContain("all caught up");
  });

  it("shows open items grouped by meeting", async () => {
    await handler(
      invoke("process_meeting", {
        title: "Sprint 1",
        date: "2026-04-10",
        attendees: ["A"],
        notes: "...",
        extractedActions: [
          { description: "Task 1", owner: "A", deadline: "2026-04-12" },
          { description: "Task 2", owner: "B" },
        ],
        extractedDecisions: [],
      })
    );

    const result = await handler(invoke("open_items_summary"));
    const text = textOf(result);
    expect(text).toContain("2 open action item(s)");
    expect(text).toContain("Sprint 1");
    expect(text).toContain("Task 1");
    expect(text).toContain("Task 2");
  });
});
