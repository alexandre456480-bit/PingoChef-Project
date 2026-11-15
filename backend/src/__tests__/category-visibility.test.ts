import { setCategoryVisibilityController } from '../controllers/category.controller';
import { supabaseAdmin } from '../config/supabase';
jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, supabaseAdmin: { from: jest.fn() }, createUserClient: jest.fn() }));
jest.mock('../config/localDb', () => ({ isDemoMode: () => false }));

function harness(data: unknown = { id: 'category', is_active: false }) {
  const query: any = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data, error: null }) };
  (supabaseAdmin.from as jest.Mock).mockReturnValue(query);
  const res: any = { json: jest.fn() }, next = jest.fn();
  return { query, res, next };
}
beforeEach(() => jest.clearAllMocks());
it.each([false, true])('changes only visibility and scopes the write to the session business: %s', async isActive => {
  const {query,res,next} = harness({id:'category',is_active:isActive});
  await setCategoryVisibilityController({ businessId:'tenant',params:{id:'category'},body:{isActive} } as any,res,next);
  expect(next).not.toHaveBeenCalled();
  expect(query.update).toHaveBeenCalledWith({is_active:isActive});
  expect(query.eq.mock.calls).toEqual([['business_id','tenant'],['id','category']]);
  expect(res.json).toHaveBeenCalledWith({success:true,data:{id:'category',isActive}});
});
it('rejects extra fields and non-boolean visibility before any write', async () => {
  for (const body of [{isActive:false,businessId:'other'},{isActive:'false'},{}]) {
    const {query,res,next} = harness();
    await setCategoryVisibilityController({businessId:'tenant',params:{id:'category'},body} as any,res,next);
    expect(next).toHaveBeenCalled();expect(query.update).not.toHaveBeenCalled();
  }
});
it('does not report success for a category outside the session business', async () => {
  const {res,next} = harness(null);
  await setCategoryVisibilityController({businessId:'tenant',params:{id:'foreign'},body:{isActive:false}} as any,res,next);
  expect(res.json).not.toHaveBeenCalled();expect(next.mock.calls[0][0].code).toBe('CATEGORY_NOT_FOUND');
});
