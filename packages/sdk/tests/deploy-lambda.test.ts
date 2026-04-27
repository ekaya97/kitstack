import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSend = vi.fn();

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
    PutFunctionConcurrencyCommand: vi.fn().mockImplementation((input: any) => {
      return { _type: "PutFunctionConcurrency", input };
    }),
    waitUntilFunctionActiveV2: vi.fn().mockResolvedValue(undefined),
    waitUntilFunctionUpdatedV2: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@aws-sdk/client-cloudwatch-logs", () => {
  return {
    CloudWatchLogsClient: vi.fn().mockImplementation(() => ({ send: vi.fn().mockResolvedValue({}) })),
    PutRetentionPolicyCommand: vi.fn().mockImplementation((input: any) => {
      return { _type: "PutRetentionPolicy", input };
    }),
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
    expect(input.Handler).toBe("index.handler");
    expect(input.Role).toBe(BASE_OPTIONS.roleArn);
    expect(input.Code).toEqual({ S3Bucket: "kit-assets", S3Key: "bundles/crm/kit.mjs" });
    expect(input.Layers).toEqual([BASE_OPTIONS.runtimeLayerArn]);
    expect(input.MemorySize).toBe(128);
    expect(input.Timeout).toBe(10);
    expect(input.Environment).toEqual({ Variables: {} });
  });

  it("uses custom memory and timeout", async () => {
    await provisionKitLambda({ ...BASE_OPTIONS, memory: 512, timeout: 60 });
    const createCall = mockSend.mock.calls.find((c: any) => c[0]._type === "CreateFunction")!;
    expect(createCall[0].input.MemorySize).toBe(512);
    expect(createCall[0].input.Timeout).toBe(60);
  });

  it("sets reserved concurrency", async () => {
    await provisionKitLambda(BASE_OPTIONS);
    const concurrencyCall = mockSend.mock.calls.find((c: any) => c[0]._type === "PutFunctionConcurrency")!;
    expect(concurrencyCall[0].input.FunctionName).toBe("Kit-crm");
    expect(concurrencyCall[0].input.ReservedConcurrentExecutions).toBe(5);
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
    expect(types.indexOf("UpdateFunctionCode")).toBeLessThan(types.indexOf("UpdateFunctionConfig"));
  });

  it("does not call CreateFunctionCommand", async () => {
    await provisionKitLambda(BASE_OPTIONS);
    const creates = mockSend.mock.calls.filter((c: any) => c[0]._type === "CreateFunction");
    expect(creates).toHaveLength(0);
  });

  it("sets concurrency after update", async () => {
    await provisionKitLambda(BASE_OPTIONS);
    const types = mockSend.mock.calls.map((c: any) => c[0]._type);
    expect(types).toContain("PutFunctionConcurrency");
    expect(types.indexOf("UpdateFunctionConfig")).toBeLessThan(types.indexOf("PutFunctionConcurrency"));
  });
});

describe("provisionKitLambda — error handling", () => {
  it("rethrows non-ResourceNotFoundException errors", async () => {
    mockSend.mockImplementation((cmd: any) => {
      if (cmd._type === "GetFunction") {
        const err = new Error("Access denied");
        err.name = "AccessDeniedException";
        throw err;
      }
      return {};
    });
    await expect(provisionKitLambda(BASE_OPTIONS)).rejects.toThrow("Access denied");
  });
});
