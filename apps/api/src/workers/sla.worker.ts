import { prisma } from "../db.js";
import { PrismaSlaRepository } from "../production/sla.worker.repository.js";
import { SlaService } from "../production/sla.service.js";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.SLA_WORKER_INTERVAL_MS ?? 60_000);

async function runOnce() {
  const summary = await new SlaService(new PrismaSlaRepository()).processDueEvents();
  console.log(
    `SLA worker run complete: reminders=${summary.remindersSent} breached=${summary.breached} escalated=${summary.escalated} exceptions=${summary.exceptions}`
  );
}

if (once) {
  runOnce()
    .finally(async () => {
      await prisma.$disconnect();
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
} else {
  runOnce().catch((error) => console.error(error));
  setInterval(() => {
    runOnce().catch((error) => console.error(error));
  }, intervalMs);
}
