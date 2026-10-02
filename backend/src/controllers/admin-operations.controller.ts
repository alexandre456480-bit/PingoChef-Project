import { randomBytes } from 'node:crypto';
import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import { createAuditedAdminClient } from '../config/supabase';
import { hashInvitationCode } from './invitation-registration.controller';
import type { AdminRequest } from '../middleware/admin.middleware';

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  expiresInDays: z.number().int().min(1).max(30).default(7)
}).strict();
const lifecycleSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION']),
  reason: z.string().trim().max(500).optional(),
  confirmBusinessId: z.string().uuid().optional(),
  retentionDays: z.number().int().min(1).max(365).default(30)
}).strict();
const uuid = z.string().uuid();

export async function createInvitation(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const { email, expiresInDays } = inviteSchema.parse(req.body);
    const code = `PC-${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
    const { data: id, error } = await createAuditedAdminClient(req, res).rpc('create_customer_invitation', {
      p_actor: req.adminUserId!, p_email: email.toLowerCase(),
      p_code_hash: hashInvitationCode(code), p_expires_at: expiresAt
    });
    if (error || !id) throw error || new Error('Invitation creation failed');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ success: true, data: { id, email: email.toLowerCase(), code, expiresAt } });
  } catch (error) { next(error); }
}

export async function revokeInvitation(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const id = uuid.parse(req.params.id);
    const { data, error } = await createAuditedAdminClient(req, res).rpc('revoke_customer_invitation', {
      p_actor: req.adminUserId!, p_invitation_id: id
    });
    if (error) throw error;
    return data ? res.status(204).send()
      : res.status(404).json({ success: false, error: { code: 'INVITATION_NOT_FOUND' } });
  } catch (error) { next(error); }
}

export async function changeBusinessLifecycle(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const businessId = uuid.parse(req.params.id);
    const body = lifecycleSchema.parse(req.body);
    if (body.status === 'SUSPENDED' && !body.reason) {
      return res.status(400).json({ success: false, error: { code: 'SUSPENSION_REASON_REQUIRED' } });
    }
    if (body.status === 'PENDING_DELETION' && body.confirmBusinessId !== businessId) {
      return res.status(400).json({ success: false, error: { code: 'DELETION_CONFIRMATION_REQUIRED' } });
    }
    const rpc = req.adminExpectedLifecycle ? 'admin_transition_business' : 'set_business_lifecycle';
    const { data, error } = await createAuditedAdminClient(req, res).rpc(rpc, {
      p_actor: req.adminUserId!, p_business_id: businessId,
      p_next_status: body.status, p_reason: body.reason || null,
      p_retention_days: body.retentionDays,
      ...(req.adminExpectedLifecycle ? { p_expected_status: req.adminExpectedLifecycle } : {})
    });
    if (error) {
      if (String(error.message).includes('Legacy business requires migration')) {
        return res.status(409).json({ success: false, error: { code: 'LEGACY_ACCOUNT_REVIEW_REQUIRED' } });
      }
      if (String(error.message).includes('Invalid lifecycle transition')) {
        return res.status(409).json({ success: false, error: { code: 'INVALID_LIFECYCLE_TRANSITION' } });
      }
      throw error;
    }
    return data ? res.status(200).json({ success: true, data: { businessId, status: body.status } })
      : res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND' } });
  } catch (error) { next(error); }
}

export function lifecycleAction(status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION',
  expected: 'ACTIVE' | 'SUSPENDED' | 'ACTIVE_OR_SUSPENDED') {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    req.body = { ...req.body, status };
    req.adminExpectedLifecycle = expected;
    return changeBusinessLifecycle(req, res, next);
  };
}

export async function cancelBusinessDeletion(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const businessId = uuid.parse(req.params.id);
    z.object({}).strict().parse(req.body);
    const { data: status, error } = await createAuditedAdminClient(req, res).rpc('admin_cancel_business_deletion', {
      p_actor: req.adminUserId!, p_business_id: businessId
    });
    if (error) {
      if (String(error.message).includes('Invalid lifecycle transition'))
        return res.status(409).json({ success: false, error: { code: 'INVALID_LIFECYCLE_TRANSITION' } });
      throw error;
    }
    return status ? res.json({ success: true, data: { businessId, status } })
      : res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND' } });
  } catch (error) { next(error); }
}

const freePeriodSchema = z.object({
  days: z.number().int().min(1).max(365),
  reason: z.string().trim().min(3).max(500)
}).strict();

export async function grantFreePeriod(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const businessId = uuid.parse(req.params.id);
    const { days, reason } = freePeriodSchema.parse(req.body);
    const requestId = String(res.locals.requestId || '');
    const { data: id, error } = await createAuditedAdminClient(req, res).rpc('grant_free_days', {
      p_actor: req.adminUserId!, p_business_id: businessId, p_days: days,
      p_reason: reason, p_ip: req.ip || null,
      p_user_agent: null,
      p_request_id: uuid.safeParse(requestId).success ? requestId : null
    });
    if (error) throw error;
    return id ? res.status(201).json({ success: true, data: { id, businessId, days } })
      : res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND' } });
  } catch (error) { next(error); }
}

export async function revokeCustomerSessions(req: AdminRequest, res: Response, next: NextFunction) {
  try {
    const businessId = uuid.parse(req.params.id);
    const body = z.object({ confirmBusinessId: uuid }).strict().parse(req.body);
    if (body.confirmBusinessId !== businessId)
      return res.status(400).json({ success: false, error: { code: 'CONFIRMATION_REQUIRED' } });
    const { data, error } = await createAuditedAdminClient(req, res).rpc('admin_revoke_customer_sessions', {
      p_actor: req.adminUserId!, p_business_id: businessId
    });
    if (error) throw error;
    return data ? res.status(204).send()
      : res.status(404).json({ success: false, error: { code: 'BUSINESS_NOT_FOUND' } });
  } catch (error) { next(error); }
}
