import { ownerError } from "./owner-session.service";

const DAY = 86_400_000;
export function parseAnalyticsDate(input: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input))
    throw ownerError(400, "INVALID_ANALYTICS_RANGE", "Informe datas válidas.");
  const value = Date.parse(`${input}T00:00:00Z`);
  if (
    !Number.isFinite(value) ||
    new Date(value).toISOString().slice(0, 10) !== input
  )
    throw ownerError(400, "INVALID_ANALYTICS_RANGE", "Informe datas válidas.");
  return value;
}
export function shiftAnalyticsDate(date: string, days: number): string {
  return new Date(parseAnalyticsDate(date) + days * DAY)
    .toISOString()
    .slice(0, 10);
}
export function analyticsToday(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validateAnalyticsRange(
  start: string,
  end: string,
  today: string,
  historyDays: number,
) {
  const days = (parseAnalyticsDate(end) - parseAnalyticsDate(start)) / DAY + 1;
  if (
    days < 1 ||
    end > today ||
    start < shiftAnalyticsDate(today, 1 - historyDays)
  )
    throw ownerError(
      400,
      "INVALID_ANALYTICS_RANGE",
      "O período precisa estar dentro do histórico do plano e não pode incluir datas futuras.",
    );
  return {
    start,
    end,
    days,
    bucket:
      days === 1 ? "hour" : days <= 60 ? "day" : days <= 180 ? "week" : "month",
  };
}
export function analyticsComparison(
  start: string,
  end: string,
  kind: string,
  customStart?: string,
  customEnd?: string,
) {
  if (kind === "none") return null;
  if (kind === "custom") return { start: customStart!, end: customEnd! };
  if (kind === "previous") {
    const days =
      (parseAnalyticsDate(end) - parseAnalyticsDate(start)) / DAY + 1;
    return {
      start: shiftAnalyticsDate(start, -days),
      end: shiftAnalyticsDate(start, -1),
    };
  }
  const lastYear = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
    return new Date(Date.UTC(year - 1, month - 1, Math.min(day, lastDay)))
      .toISOString()
      .slice(0, 10);
  };
  return { start: lastYear(start), end: lastYear(end) };
}
export function analyticsDelta(current: number, previous: number) {
  return {
    current,
    previous,
    absolute: current - previous,
    percent:
      previous === 0
        ? null
        : Math.round(((current - previous) / previous) * 1000) / 10,
  };
}
