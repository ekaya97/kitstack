import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({})),
    GetObjectCommand: vi.fn().mockImplementation((input) => input),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned-url"),
}));

vi.mock("sst", () => ({
  Resource: {
    SkillAssets: { name: "test-bucket" },
  },
}));

import { getDownloadUrl } from "../storage.service";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getDownloadUrl", () => {
  it("returns a presigned URL", async () => {
    const url = await getDownloadUrl("kits/test-kit.zip");
    expect(url).toBe("https://s3.example.com/presigned-url");
  });

  it("calls GetObjectCommand with correct bucket and key", async () => {
    await getDownloadUrl("kits/my-kit.zip");
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "kits/my-kit.zip",
    });
  });

  it("uses default expiry of 3600 seconds", async () => {
    await getDownloadUrl("kits/test.zip");
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 3600 }
    );
  });

  it("passes custom expiry", async () => {
    await getDownloadUrl("kits/test.zip", 7200);
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 }
    );
  });

  it("throws if s3Key is empty", async () => {
    await expect(getDownloadUrl("")).rejects.toThrow();
  });
});
