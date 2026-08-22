# OrgFlow Production Audit

Status: production work required. The current implementation is not production-complete.

## Current Production Conflicts

- The frontend is API-backed, but still uses UI assumptions and simplified displays for SLA state, lifecycle state, and AI intake.
- Workflow routing is partly service-side, but request schemas and routing rules are still static TypeScript configuration instead of tenant-configurable database records.
- Roles and permissions exist in the database. `user_roles` has been added as an additive multi-role assignment path, but remaining workflow and organization endpoints still need to consume scoped roles consistently.
- Authorization middleware exists, but workflow endpoints need request-specific authority checks for organization, department, team, workflow step, approval assignment, delegation, and resource scope.
- The organization model supports organization, department, team, employee, and manager self-reference, but not business units, divisions, or typed organizational relationships.
- SLA display exists, but there is no persistent background SLA worker that calculates deadlines, reminders, breaches, escalation, and history.
- Notifications are persisted, but delivery architecture is not yet event-driven with retry/failure tracking across channels.
- Attachments are metadata only; there is no file storage abstraction, upload validation, secure retrieval, or file-level authorization.
- AI intake is rule-based classification; it is not a provider-swappable AI adapter with deterministic rule enforcement after AI output.
- Analytics endpoints calculate from persisted data in part, but bottleneck timing still contains placeholder logic.
- Prisma migrations are not yet production-authoritative; local setup used `db push` as a workaround.
- Test coverage is only a health smoke test; critical business logic is not covered.

## Required Refactor Tracks

1. Multi-tenant organization model
   - Add business units and divisions.
   - Add typed organization relationships.
   - Ensure every tenant-owned business entity carries organization scope.

2. Multi-role RBAC
   - Replace single employee role with user-role assignments.
   - Keep roles and permissions configurable per organization.
   - Add scoped permissions for organization, business unit, division, department, team, workflow, and resource.

3. Configurable workflow engine
   - Persist request types, request fields, workflow definitions, workflow steps, routing rules, approval rules, proof rules, notification rules, and escalation rules.
   - Resolve approvers server-side from configured rules and organization relationships.
   - Support sequential and parallel workflow steps.

4. SLA engine
   - Persist SLA policies, deadlines, reminders, breaches, escalations, and SLA events.
   - Add a background worker process.

5. Notification architecture
   - Create event-driven notification service.
   - Track channel, delivery status, read status, retry count, last error, and timestamps.

6. File storage
   - Add storage provider abstraction for local development and production object storage.
   - Validate size and MIME type.
   - Authorize downloads by request and tenant scope.

7. AI integration
   - Add provider interface.
   - Store AI suggestions as advisory records.
   - Require deterministic validation and workflow rules after AI classification.

8. Analytics
   - Calculate request volume, turnaround, SLA compliance, breaches, workload, utilization, bottlenecks, and escalations from persisted records.

9. Testing
   - Add unit and integration tests for auth, RBAC, tenant isolation, relationships, request validation, routing, approvals, delegation, SLA, resources, notifications, audit, file access, and admin configuration.

10. Deployment readiness
   - Use versioned migrations.
   - Separate production runtime config from development seed data.
   - Add production logging, worker process, and deployment documentation.

## Implementation Progress

- Added additive `user_roles` schema and versioned migration for multi-role RBAC assignments.
- Updated authentication to load active user-role assignments, flatten permissions for existing endpoints, preserve scoped role metadata in access tokens, and fall back to the legacy employee role when assignments do not exist.
- Updated demo seed data to create one role assignment per user from the existing employee primary role.
- Added token regression coverage for scoped multi-role claims.
- Added a dedicated intelligent routing engine module with policy-driven requirements, approver discovery hooks, validation, explicit delegation handling, hierarchy fallback, routing exceptions, explainable approval-chain output, and routing decision logs.
- Added tests for manager self-approval prevention, indirect finance self-approval prevention, explicit delegation, and no-valid-approver routing exceptions.
- Added versioned persistence tables for `approval_chain_steps` and `routing_decision_logs`.
- Wired `POST /requests` through the intelligent routing engine instead of blindly assigning the requester's immediate manager.
- Added a Prisma-backed routing repository for current manager, department authority, HR, finance, IT/security, procurement, project manager, and executive-authority discovery using organization data.
- Persisted routing explanations into approval comments, audit logs, approval-chain rows, and routing-decision logs.
- Expanded supported request types to cover the required ERP/HR catalog from the master directive.
- Added backend-controlled approval actions for approve, reject, send back, request information, and delegate, including sequential chain advancement.
- Routing exceptions now notify an available admin/HR authority when one exists, with requester fallback only if no administrator can be found.
- Added database-backed configuration tables for request types, routing policies, approval requirements, delegation rules, and SLA policies.
- Seeded default configurable policies for the required ERP/HR request catalog, including amount and duration conditions.
- Switched routing policy loading to use database configuration when available, with code defaults as migration-safe fallback.
- Added scoped delegation rule lookup by organization, delegator, request type, department, active flag, and validity window.
- Added SLA event persistence, a worker-ready SLA processor, Prisma-backed SLA repository, and `worker:sla` / `worker:sla:once` scripts.
- SLA processing now sends reminders at threshold, marks breaches, escalates to an authorized higher approver or HR/admin authority, and records routing exceptions when no escalation target exists.
- Added attachment storage metadata, local tenant-scoped storage provider, checksum and size tracking, upload/download APIs, MIME and size validation, request/tenant authorization, and audit events for upload/download/denied download.
- Added AI suggestion persistence, advisory-only intake service, deterministic request-type/field/confidence validation after provider output, and validation tests so AI can recommend but not bypass workflow rules.
- Reworked analytics to calculate request volume, turnaround, SLA compliance, breaches, escalations, approver workload, utilization, and bottlenecks from persisted records instead of placeholder timing.
- Added integration coverage for DB-policy request routing, approval-chain/log persistence, and sequential approval advancement.
- Added production runbook and root SLA worker scripts for deployment/operation verification.
