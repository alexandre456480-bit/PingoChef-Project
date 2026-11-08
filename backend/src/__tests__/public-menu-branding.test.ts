import { supabaseAdmin } from '../config/supabase';
import { showPingoChefBranding } from '../services/public-menu-branding.service';
jest.mock('../config/supabase', () => ({ supabaseAdmin: { rpc: jest.fn() } }));
jest.mock('../config/localDb', () => ({ isDemoMode: () => false }));

it.each([false, null, 'true', 1])('retains the brand without a boolean removal entitlement: %j', async data => {
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data, error: null });
  expect(await showPingoChefBranding('tenant')).toBe(true);
});
it('removes branding only through the server-side plan entitlement', async () => {
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: true, error: null });
  expect(await showPingoChefBranding('tenant')).toBe(false);
  expect(supabaseAdmin.rpc).toHaveBeenCalledWith('business_feature_entitlement', {
    p_business_id: 'tenant', p_feature_key: 'REMOVE_PINGOCHEF_BRANDING'
  });
});
it('keeps the menu and brand available when the entitlement lookup fails', async () => {
  (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({ data: true, error: { message: 'unavailable' } });
  expect(await showPingoChefBranding('tenant')).toBe(true);
  (supabaseAdmin.rpc as jest.Mock).mockRejectedValue(new Error('network'));
  expect(await showPingoChefBranding('tenant')).toBe(true);
});
