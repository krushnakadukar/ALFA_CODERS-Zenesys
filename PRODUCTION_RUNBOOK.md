# OrgFlow Production Runbook

## Required Services

- MySQL 8
- OrgFlow API process
- OrgFlow SLA worker process
- OrgFlow web app

## Environment

API:

```bash
DATABASE_URL=mysql://orgflow:orgflow@localhost:3306/employee_workflow_demo
JWT_ACCESS_SECRET=replace-with-production-secret
JWT_REFRESH_SECRET=replace-with-production-secret
CORS_ORIGIN=http://localhost:5173
STORAGE_ROOT=.orgflow-storage
ATTACHMENT_MAX_BYTES=10485760
ATTACHMENT_ALLOWED_MIME_TYPES=application/pdf,image/png,image/jpeg,text/plain
```

Web:

```bash
VITE_API_URL=http://localhost:4000
```

## Bootstrap

```bash
docker compose up -d mysql
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## Run

API:

```bash
npm run dev:api
```

SLA worker:

```bash
npm run worker:sla
```

Web:

```bash
npm run dev:web
```

## Verification

```bash
npm run build
npm test
npm run worker:sla:once
```

## Production Behavior Checklist

- Requests route through policy-backed workflow rules.
- Requesters cannot approve their own requests.
- Missing approvers create routing exceptions.
- Approval chains and routing decision logs are persisted.
- Approval actions are backend-controlled.
- SLA reminders, breaches, escalations, and exceptions are persisted.
- Attachments are MIME/size validated, tenant-scoped, and access-controlled.
- AI intake suggestions are advisory-only and validated before use.
- Analytics are calculated from persisted request, approval, SLA, and workload records.
