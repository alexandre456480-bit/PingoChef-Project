import type { Response,NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import type { AdminRequest } from '../middleware/admin.middleware';
import { parseMetricsFilter } from './admin-read.controller';
import { z } from 'zod';

export async function getCommercialReport(req:AdminRequest,res:Response,next:NextFunction){
  try{
    const filter=parseMetricsFilter(req.query);
    const {data,error}=await supabaseAdmin.rpc('admin_commercial_report',{
      p_from:filter.from,p_to:filter.to
    });
    if(error)throw error;
    res.json({success:true,data:{filter,...data}});
  }catch(error){next(error);}
}
export async function getInfrastructureReport(req:AdminRequest,res:Response,next:NextFunction){
  try{
    const filter=parseMetricsFilter(req.query);
    const {data,error}=await supabaseAdmin.rpc('admin_infrastructure_report',{
      p_from:filter.from,p_to:filter.to
    });
    if(error)throw error;
    res.json({success:true,data:{filter,...data}});
  }catch(error){next(error);}
}
export async function getPurgeJobs(req:AdminRequest,res:Response,next:NextFunction){
  try{
    const page=z.coerce.number().int().min(1).max(1000).default(1).parse(req.query.page);
    const limit=25;
    const {data,count,error}=await supabaseAdmin.from('account_purge_jobs')
      .select('id,business_id,phase,attempts,last_error_code,started_at,completed_at',
        {count:'exact'}).order('started_at',{ascending:false})
      .range((page-1)*limit,page*limit-1);
    if(error)throw error;
    res.json({success:true,data:data||[],pagination:{page,limit,total:count||0}});
  }catch(error){next(error);}
}
