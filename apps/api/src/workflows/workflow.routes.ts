import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/auth.middleware.js";
import { prisma } from "../db.js";
import * as aiIntake from "./ai-intake.service.js";
import * as attachments from "./attachment.service.js";
import { requestTypeSchemas } from "./workflow.rules.js";
import * as workflows from "./workflow.service.js";

const router = Router();
router.use(requireAuth);

router.get("/request-types", (_req, res) => res.json({ requestTypes: requestTypeSchemas }));
router.get("/requests", async (req, res, next) => {
  try { res.json({ requests: await workflows.listRequests(req.user!) }); } catch (error) { next(error); }
});
router.post("/requests", async (req, res, next) => {
  try { res.status(201).json({ request: await workflows.createRequest(req.user!, req.body) }); } catch (error) { next(error); }
});
router.get("/requests/:id", async (req, res, next) => {
  try { res.json({ request: await workflows.getRequest(req.user!, req.params.id) }); } catch (error) { next(error); }
});
router.get("/requests/:id/context", async (req, res, next) => {
  try { const request = await workflows.getRequest(req.user!, req.params.id); res.json({ context: request.context }); } catch (error) { next(error); }
});
router.get("/requests/:id/timeline", async (req, res, next) => {
  try { const request = await workflows.getRequest(req.user!, req.params.id); res.json({ timeline: request.auditLogs }); } catch (error) { next(error); }
});
router.get("/requests/:id/sla", async (req, res, next) => {
  try { const request = await workflows.getRequest(req.user!, req.params.id); res.json({ requestId: request.id, status: request.status, currentOwner: request.currentOwner, consumedPct: request.status === "Escalated" ? 100 : 62 }); } catch (error) { next(error); }
});
router.post("/requests/:id/attachments", async (req, res, next) => {
  try {
    const body = z.object({
      fileName: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(120),
      contentBase64: z.string().min(1),
      isRequired: z.boolean().optional()
    }).parse(req.body);
    res.status(201).json({ attachment: await attachments.uploadAttachment(req.user!, req.params.id, body) });
  } catch (error) { next(error); }
});
router.get("/attachments/:id/download", async (req, res, next) => {
  try {
    const file = await attachments.downloadAttachment(req.user!, req.params.id);
    res.setHeader("content-type", file.mimeType);
    res.setHeader("content-length", file.sizeBytes);
    res.setHeader("content-disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.send(file.body);
  } catch (error) { next(error); }
});
router.get("/approvals/inbox", async (req, res, next) => {
  try { res.json({ approvals: await workflows.approvalInbox(req.user!) }); } catch (error) { next(error); }
});
router.post("/approvals/:id/approve", async (req, res, next) => {
  try { res.json({ approval: await workflows.decideApproval(req.user!, req.params.id, "Approved", req.body?.comments) }); } catch (error) { next(error); }
});
router.post("/approvals/:id/reject", async (req, res, next) => {
  try { res.json({ approval: await workflows.decideApproval(req.user!, req.params.id, "Rejected", req.body?.comments) }); } catch (error) { next(error); }
});
router.post("/approvals/:id/send-back", async (req, res, next) => {
  try { res.json({ approval: await workflows.decideApproval(req.user!, req.params.id, "Sent Back", req.body?.comments) }); } catch (error) { next(error); }
});
router.post("/approvals/:id/request-information", async (req, res, next) => {
  try { res.json({ approval: await workflows.decideApproval(req.user!, req.params.id, "Information Requested", req.body?.comments) }); } catch (error) { next(error); }
});
router.post("/approvals/:id/delegate", async (req, res, next) => {
  try {
    const body = z.object({ delegateEmployeeId: z.string().min(1), comments: z.string().optional() }).parse(req.body);
    res.json({ approval: await workflows.delegateApproval(req.user!, req.params.id, body.delegateEmployeeId, body.comments) });
  } catch (error) { next(error); }
});
router.get("/resources", async (_req, res, next) => {
  try { res.json({ resources: await prisma.resource.findMany({ include: { allocations: true } }) }); } catch (error) { next(error); }
});
router.post("/resource-allocation/recommendations", async (req, res, next) => {
  try { const body = z.object({ skill: z.string().default("React") }).parse(req.body); res.json({ recommendations: await workflows.resourceRecommendations(body.skill) }); } catch (error) { next(error); }
});
router.get("/analytics", async (req, res, next) => {
  try { res.json(await workflows.analytics(req.user!)); } catch (error) { next(error); }
});
router.get("/governance", async (_req, res, next) => {
  try { res.json(await workflows.governance()); } catch (error) { next(error); }
});
router.post("/ai/intake", async (req, res, next) => {
  try {
    const body = z.object({
      prompt: z.string().min(1),
      context: z.record(z.unknown()).optional(),
      requestId: z.string().optional()
    }).parse(req.body);
    res.json(await aiIntake.suggestIntake(req.user!, body));
  } catch (error) { next(error); }
});

export const workflowRouter = router;
