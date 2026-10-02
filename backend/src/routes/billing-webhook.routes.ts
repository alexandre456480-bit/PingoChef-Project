import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { BillingSignatureError, getBillingProvider, processBillingWebhook } from '../services/billing-provider';

const router = Router();
router.post('/:provider',
  rateLimit({ windowMs:15*60*1000, limit:120, standardHeaders:true, legacyHeaders:false }),
  express.raw({type:'application/json',limit:'256kb'}),
  async (req,res) => {
    const provider = getBillingProvider(String(req.params.provider || ''));
    if (!provider) return res.status(503).json({success:false,error:{code:'BILLING_PROVIDER_UNAVAILABLE'}});
    if (!Buffer.isBuffer(req.body))
      return res.status(400).json({success:false,error:{code:'INVALID_WEBHOOK_BODY'}});
    try {
      const outcome = await processBillingWebhook(provider,req.body,req.headers);
      if (outcome==='unmatched')
        return res.status(503).json({success:false,error:{code:'BILLING_SUBSCRIPTION_UNKNOWN'}});
      return res.status(200).json({success:true,data:{status:outcome}});
    } catch (error) {
      // Signature failures and malformed provider events never echo payloads.
      if (error instanceof BillingSignatureError)
        return res.status(401).json({success:false,error:{code:'INVALID_WEBHOOK_SIGNATURE'}});
      console.error('[Billing Webhook]',{requestId:res.locals.requestId,code:'PROCESSING_FAILED'});
      return res.status(503).json({success:false,error:{code:'BILLING_WEBHOOK_FAILED'}});
    }
  });
export default router;
