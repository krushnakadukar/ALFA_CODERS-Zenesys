import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { authRouter } from "./auth/auth.routes.js";
import { orgRouter } from "./org/org.routes.js";
import { workflowRouter } from "./workflows/workflow.routes.js";
import { errorHandler, notFound } from "./http/errors.js";

export function createApp() {
  const app = express();

  app.set("json replacer", (_key: string, value: unknown) => {
    if (typeof value !== "bigint") return value;
    const numberValue = Number(value);
    return Number.isSafeInteger(numberValue) ? numberValue : value.toString();
  });

  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "orgflow-api" });
  });

  app.use("/auth", authRouter);
  app.use("/org", orgRouter);
  app.use("/", workflowRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
