import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  GetItemCommand: vi.fn().mockImplementation((input) => ({ input, _type: "GetItem" })),
  PutItemCommand: vi.fn().mockImplementation((input) => ({ input, _type: "PutItem" })),
  QueryCommand: vi.fn().mockImplementation((input) => ({ input, _type: "Query" })),
  ScanCommand: vi.fn().mockImplementation((input) => ({ input, _type: "Scan" })),
}));

vi.mock("@aws-sdk/util-dynamodb", () => ({
  marshall: vi.fn((obj) => obj),
  unmarshall: vi.fn((obj) => obj),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("KIT_REGISTRY_TABLE", "test-registry");
  vi.stubEnv("USER_KIT_DBS_TABLE", "test-user-kit-dbs");
});

import {
  getAllRegistryItems,
  getRegistryItemsForKit,
  putRegistryItem,
  getUserKitDb,
  putUserKitDb,
} from "../dynamo";

describe("Kit Registry operations", () => {
  it("getAllRegistryItems scans the registry table", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { kitId: "kit-crm", toolName: "add_contact", toolDescription: "Add a contact" },
      ],
    });

    const items = await getAllRegistryItems();
    expect(items).toHaveLength(1);
    expect(items[0].kitId).toBe("kit-crm");
  });

  it("getRegistryItemsForKit queries by kitId", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        { kitId: "kit-meeting", toolName: "process_meeting" },
        { kitId: "kit-meeting", toolName: "list_meetings" },
      ],
    });

    const items = await getRegistryItemsForKit("kit-meeting");
    expect(items).toHaveLength(2);
  });

  it("putRegistryItem puts an item", async () => {
    mockSend.mockResolvedValueOnce({});

    await putRegistryItem({
      kitId: "kit-crm",
      toolName: "add_contact",
      toolDescription: "Add a contact",
      inputSchema: "{}",
      kitName: "CRM Kit",
    });

    expect(mockSend).toHaveBeenCalledOnce();
  });
});

describe("User Kit DB operations", () => {
  it("getUserKitDb returns item when found", async () => {
    mockSend.mockResolvedValueOnce({
      Item: { userId: "user-1", kitId: "crm", dbUrl: "libsql://test.turso.io", dbToken: "tok" },
    });

    const result = await getUserKitDb("user-1", "crm");
    expect(result).toBeDefined();
    expect(result!.dbUrl).toBe("libsql://test.turso.io");
  });

  it("getUserKitDb returns null when not found", async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const result = await getUserKitDb("user-1", "nonexistent");
    expect(result).toBeNull();
  });

  it("putUserKitDb stores a mapping", async () => {
    mockSend.mockResolvedValueOnce({});

    await putUserKitDb({
      userId: "user-1",
      kitId: "crm",
      dbUrl: "libsql://test.turso.io",
      dbToken: "tok",
      provisionedAt: "2026-01-01T00:00:00Z",
    });

    expect(mockSend).toHaveBeenCalledOnce();
  });
});
