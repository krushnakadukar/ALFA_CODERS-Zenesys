import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FileValidationError,
  LocalStorageProvider,
  bufferToAsyncIterable,
  canAccessAttachment,
  validateFile
} from "../src/production/storage.service.js";

describe("production attachment storage", () => {
  it("rejects unsupported MIME types and oversized files", () => {
    expect(() => validateFile({ mimeType: "application/x-msdownload", sizeBytes: 10n }, ["application/pdf"], 100n)).toThrow(FileValidationError);
    expect(() => validateFile({ mimeType: "application/pdf", sizeBytes: 101n }, ["application/pdf"], 100n)).toThrow(FileValidationError);
  });

  it("writes local files under tenant scope with checksum metadata", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "orgflow-storage-"));
    try {
      const stored = await new LocalStorageProvider(root).put({
        organizationId: "ORG1",
        fileName: "proof.txt",
        mimeType: "text/plain",
        sizeBytes: 5n,
        body: await bufferToAsyncIterable(Buffer.from("hello"))
      });

      expect(stored.storageProvider).toBe("local");
      expect(stored.storageKey).toContain("ORG1");
      expect(stored.checksum).toHaveLength(64);
      expect(stored.sizeBytes).toBe(5n);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("allows requester, current approver, assigned approver, and scoped admin access", () => {
    const request = { organizationId: "ORG1", employeeId: "E1", currentOwnerId: "E2" };

    expect(canAccessAttachment({ user: user("E1"), request, assignedApproverIds: [] })).toBe(true);
    expect(canAccessAttachment({ user: user("E2"), request, assignedApproverIds: [] })).toBe(true);
    expect(canAccessAttachment({ user: user("E3"), request, assignedApproverIds: ["E3"] })).toBe(true);
    expect(canAccessAttachment({ user: { ...user("E4"), permissions: ["admin:manage"] }, request, assignedApproverIds: [] })).toBe(true);
  });

  it("denies cross-organization and unrelated employee access", () => {
    const request = { organizationId: "ORG1", employeeId: "E1", currentOwnerId: "E2" };

    expect(canAccessAttachment({ user: { ...user("E1"), organizationId: "ORG2" }, request, assignedApproverIds: [] })).toBe(false);
    expect(canAccessAttachment({ user: user("E9"), request, assignedApproverIds: [] })).toBe(false);
  });
});

function user(employeeId: string) {
  return {
    employeeId,
    organizationId: "ORG1",
    permissions: []
  };
}
