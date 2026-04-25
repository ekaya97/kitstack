import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the entire @aws-sdk/client-lambda module since provisionKitLambda
// uses dynamic import() and waitUntilFunctionActiveV2 (a waiter function,
// not a Command — aws-sdk-client-mock can't intercept it).

const mockSend = vi.fn();
const mockGetFunction = vi.fn();
const mockCreateFunction = vi.fn();
const mockUpdateCode = vi.fn();
const mockUpdateConfig = vi.fn();

vi.mock("@aws-sdk/client-lambda", () => {
  return {
    LambdaClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
    GetFunctionCommand: vi.fn().mockImplementation((input: any) => {
      return { _type: "GetFunction", input };
    }),
    CreateFunctionCommand: vi.fn().mockImplementation((input: any) => {
      return { _type: "CreateFunction", input };
    }),
    UpdateFunctionCodeCommand: vi.fn().mockImplementation((input: any) => {
      return { _type: "UpdateFunctionCode", input };
    }),
    UpdateFunctionConfigurationCommand: vi.fn().mockImplementation((input: any) => {
      return { _type: "UpdateFunctionConfig", input };
    }),
    waitUntilFunctionActiveV2: vi.fn().mockResolvedValue(undefined),
  };
});

import { provisionKitLambda } from "../src/deploy/deploy-lambda";

const BASE_OPTIONS = {
  kitId: "crm",
  bucketName: "kit-assets",
  bundleS3Key: "bundles/crm/kit.mjs",
  roleArn: "arn:aws:iam::123456:role/KitLambdaRole",
  runtimeLayerArn: "arn:aws:lambda:eu-central-1:123456:layer:KitRuntime:1",
};

beforeEach(() => {
  mockSend.mockReset();
});

describe("provisionKitLambda — create new function", () => {
  beforeEach(() => {
    // GetFunction throws ResourceNotFoundException → function doesn't exist
    mockSend.mockImplementation((cmd: any) => {
      if (cmd._type === "GetFunction") {
        const err = new Error("Function not found");
        err.name = "ResourceNotFoundException";
        throw err;
      }
      if (cmd._type === "CreateFunction") {
        return { FunctionArn: "arn:aws:lambda:eu-central-1:123456:function:Kit-crm" };
      }
      return {};
    });
  });

  it("creates a function named Kit-{kitId}", async () => {
    const result = await provisionKitLambda(BASE_OPTIONS);
    expect(result.functionName).toBe("Kit-crm");
    expect(result.created).toBe(true);
    expect(result.functionArn).toBe("arn:aws:lambda:eu-central-1:123456:function:Kit-crm");
  });

  it("sends correct CreateFunctionCommand parameters", async () => {
    await provisionKitLambda(BASE_OPTIONS);
    const createCall = mockSend.mock.calls.find((c: any) => c[0]._type === "CreateFunction")!;
    const input = createCall[0].input;
    expect(input.FunctionName).toBe("Kit-crm");
    expect(input.Runtime).toBe("nodejs22.x");
    expect(input.Architectures).toEqual(["arm64"]);
    expect(input.Handler).toBe("index.main");
    expect(input.Role).toBe(BASE_OPTIONS.roleArn);
    expect(input.Code).toEqual({ S3Bucket: "kit-assets", S3Key: "bundles/crm/kit.mjs" });
    expect(input.Layers).toEqual([BASE_OPTIONS.runtimeLayerArn]);
    expect(input.MemorySize).toBe(256);
    expect(input.Timeout).toBe(30);
    expect(input.Environment).toEqual({ Variables: {} });
  });

  it("uses custom memory and timeout", async () => {
    await provisionKitLambda({ ...BASE_OPTIONS, memory: 512, timeout: 60 });
    const createCall = mockSend.mock.calls.find((c: any) => c[0]._type === "CreateFunction")!;
    expect(createCall[0].input.MemorySize).toBe(512);
    expect(createCall[0].input.Timeout).toBe(60);
  });
});

describe("provisionKitLambda — update existing function", () => {
  beforeEach(() => {
    mockSend.mockImplementation((cmd: any) => {
      if (cmd._type === "GetFunction") {
        return {
          Configuration: { FunctionArn: "arn:aws:lambda:eu-central-1:123456:function:Kit-crm" },
        };
      }
      return {};
    });
  });

  it("returns created=false for existing function", async () => {
    const result = await provisionKitLambda(BASE_OPTIONS);
    expect(result.created).toBe(false);
    expect(result.functionName).toBe("Kit-crm");
  });

  it("updates code then config", async () => {
    await provisionKitLambda(BASE_OPTIONS);
    const types = mockSend.mock.calls.map((c: any) => c[0]._type);
    expect(types).toContain("UpdateFunctionCode");
    expect(types).toContain("UpdateFunctionConfig");
    // Code update should come before config update
    expect(types.indexOf("UpdateFunctionCode")).toBeLessThan(types.indexOf("UpdateFunctionConfig"));
  });

  it("does not call CreateFunctionCommand", async () => {
    await provisionKitLambda(BASE_OPTIONS);
    const creates = mockSend.mock.calls.filter((c: any) => c[0]._type === "CreateFunction");
    expect(creates).toHaveLength(0);
  });
});

describe("provisionKitLambda — error handling", () => {
  it("rethrows non-ResourceNotFoundException errors", async () => {
    mockSend.mockImplementation(() => {
      const err = new Error("Access denied");
      err.name = "AccessDeniedException";
      throw err;
    });
    await expect(provisionKitLambda(BASE_OPTIONS)).rejects.toThrow("Access denied");
  });
});
