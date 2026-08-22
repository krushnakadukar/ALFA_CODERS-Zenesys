export type BottleneckInput = {
  approverSource: string;
  status: string;
  createdAt: Date;
  actionAt?: Date | null;
};

export function calculateBottlenecks(rows: BottleneckInput[], now = new Date()) {
  const groups = rows
    .filter((item) => ["PENDING", "SLA_REMINDER_SENT", "SLA_BREACHED", "ESCALATED"].includes(item.status))
    .reduce<Record<string, { stage: string; count: number; hours: number[]; breached: number }>>((acc, item) => {
      const stage = item.approverSource;
      const current = acc[stage] ?? { stage, count: 0, hours: [], breached: 0 };
      current.count += 1;
      current.hours.push(hoursBetween(item.createdAt, item.actionAt ?? now));
      if (item.status === "SLA_BREACHED" || item.status === "ESCALATED") current.breached += 1;
      acc[stage] = current;
      return acc;
    }, {});
  return Object.values(groups)
    .map((item) => ({
      stage: item.stage,
      count: item.count,
      averageHours: roundOne(average(item.hours)),
      breached: item.breached
    }))
    .sort((left, right) => right.averageHours - left.averageHours);
}

export function hoursBetween(start: Date, end: Date) {
  return Math.max(0, (end.getTime() - start.getTime()) / (60 * 60 * 1000));
}

export function average(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (usable.length === 0) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

export function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
