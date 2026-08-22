import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("mysql://root:password@localhost:3306/employee_workflow_demo"),
  PORT: z.coerce.number().default(4000),
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-before-production"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-before-production"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  STORAGE_ROOT: z.string().default(".orgflow-storage"),
  ATTACHMENT_MAX_BYTES: z.coerce.bigint().default(10n * 1024n * 1024n),
  ATTACHMENT_ALLOWED_MIME_TYPES: z.string().default("application/pdf,image/png,image/jpeg,text/plain")
});

export const config = envSchema.parse(process.env);

