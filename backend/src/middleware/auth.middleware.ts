import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  businessId?: string;
  accessToken?: string;
}

export const authenticateJwt = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token de autenticação não fornecido ou inválido.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token de autenticação ausente.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Tokens locais existem exclusivamente no modo demo. Nunca podem assumir
    // um tenant real por conveniência de desenvolvimento ou staging.
    if (token.startsWith('local_jwt_')) {
      if (!isDemoMode()) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Tokens de demonstração não são permitidos neste ambiente.',
            timestamp: new Date().toISOString()
          }
        });
      }

      const parts = token.split('_');
      // local_jwt_usr_alexandre_01_1789572765885 -> remove 'local','jwt' do início e timestamp do final
      // O último segmento é sempre o timestamp numérico adicionado pelo loginController
      const userParts = parts.slice(2); // remove 'local' e 'jwt'
      // Se o último segmento é numérico (timestamp), remover
      if (userParts.length > 0 && /^\d{10,}$/.test(userParts[userParts.length - 1])) {
        userParts.pop();
      }
      const userId = userParts.join('_');
      const user = localDb.users.find(u => u.id === userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Usuário do token local não encontrado.',
            timestamp: new Date().toISOString()
          }
        });
      }

      const biz = localDb.businesses.find(b => b.owner_user_id === user.id);
      if (!biz) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'BUSINESS_NOT_FOUND',
            message: 'Nenhum estabelecimento associado a este usuário.',
            timestamp: new Date().toISOString()
          }
        });
      }

      if (biz.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_ACTIVE',
            message: 'Seu estabelecimento ainda não foi ativado ou está suspenso.',
            timestamp: new Date().toISOString()
          }
        });
      }

      req.userId = user.id;
      req.businessId = biz.id;
      req.accessToken = token;
      return next();
    }

    // Verificar Token com Supabase Auth
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Sessão inválida ou expirada. Faça login novamente.',
            timestamp: new Date().toISOString()
          }
        });
      }

      const { data: biz, error: bizError } = await supabaseAdmin
        .from('businesses')
        .select('id, status')
        .eq('owner_user_id', user.id)
        .single();

      if (bizError || !biz) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'BUSINESS_NOT_FOUND',
            message: 'Nenhum estabelecimento vinculado a esta conta.',
            timestamp: new Date().toISOString()
          }
        });
      }

      if (biz.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_ACTIVE',
            message: 'Seu estabelecimento ainda não foi ativado ou está suspenso.',
            timestamp: new Date().toISOString()
          }
        });
      }

      req.userId = user.id;
      req.businessId = biz.id;
      req.accessToken = token;
      return next();
    } catch (authErr) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Falha na validação da sessão.',
          timestamp: new Date().toISOString()
        }
      });
    }
  } catch (error: any) {
    next(error);
  }
};
