import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminLogin, adminLogout, adminSession, adminReauthenticate } from '../controllers/admin-auth.controller';
import { changeBusinessLifecycle, createInvitation, revokeInvitation,
  lifecycleAction, grantFreePeriod, cancelBusinessDeletion, revokeCustomerSessions } from '../controllers/admin-operations.controller';
import { getOverview, getDashboard, listBusinesses, getBusiness, listInvitations,
  listAuditLogs, listMedia } from '../controllers/admin-read.controller';
import { requireAdmin, requireAdminOrigin, requireRecentAdmin } from '../middleware/admin.middleware';
import { getCommercialReport, getInfrastructureReport, getPurgeJobs } from '../controllers/admin-phase3-read.controller';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const criticalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
router.post('/auth/login', loginLimiter, requireAdminOrigin, adminLogin);
router.get('/auth/session', requireAdmin, adminSession);
router.post('/auth/logout', requireAdmin, adminLogout);
router.post('/auth/reauthenticate', loginLimiter, requireAdmin, adminReauthenticate);
router.post('/invitations', criticalLimiter, requireAdmin, createInvitation);
router.post('/invitations/:id/revoke', criticalLimiter, requireAdmin, revokeInvitation);
router.patch('/businesses/:id/lifecycle', criticalLimiter, requireAdmin, requireRecentAdmin,
  changeBusinessLifecycle);
router.get('/overview', requireAdmin, getOverview);
router.get('/dashboard', requireAdmin, getDashboard);
router.get('/commercial', requireAdmin, getCommercialReport);
router.get('/infrastructure', requireAdmin, getInfrastructureReport);
router.get('/purge-jobs', requireAdmin, getPurgeJobs);
router.get('/businesses', requireAdmin, listBusinesses);
router.get('/businesses/:id', requireAdmin, getBusiness);
router.get('/media', requireAdmin, listMedia);
router.get('/invites', requireAdmin, listInvitations);
router.post('/invites', criticalLimiter, requireAdmin, createInvitation);
router.post('/invites/:id/revoke', criticalLimiter, requireAdmin, revokeInvitation);
router.post('/businesses/:id/suspend', criticalLimiter, requireAdmin, lifecycleAction('SUSPENDED', 'ACTIVE'));
router.post('/businesses/:id/reactivate', criticalLimiter, requireAdmin, lifecycleAction('ACTIVE', 'SUSPENDED'));
router.post('/businesses/:id/schedule-deletion', criticalLimiter, requireAdmin, requireRecentAdmin,
  lifecycleAction('PENDING_DELETION', 'ACTIVE_OR_SUSPENDED'));
router.post('/businesses/:id/cancel-deletion', criticalLimiter, requireAdmin, requireRecentAdmin,
  cancelBusinessDeletion);
router.post('/businesses/:id/free-period', criticalLimiter, requireAdmin, requireRecentAdmin, grantFreePeriod);
router.post('/businesses/:id/revoke-sessions', criticalLimiter, requireAdmin, requireRecentAdmin,
  revokeCustomerSessions);
router.get('/audit-logs', requireAdmin, listAuditLogs);
export default router;
