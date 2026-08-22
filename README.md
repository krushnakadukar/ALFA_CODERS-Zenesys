# OrgFlow

OrgFlow is an employee workflow management system built to help organizations handle internal requests, approvals, resources, analytics, and governance from one place.

The project provides a role-based workflow console where employees can submit requests, managers can review approvals, HR and finance teams can monitor operational queues, and leaders can track bottlenecks, utilization, and organization-wide activity.

## Project Purpose

OrgFlow is designed to simplify common company workflows such as:

- Leave requests
- Expense reimbursements
- Asset requests
- Resource allocation requests
- Work-from-home requests
- Approval tracking
- Team and department visibility

The goal is to reduce manual coordination, improve approval transparency, and give different roles a clear view of the work they are responsible for.

## Key Features

- Role-based dashboards for employees, managers, HR, finance, and department heads
- Request creation and lifecycle tracking
- Approval inbox with approve, reject, and send-back actions
- Send-back flow for approvers to request more information from employees
- Organization hierarchy and reporting structure view
- Resource utilization and capacity insights
- Analytics for open requests, escalations, bottlenecks, and notifications
- Governance view with role permissions and audit logs
- AI-assisted intake for classifying employee request messages
- Attachment support for required proofs and documents
- SLA worker support for workflow monitoring and escalation

## Tech Stack

- React
- Vite
- TypeScript
- Node.js
- Express
- Prisma
- MySQL
- Vitest

## Getting Started

Install dependencies from the repository root:

```bash
npm install
```

Create environment files from the examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Start the API:

```bash
npm run dev:api
```

Start the web app:

```bash
npm run dev:web
```

## Available Scripts

```bash
npm run dev:api
npm run dev:web
npm run build
npm run lint
npm run test
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## Database

OrgFlow uses Prisma with MySQL. A local MySQL service can be started with Docker Compose:

```bash
docker compose up -d
```

After configuring `DATABASE_URL`, run migrations and seed data:

```bash
npm run prisma:migrate
npm run seed
```

## Project Structure

```text
apps/
  api/   Backend API, authentication, workflows, Prisma schema, workers, and tests
  web/   React frontend for the OrgFlow workflow console
```

## Application Modules

- Authentication and role permissions
- Organization tree and employee profiles
- Workflow request management
- Approval routing
- SLA and escalation handling
- Resource allocation
- Analytics and governance
- AI intake and request classification
- Attachment storage metadata

## Current Implementation

The current implementation includes the base monorepo structure, backend API, React workflow console, Prisma schema and migrations, seed data, tests, Docker Compose setup, and an approval send-back workflow for requesting additional details from employees.

## Repository

```text
https://github.com/krushnakadukar/ALFA_CODERS-Zenesys.git
```

