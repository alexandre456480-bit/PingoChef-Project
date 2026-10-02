import { timingSafeEqual } from 'node:crypto';
import type { Request,Response,NextFunction } from 'express';

export function internalJobAuthorized(header: string | undefined,
  configured: string | undefined): boolean {
  if (!configured || configured.length < 32 || !header?.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  const expected=Buffer.from(configured), supplied=Buffer.from(token);
  return expected.length===supplied.length && timingSafeEqual(expected,supplied);
}
export function requireInternalJob(req:Request,res:Response,next:NextFunction): void {
  if(!internalJobAuthorized(req.get('authorization'),process.env.INTERNAL_JOBS_SECRET)){
    res.status(401).json({success:false,error:{code:'INTERNAL_UNAUTHORIZED'}});return;
  }
  next();
}
