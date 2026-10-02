import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../config/supabase';
import { requireInternalJob } from '../middleware/internal-job-auth';
import { runAccountPurgeOnce } from '../services/account-purge.service';

const router=Router();
router.use(rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false}));
router.use(requireInternalJob);
router.post('/billing/maintain',async (_req,res)=>{
  try{
    const {data,error}=await supabaseAdmin.rpc('advance_subscription_lifecycle',{p_limit:100});
    if(error)throw error;
    return res.json({success:true,data:{updated:data||0}});
  }catch{
    return res.status(503).json({success:false,error:{code:'BILLING_MAINTENANCE_UNAVAILABLE'}});
  }
});
router.get('/ready',async (_req,res)=>{
  try{
    const {error}=await supabaseAdmin.from('commercial_settings').select('singleton').limit(1);
    if(error)throw error;
    return res.json({success:true,data:{status:'ready'}});
  }catch{return res.status(503).json({success:false,error:{code:'DEPENDENCY_UNAVAILABLE'}});}
});
router.post('/accounts/purge',async (_req,res)=>{
  try{return res.json({success:true,data:await runAccountPurgeOnce()});}
  catch(error){
    console.error('[Account Purge]',{requestId:res.locals.requestId,
      code:error instanceof Error && /^[A-Z_]{1,60}$/.test(error.message)?error.message:'PURGE_FAILED'});
    return res.status(503).json({success:false,error:{code:'PURGE_RETRY_SCHEDULED'}});
  }
});
export default router;
