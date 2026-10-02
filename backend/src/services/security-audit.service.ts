// Fixed metadata only. Never pass request bodies, headers, URL queries or Error objects here.
export function securityAudit(
  level: "warn" | "error",
  fields: {
    event: string;
    requestId?: string;
    code?: string;
    status?: number;
    method?: string;
    routeGroup?: string;
  },
): void {
  const { event, requestId, code, status, method, routeGroup } = fields;
  console[level](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      requestId,
      code,
      status,
      method,
      routeGroup,
    }),
  );
}
