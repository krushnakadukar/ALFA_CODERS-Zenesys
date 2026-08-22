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
- Approval inbox with approve and reject actions
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

## Repository

```text
https://github.com/krushnakadukar/ALFA_CODERS-Zenesys.git
```

