import { supabaseAdmin } from '../config/supabase';
import { publicTemplateKey } from '../services/template-entitlement.service';
import { THEMATIC_TEMPLATE_KEYS } from '../constants/menu-template';
jest.mock('../config/supabase', () => ({ isSupabaseConfigured: true, supabaseAdmin: { rpc: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());
it.each(['default', 'immersive-cover', 'liquid-glass', 'double-showcase'])('keeps simple template %s without another query', async key => {
  expect(await publicTemplateKey('tenant', key)).toBe(key);
  expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
});
it.each(THEMATIC_TEMPLATE_KEYS)('requires the server entitlement for public theme %s', async key => {
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });
  expect(await publicTemplateKey('tenant', key)).toBe('default');
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
  expect(await publicTemplateKey('tenant', key)).toBe(key);
  expect(supabaseAdmin.rpc).toHaveBeenLastCalledWith('business_feature_entitlement', {
    p_business_id: 'tenant', p_feature_key: 'THEMATIC_TEMPLATES'
  });
});
it.each([{ data: null, error: null }, { data: true, error: { message: 'unavailable' } }, { data: 'true', error: null }])('fails closed without hiding the menu: %j', async result => {
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue(result);
  expect(await publicTemplateKey('tenant', 'royal-palace')).toBe('default');
});
