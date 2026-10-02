import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import type { Request, Response } from 'express';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseServiceKey &&
  !supabaseUrl.includes('sua-url-supabase') &&
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('https://')
);

if (!isSupabaseConfigured) {
  console.log('ℹ️ Supabase não configurado ou credenciais ausentes.');
}

// Cliente Admin com Service Role para operações administrativas
export const supabaseAdmin = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseServiceKey : 'dummy-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Use a request-scoped service client only for audited admin RPCs. PostgREST
// exposes these server-supplied headers to the audit trigger in the same SQL
// transaction as the privileged write.
export const createAuditedAdminClient = (req: Request, res: Response) => createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseServiceKey : 'dummy-key',
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: {
      'x-admin-client-ip': req.ip || '',
      'x-admin-request-id': String(res.locals.requestId || '')
    } }
  }
);

// Password sign-in must use an isolated client. Signing in on the shared
// service-role client could replace its Authorization identity in memory.
export const createPasswordAuthClient = () => {
  if (!isSupabaseConfigured || !supabaseAnonKey) throw new Error('Auth client unavailable');
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

// Cliente com contexto do usuário autenticado para respeitar RLS
export const createUserClient = (accessToken: string) => {
  // This client stays server-side. The service key is used only as the API key;
  // the explicit user JWT below remains the Authorization identity, so
  // PostgREST continues to enforce RLS as the authenticated user.
  const key = supabaseServiceKey || 'dummy-key';
  return createClient(
    isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
};
