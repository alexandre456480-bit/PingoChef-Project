import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { isSupabaseConfigured, supabaseAdmin } from '../config/supabase';
import { isDemoMode } from '../config/localDb';
import { ownerError } from '../services/owner-session.service';

const steps = ['welcome', 'home', 'company-nav', 'company', 'company-save', 'categories',
  'subcategories', 'products', 'videos', 'design-nav', 'design', 'design-save', 'preview',
  'resources', 'publish', 'link', 'qr', 'analytics', 'finish'] as const;
const command = z.object({
  action: z.enum(['start', 'restart', 'progress', 'complete', 'skip']),
  step: z.enum(steps), version: z.literal(1),
}).strict();
interface Progress {
  tutorial_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  tutorial_version: number; tutorial_step: string;
  tutorial_started_at: string | null; tutorial_finished_at: string | null;
}
const initial = (): Progress => ({ tutorial_status: 'NOT_STARTED', tutorial_version: 1,
  tutorial_step: 'welcome', tutorial_started_at: null, tutorial_finished_at: null });
const columns = 'tutorial_status,tutorial_version,tutorial_step,tutorial_started_at,tutorial_finished_at';
// Explicit local demo mode only. Production always uses the durable profile.
const demo = new Map<string, Progress>();
async function read(userId: string): Promise<Progress> {
  if (isDemoMode()) return demo.get(userId) ?? initial();
  if (!isSupabaseConfigured) throw ownerError(503, 'TUTORIAL_UNAVAILABLE');
  const { data, error } = await supabaseAdmin.from('profiles').select(columns).eq('id', userId).maybeSingle();
  if (error || !data) throw ownerError(503, 'TUTORIAL_UNAVAILABLE');
  return data as Progress;
}
function identity(req: AuthenticatedRequest): string {
  if (!req.userId || !req.businessId) throw ownerError(401, 'UNAUTHORIZED');
  return req.userId;
}
export async function getTutorial(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: await read(identity(req)) });
  } catch (error) { return next(error); }
}
export async function updateTutorial(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = identity(req);
    const input = command.parse(req.body);
    const current = await read(userId);
    const terminal = ['COMPLETED', 'SKIPPED'].includes(current.tutorial_status);
    // Delayed writes from another tab must not revive a finished guide.
    if (terminal && input.action !== 'restart') return res.json({ success: true, data: current });
    if (!['start', 'restart'].includes(input.action) && current.tutorial_status !== 'IN_PROGRESS')
      throw ownerError(409, 'TUTORIAL_NOT_STARTED');
    if (input.action === 'complete' && input.step !== 'finish')
      throw ownerError(400, 'TUTORIAL_INVALID_FINISH');
    const restarting = input.action === 'restart';
    const status = input.action === 'complete' ? 'COMPLETED' : input.action === 'skip' ? 'SKIPPED' : 'IN_PROGRESS';
    const progress: Progress = {
      tutorial_status: status, tutorial_version: input.version,
      tutorial_step: restarting ? 'welcome' : input.action === 'start' ? current.tutorial_step : input.step,
      tutorial_started_at: restarting ? new Date().toISOString() : current.tutorial_started_at ?? new Date().toISOString(),
      tutorial_finished_at: ['COMPLETED', 'SKIPPED'].includes(status) ? new Date().toISOString() : null,
    };
    if (isDemoMode()) demo.set(userId, progress);
    else {
      const { data, error } = await supabaseAdmin.from('profiles').update(progress)
        .eq('id', userId).eq('tutorial_status', current.tutorial_status).select(columns).maybeSingle();
      if (error) throw ownerError(503, 'TUTORIAL_UNAVAILABLE');
      if (!data) return res.json({ success: true, data: await read(userId) });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, data: progress });
  } catch (error) { return next(error); }
}
