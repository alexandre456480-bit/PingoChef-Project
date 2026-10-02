import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';
import { businessEligibility } from '../services/business-eligibility.service';
import { resolveOwnerSession, ownerError } from '../services/owner-session.service';
import { enforceSharedRequest } from './shared-rate-limit.middleware';

export interface AuthenticatedRequest extends Request { userId?: string; businessId?: string; accessToken?: string }

// The name is retained for existing routers; production authenticates an opaque cookie.
export const authenticateJwt = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const demoBearer = req.get('authorization')?.match(/^Bearer (local_jwt_.+)$/)?.[1];
    let userId: string;
    let accessToken: string;
    if (demoBearer && isDemoMode()) {
      const userParts = demoBearer.split('_').slice(2);
      if (/^\d{10,}$/.test(userParts[userParts.length - 1])) userParts.pop();
      const demo = localDb.users.find(row => row.id === userParts.join('_'));
      if (!demo) throw ownerError(401, 'INVALID_TOKEN');
      userId = demo.id; accessToken = demoBearer;
    } else {
      if (demoBearer) throw ownerError(401, 'INVALID_TOKEN');
      const session = await resolveOwnerSession(req);
      userId = session.user.id; accessToken = session.tokens.accessToken;
    }
    let businessId: string | undefined;
    if (isDemoMode()) businessId = localDb.businesses.find(row => row.owner_user_id === userId)?.id;
    else {
      const { data, error } = await supabaseAdmin.from('businesses').select('id').eq('owner_user_id', userId).maybeSingle();
      if (error) throw ownerError(503, 'AUTH_SERVICE_UNAVAILABLE');
      businessId = data?.id;
    }
    if (!businessId) throw ownerError(403, 'BUSINESS_NOT_FOUND');
    if (!await businessEligibility.isAccountActive(businessId)) throw ownerError(403, 'ACCOUNT_NOT_ACTIVE');
    req.userId = userId; req.businessId = businessId; req.accessToken = accessToken;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      await enforceSharedRequest('owner-write', `business:${businessId}`, 120, 900);
      await enforceSharedRequest('owner-write-ip', `ip:${req.ip || 'unknown'}`, 240, 900);
    }
    res.setHeader('Cache-Control', 'no-store');
    return next();
  } catch (error) { next(error); }
};
