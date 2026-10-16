// Fixed fields only: no headers, cookies, IPs, provider errors, upload URLs or JWTs.
export function videoAudit(event: string, fields: { businessId?: string; mediaId?: string; code?: string; status?: number } = {}): void {
  console.info(JSON.stringify({ timestamp: new Date().toISOString(), event,
    businessId: fields.businessId, mediaId: fields.mediaId, code: fields.code, status: fields.status }));
}
