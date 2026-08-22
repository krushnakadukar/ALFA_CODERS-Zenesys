import { randomUUID } from "node:crypto";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { HttpError } from "../http/errors.js";
import type { AuthUser } from "../types.js";
import {
  LocalStorageProvider,
  bufferToAsyncIterable,
  canAccessAttachment,
  validateFile,
  FileValidationError,
  type AttachmentAccessContext
} from "../production/storage.service.js";
import type { StoredFile } from "../production/domain.js";

type AttachmentRow = {
  id: string;
  requestId: string;
  fileName: string;
  mimeType: string | null;
  storageProvider: string | null;
  storagePath: string | null;
  fileSizeBytes: bigint | number | null;
  checksum: string | null;
  uploadStatus: string;
  organizationId: string;
  employeeId: string;
  currentOwnerId: string | null;
};

export type UploadAttachmentInput = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  isRequired?: boolean;
};

const storageProvider = new LocalStorageProvider(config.STORAGE_ROOT);

export async function uploadAttachment(user: AuthUser, requestId: string, input: UploadAttachmentInput) {
  const request = await prisma.request.findUnique({ where: { id: requestId }, include: { approvals: true } });
  if (!request || request.organizationId !== user.organizationId) throw new HttpError(404, "Request not found");
  const accessContext: AttachmentAccessContext = {
    user,
    request,
    assignedApproverIds: request.approvals.map((approval) => approval.approverId)
  };
  if (!canAccessAttachment(accessContext)) throw new HttpError(403, "You cannot upload attachments for this request");

  const body = decodeBase64(input.contentBase64);
  try {
    validateFile(
      { mimeType: input.mimeType, sizeBytes: BigInt(body.length) },
      allowedMimeTypes(),
      config.ATTACHMENT_MAX_BYTES
    );
  } catch (error) {
    if (error instanceof FileValidationError) throw new HttpError(400, error.message);
    throw error;
  }

  const stored = await storageProvider.put({
    organizationId: user.organizationId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: BigInt(body.length),
    body: await bufferToAsyncIterable(body)
  });
  const attachmentId = `ATT-${randomUUID()}`;
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO attachments
        (attachment_id, request_id, file_name, mime_type, storage_provider, storage_path, file_size_bytes, checksum, upload_status, uploaded_by_id, created_at, is_required)
      VALUES
        (${attachmentId}, ${requestId}, ${stored.fileName}, ${stored.mimeType}, ${stored.storageProvider}, ${stored.storageKey}, ${stored.sizeBytes}, ${stored.checksum ?? null}, 'UPLOADED', ${user.employeeId}, NOW(3), ${Boolean(input.isRequired)})
    `,
    prisma.auditLog.create({
      data: {
        id: `AUD-${randomUUID()}`,
        requestId,
        actorId: user.employeeId,
        eventType: "ATTACHMENT_UPLOADED",
        eventAt: new Date(),
        details: `${stored.fileName} uploaded (${stored.mimeType}, ${stored.sizeBytes.toString()} bytes, checksum ${stored.checksum})`
      }
    })
  ]);

  return {
    id: attachmentId,
    requestId,
    fileName: stored.fileName,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes.toString(),
    checksum: stored.checksum,
    uploadStatus: "UPLOADED"
  };
}

export async function downloadAttachment(user: AuthUser, attachmentId: string) {
  const attachment = await loadAttachment(attachmentId);
  if (!attachment) throw new HttpError(404, "Attachment not found");
  const assignedApproverIds = await approverIdsForRequest(attachment.requestId);
  const accessContext: AttachmentAccessContext = {
    user,
    request: {
      organizationId: attachment.organizationId,
      employeeId: attachment.employeeId,
      currentOwnerId: attachment.currentOwnerId
    },
    assignedApproverIds
  };
  if (!canAccessAttachment(accessContext)) {
    await auditDeniedDownload(attachment.requestId, user.employeeId, attachmentId);
    throw new HttpError(403, "You cannot download this attachment");
  }
  if (attachment.uploadStatus !== "UPLOADED" || !attachment.storagePath || !attachment.mimeType) {
    throw new HttpError(409, "Attachment is not available for download");
  }

  const stored: StoredFile = {
    fileId: attachment.id,
    organizationId: attachment.organizationId,
    storageProvider: attachment.storageProvider ?? "local",
    storageKey: attachment.storagePath,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: BigInt(attachment.fileSizeBytes ?? 0),
    checksum: attachment.checksum ?? undefined
  };
  const bodyIterable = await storageProvider.get(stored);
  const body = await asyncIterableToBuffer(bodyIterable);

  await prisma.auditLog.create({
    data: {
      id: `AUD-${randomUUID()}`,
      requestId: attachment.requestId,
      actorId: user.employeeId,
      eventType: "ATTACHMENT_DOWNLOADED",
      eventAt: new Date(),
      details: `${attachment.fileName} downloaded`
    }
  });

  return {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: String(attachment.fileSizeBytes ?? body.length),
    body
  };
}

async function loadAttachment(attachmentId: string) {
  const rows = await prisma.$queryRaw<AttachmentRow[]>`
    SELECT
      a.attachment_id AS id,
      a.request_id AS requestId,
      a.file_name AS fileName,
      a.mime_type AS mimeType,
      a.storage_provider AS storageProvider,
      a.storage_path AS storagePath,
      a.file_size_bytes AS fileSizeBytes,
      a.checksum AS checksum,
      a.upload_status AS uploadStatus,
      r.organization_id AS organizationId,
      r.employee_id AS employeeId,
      r.current_owner_id AS currentOwnerId
    FROM attachments a
    INNER JOIN requests r ON r.request_id = a.request_id
    WHERE a.attachment_id = ${attachmentId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function approverIdsForRequest(requestId: string) {
  const rows = await prisma.$queryRaw<Array<{ approverId: string }>>`
    SELECT approver_id AS approverId
    FROM approvals
    WHERE request_id = ${requestId}
    UNION
    SELECT approver_id AS approverId
    FROM approval_chain_steps
    WHERE request_id = ${requestId}
  `;
  return rows.map((row) => row.approverId);
}

async function auditDeniedDownload(requestId: string, actorId: string, attachmentId: string) {
  await prisma.auditLog.create({
    data: {
      id: `AUD-${randomUUID()}`,
      requestId,
      actorId,
      eventType: "ATTACHMENT_DOWNLOAD_DENIED",
      eventAt: new Date(),
      details: `Denied download for attachment ${attachmentId}`
    }
  });
}

function allowedMimeTypes() {
  return config.ATTACHMENT_ALLOWED_MIME_TYPES.split(",").map((item) => item.trim()).filter(Boolean);
}

function decodeBase64(contentBase64: string) {
  try {
    return Buffer.from(contentBase64, "base64");
  } catch {
    throw new HttpError(400, "Invalid base64 content");
  }
}

async function asyncIterableToBuffer(body: AsyncIterable<Uint8Array>) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
