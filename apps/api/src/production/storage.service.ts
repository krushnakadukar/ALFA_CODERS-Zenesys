import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoredFile } from "./domain.js";

export type FileWriteInput = {
  organizationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  body: AsyncIterable<Uint8Array>;
};

export interface StorageProvider {
  providerName: string;
  put(input: FileWriteInput): Promise<StoredFile>;
  get(file: StoredFile): Promise<AsyncIterable<Uint8Array>>;
  delete(file: StoredFile): Promise<void>;
}

export class FileValidationError extends Error {}
export class FileAccessDeniedError extends Error {}

export function validateFile(input: Pick<FileWriteInput, "mimeType" | "sizeBytes">, allowedMimeTypes: string[], maxBytes: bigint) {
  if (!allowedMimeTypes.includes(input.mimeType)) {
    throw new FileValidationError(`Unsupported file type: ${input.mimeType}`);
  }
  if (input.sizeBytes > maxBytes) {
    throw new FileValidationError("File exceeds maximum size");
  }
}

export class LocalStorageProvider implements StorageProvider {
  providerName = "local";

  constructor(private readonly rootDir: string) {}

  async put(input: FileWriteInput): Promise<StoredFile> {
    const body = await readAll(input.body);
    const checksum = crypto.createHash("sha256").update(body).digest("hex");
    const storageKey = path.join(input.organizationId, `${crypto.randomUUID()}-${sanitizeFileName(input.fileName)}`);
    const absolutePath = path.resolve(this.rootDir, storageKey);
    const absoluteRoot = path.resolve(this.rootDir);
    if (!absolutePath.startsWith(absoluteRoot)) {
      throw new FileValidationError("Invalid storage path");
    }
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, body);
    return {
      fileId: crypto.randomUUID(),
      organizationId: input.organizationId,
      storageProvider: this.providerName,
      storageKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: BigInt(body.length),
      checksum
    };
  }

  async get(file: StoredFile): Promise<AsyncIterable<Uint8Array>> {
    const absolutePath = path.resolve(this.rootDir, file.storageKey);
    const body = await readFile(absolutePath);
    return singleChunk(body);
  }

  async delete(): Promise<void> {
    throw new Error("Delete is not implemented for local attachment storage yet");
  }
}

export type AttachmentAccessContext = {
  user: {
    employeeId: string;
    organizationId: string;
    permissions: string[];
  };
  request: {
    organizationId: string;
    employeeId: string;
    currentOwnerId?: string | null;
  };
  assignedApproverIds: string[];
};

export function canAccessAttachment(context: AttachmentAccessContext) {
  if (context.user.organizationId !== context.request.organizationId) return false;
  if (context.user.permissions.includes("admin:manage") || context.user.permissions.includes("employee:read:any")) return true;
  if (context.request.employeeId === context.user.employeeId) return true;
  if (context.request.currentOwnerId === context.user.employeeId) return true;
  return context.assignedApproverIds.includes(context.user.employeeId);
}

export async function bufferToAsyncIterable(buffer: Buffer): Promise<AsyncIterable<Uint8Array>> {
  return singleChunk(buffer);
}

async function readAll(body: AsyncIterable<Uint8Array>) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

async function* singleChunk(buffer: Buffer): AsyncIterable<Uint8Array> {
  yield buffer;
}
