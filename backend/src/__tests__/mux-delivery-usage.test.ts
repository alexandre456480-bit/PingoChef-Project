import { syncMuxDeliveryUsage } from '../services/mux-delivery-usage.service';
import { supabaseAdmin } from '../config/supabase';
jest.mock('../config/supabase',()=>({supabaseAdmin:{from:jest.fn()}}));

describe('provider reported usage',()=>{
  it('uses an old complete UTC day and bounded page without confusing estimates or billing',async()=>{
    const listDeliveryUsage=jest.fn().mockResolvedValue([]);
    const result=await syncMuxDeliveryUsage({listDeliveryUsage} as any,'2026-01-01',3);
    expect(listDeliveryUsage).toHaveBeenCalledWith(Date.parse('2026-01-01T00:00:00Z')/1000,Date.parse('2026-01-02T00:00:00Z')/1000,3);
    expect(result).toEqual({day:'2026-01-02',page:1});
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
  it('denies invalid provider values before writing accounting data',async()=>{
    await expect(syncMuxDeliveryUsage({listDeliveryUsage:jest.fn().mockResolvedValue([{assetId:'asset',deliveredSeconds:-1}])} as any,'2026-01-01',1)).rejects.toThrow('INVALID_DELIVERY_USAGE');
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});
