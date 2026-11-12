import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { authenticateJwt, AuthenticatedRequest } from '../middleware/auth.middleware';
import { sharedRateLimit } from '../middleware/shared-rate-limit.middleware';
import { ownerError } from '../services/owner-session.service';
import { entitlements } from '../services/entitlement.service';
import { validateMenuArchive, remapMenuArchive, TRANSFER_MAX_BYTES, TRANSFER_CHUNK_CHARS, TRANSFER_MAX_PARTS } from '../services/menu-transfer.schema';

const router = Router();
router.use(authenticateJwt as any);
const errors: Record<string, [number, string]> = {
  TRANSFER_NOT_FOUND: [404, 'Esta transferência expirou. Selecione o arquivo novamente.'],
  TRANSFER_INCOMPLETE: [409, 'O envio do arquivo ainda não terminou.'],
  TRANSFER_LIMIT: [429, 'Há transferências em andamento. Finalize ou cancele antes de iniciar outra.'],
  MENU_ARCHIVE_TOO_LARGE: [413, 'O arquivo ultrapassa o limite de 32 MB.'],
  MENU_HAS_MEDIA: [409, 'Este cardápio possui mídias de produtos. Importe apenas a personalização para preservá-las.'],
  IMPORT_PLAN_LIMIT: [409, 'A quantidade de produtos ou categorias do arquivo ultrapassa seu plano.'],
  INVALID_TRANSFER: [400, 'A transferência é inválida. Selecione o arquivo novamente.']
};
function databaseError(error: any): never {
  const known = errors[error.message];
  if (known) throw ownerError(known[0], error.message, known[1]);
  // Do not send database details or archive contents to the browser/logs.
  throw ownerError(503, 'MENU_TRANSFER_UNAVAILABLE', 'Não foi possível transferir o cardápio. Tente novamente.');
}
const handle = (handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!isSupabaseConfigured) throw ownerError(503, 'MENU_TRANSFER_UNAVAILABLE');
      res.setHeader('Cache-Control', 'no-store');
      await handler(req, res);
    } catch (error) { next(error); }
  };
function identifiers(req: AuthenticatedRequest) {
  return { p_business_id: req.businessId!, p_owner_id: req.userId!, p_id: z.string().uuid().parse(req.params.id) };
}
async function transfer(req: AuthenticatedRequest) {
  const ids = identifiers(req);
  const { data, error } = await supabaseAdmin.from('menu_transfers').select('parts,expected_parts,completed,summary')
    .eq('id', ids.p_id).eq('business_id', ids.p_business_id).eq('owner_id', ids.p_owner_id).eq('kind', 'import')
    .gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw ownerError(404, 'TRANSFER_NOT_FOUND', errors.TRANSFER_NOT_FOUND[1]);
  return data;
}
function document(parts: string[], expected: number) {
  if (parts.length !== expected) throw ownerError(409, 'TRANSFER_INCOMPLETE');
  const text = parts.join('');
  if (Buffer.byteLength(text) > TRANSFER_MAX_BYTES) throw ownerError(413, 'MENU_ARCHIVE_TOO_LARGE');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw ownerError(400, 'INVALID_MENU_ARCHIVE', 'O arquivo não contém um cardápio JSON válido.'); }
  return validateMenuArchive(parsed);
}
router.post('/', sharedRateLimit('menu-transfer-start', 12, 3600, req => `business:${(req as AuthenticatedRequest).businessId}`), handle(async (req, res) => {
  const data = z.object({ kind: z.enum(['import', 'export']), parts: z.number().int().min(1).max(TRANSFER_MAX_PARTS).default(1) }).strict().parse(req.body);
  const result = await supabaseAdmin.rpc('menu_transfer_start_with_flavors', { p_business_id: req.businessId, p_owner_id: req.userId, p_kind: data.kind, p_parts: data.parts });
  if (result.error) databaseError(result.error);
  res.json({ success: true, data: result.data });
}));
router.get('/:id/parts/:index', handle(async (req, res) => {
  const result = await supabaseAdmin.rpc('menu_transfer_chunk', { ...identifiers(req), p_index: z.coerce.number().int().min(0).max(TRANSFER_MAX_PARTS - 1).parse(req.params.index) });
  if (result.error) databaseError(result.error);
  res.json({ success: true, data: result.data });
}));
router.put('/:id/parts/:index', handle(async (req, res) => {
  const body = z.object({ content: z.string().min(1).max(TRANSFER_CHUNK_CHARS) }).strict().parse(req.body);
  const result = await supabaseAdmin.rpc('menu_transfer_chunk', { ...identifiers(req), p_content: body.content,
    p_index: z.coerce.number().int().min(0).max(TRANSFER_MAX_PARTS - 1).parse(req.params.index) });
  if (result.error) databaseError(result.error);
  res.json({ success: true });
}));
router.post('/:id/preview', handle(async (req, res) => {
  z.object({}).strict().parse(req.body);
  const stage = await transfer(req);
  const doc = document(stage.parts, stage.expected_parts);
  const snapshot = await entitlements.getEntitlements(req.businessId!);
  const { count: mediaCount, error } = await supabaseAdmin.from('product_media').select('id', { head: true, count: 'exact' }).eq('business_id', req.businessId!);
  if (error) databaseError(error);
  res.json({ success: true, data: {
    name: doc.business.name, template: doc.design?.template_key ?? 'default', categories: doc.categories.length,
    subcategories: doc.subcategories.length, items: doc.items.length, excludedVideos: doc.excludedVideos,
    canReplaceCatalog: !mediaCount && doc.categories.length <= Number(snapshot.entitlements.MAX_CATEGORIES ?? 0)
      && doc.items.length <= Number(snapshot.entitlements.MAX_PRODUCTS ?? 0),
    blockedReason: mediaCount ? errors.MENU_HAS_MEDIA[1] : errors.IMPORT_PLAN_LIMIT[1]
  } });
}));
router.post('/:id/apply', handle(async (req, res) => {
  const { catalog, confirmed } = z.object({ catalog: z.boolean(), confirmed: z.literal(true) }).strict().parse(req.body);
  const stage = await transfer(req);
  if (stage.completed) { res.json({ success: true, data: stage.summary }); return; }
  const doc = remapMenuArchive(document(stage.parts, stage.expected_parts));
  const result = await supabaseAdmin.rpc('menu_transfer_apply_with_flavors', { ...identifiers(req), p_document: doc, p_catalog: catalog });
  if (result.error) databaseError(result.error);
  res.json({ success: true, data: result.data });
}));
router.delete('/:id', handle(async (req, res) => {
  const ids = identifiers(req);
  const { error } = await supabaseAdmin.from('menu_transfers').delete().eq('id', ids.p_id).eq('business_id', ids.p_business_id).eq('owner_id', ids.p_owner_id);
  if (error) databaseError(error);
  res.json({ success: true });
}));
export default router;
