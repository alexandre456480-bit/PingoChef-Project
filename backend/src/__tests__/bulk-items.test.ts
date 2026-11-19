import { deleteItemsController } from '../controllers/bulk-items.controller';
import { supabaseAdmin, createUserClient } from '../config/supabase';
jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, supabaseAdmin: { from: jest.fn() }, createUserClient: jest.fn() }));
jest.mock('../config/localDb', () => ({ isDemoMode: () => false }));
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
function harness(owned: any = { data: ids.map(id => ({ id })), error: null }, result: any = { data: ids.map(id => ({ id })), error: null }) {
  const lookup: any = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue(owned) };
  const deletion: any = { delete: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), select: jest.fn().mockResolvedValue(result) };
  const from = jest.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(deletion);
  (supabaseAdmin.from as jest.Mock).mockImplementation(from);
  (createUserClient as jest.Mock).mockReturnValue({ from });
  return { lookup, deletion, from, res: { json: jest.fn() } as any, next: jest.fn() };
}
beforeEach(() => jest.clearAllMocks());
it('uses the authenticated client and one tenant-scoped DELETE, returning actual deleted IDs', async () => {
  const h = harness();
  await deleteItemsController({ businessId: 'tenant', accessToken: 'session-token', body: { ids } } as any, h.res, h.next);
  expect(h.next).not.toHaveBeenCalled();
  expect(createUserClient).toHaveBeenCalledWith('session-token');
  expect(h.deletion.delete).toHaveBeenCalledTimes(1);
  expect(h.lookup.eq).toHaveBeenCalledWith('business_id', 'tenant');
  expect(h.deletion.eq).toHaveBeenCalledWith('business_id', 'tenant');
  expect(h.deletion.in).toHaveBeenCalledWith('id', ids);
  expect(h.res.json).toHaveBeenCalledWith({ success: true, data: { deletedIds: ids } });
});
it.each([{ ids: [] }, { ids: [ids[0], ids[0]] }, { ids: ['invalid'] }, { ids, businessId: 'other' }, { ids: Array(301).fill(ids[0]) }])('rejects malformed selections without accessing the database: %j', async body => {
  const h = harness();
  await deleteItemsController({ businessId: 'tenant', body } as any, h.res, h.next);
  expect(h.next).toHaveBeenCalled(); expect(h.from).not.toHaveBeenCalled();
});
it('rejects a mixed tenant or stale selection before deleting any owned item', async () => {
  const h = harness({ data: [{ id: ids[0] }], error: null });
  await deleteItemsController({ businessId: 'tenant', body: { ids } } as any, h.res, h.next);
  expect(h.deletion.delete).not.toHaveBeenCalled();
  expect(h.next.mock.calls[0][0].code).toBe('ITEM_SELECTION_CHANGED');
});
it.each(['lookup', 'delete'])('does not report success on a %s database failure', async stage => {
  const h = stage === 'lookup' ? harness({ data: null, error: {} }) : harness(undefined, { data: null, error: {} });
  await deleteItemsController({ businessId: 'tenant', body: { ids } } as any, h.res, h.next);
  expect(h.res.json).not.toHaveBeenCalled(); expect(h.next.mock.calls[0][0].code).toBe('BULK_DELETE_UNAVAILABLE');
});
it('requires an authenticated business before any access', async () => {
  const h = harness();
  await deleteItemsController({ body: { ids } } as any, h.res, h.next);
  expect(h.from).not.toHaveBeenCalled(); expect(h.next.mock.calls[0][0].code).toBe('UNAUTHORIZED');
});
