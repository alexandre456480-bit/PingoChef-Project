import type { RequestHandler } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase';
import { ownerError } from '../services/owner-session.service';

const suggestion = z.object({
  message: z.string().trim().min(1).max(1000).refine(message => !message.includes('\0')),
}).strict();
const pagination = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).strict();
const pageSize = 25;

export const submitAppSuggestion: RequestHandler = async (req, res, next) => {
  try {
    const body = suggestion.safeParse(req.body);
    if (!req.is('application/json') || !body.success) {
      throw ownerError(400, 'INVALID_SUGGESTION', 'Digite uma sugestão de até 1.000 caracteres.');
    }
    // Authenticate the sender at the route, but persist no association with the session.
    const { error } = await supabaseAdmin.from('app_suggestions').insert({ message: body.data.message });
    if (error) throw ownerError(503, 'SUGGESTIONS_UNAVAILABLE');
    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const listAppSuggestions: RequestHandler = async (req, res, next) => {
  try {
    const { page } = pagination.parse(req.query);
    const start = (page - 1) * pageSize;
    const { data, count, error } = await supabaseAdmin.from('app_suggestions')
      .select('id,message,created_on', { count: 'exact' })
      .order('created_on', { ascending: false })
      .order('id', { ascending: false })
      .range(start, start + pageSize - 1);
    if (error) throw ownerError(503, 'SUGGESTIONS_UNAVAILABLE');
    res.json({ success: true, data, pagination: { page, limit: pageSize, total: count ?? 0 } });
  } catch (error) {
    next(error);
  }
};
