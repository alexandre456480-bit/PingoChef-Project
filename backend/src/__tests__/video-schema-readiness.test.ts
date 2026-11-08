import { supabaseAdmin } from '../config/supabase';
import { PostgresVideoRateLimiter } from '../services/video-abuse.service';

jest.mock('../config/supabase', () => ({ supabaseAdmin: { rpc: jest.fn() } }));

it('fails closed on the missing video RPC and logs only a fixed diagnostic code', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  try {
    (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({data:null,error:{code:'PGRST202',message:'private database diagnostics'}});
    await expect(new PostgresVideoRateLimiter().consume({})).rejects.toMatchObject({status:503,code:'VIDEO_TEMPORARILY_UNAVAILABLE'});
    expect(log).toHaveBeenCalledWith(expect.stringContaining('VIDEO_SCHEMA_NOT_READY'));
    expect(JSON.stringify(log.mock.calls)).not.toContain('private database diagnostics');
  } finally { log.mockRestore(); }
});
