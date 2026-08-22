# MySQL Setup

The workflow UI is now API-backed and expects the Express API plus a MySQL 8 database.

## With Docker

```bash
docker compose up -d mysql
```

Use this API `DATABASE_URL`:

```bash
mysql://orgflow:orgflow@localhost:3306/employee_workflow_demo
```

## Run The App

```bash
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev:api
npm run dev:web
```

Demo logins use seeded employee emails. Password: `OrgFlow@123`.

The seed loads organization hierarchy, auth/RBAC, skills, projects, workload, leave balances, workflow definitions, requests, request context, approvals, resources, attachments, notifications, and audit logs.
