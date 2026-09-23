import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { localDb, isDemoMode } from '../config/localDb';

// Schema de Validação de Registro
const registerSchema = z.object({
  email: z.string().email('E-mail em formato inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  fullName: z.string().min(2, 'Nome completo deve ter no mínimo 2 caracteres'),
  businessName: z.string().min(2, 'Nome do restaurante deve ter no mínimo 2 caracteres'),
  slug: z.string().min(3, 'Slug deve ter no mínimo 3 caracteres').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  phone: z.string().optional()
});

// Schema de Validação de Ativação
const activateSchema = z.object({
  token: z.string().min(6, 'Token de ativação é obrigatório')
});

// Schema de Validação de Login
const loginSchema = z.object({
  email: z.string().email('E-mail em formato inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
});

// Helper criptograficamente seguro para gerar Token ACT-XXXX-XXX (CSPRNG)
function generateActivationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(7);
  let part1 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[bytes[i] % chars.length];
  }
  let part2 = '';
  for (let i = 4; i < 7; i++) {
    part2 += chars[bytes[i] % chars.length];
  }
  return `ACT-${part1}-${part2}`;
}

// Helper para hashing HMAC do token de ativação
export function hashActivationToken(token: string): string {
  const secret = process.env.ACTIVATION_TOKEN_SECRET?.trim()
    || (process.env.NODE_ENV === 'test' ? 'test-only-activation-secret' : '');
  if (!secret) {
    const error = new Error('Configuração de ativação indisponível.');
    Object.assign(error, { status: 503, code: 'ACTIVATION_CONFIGURATION_ERROR' });
    throw error;
  }
  return crypto.createHmac('sha256', secret).update(token.trim().toUpperCase()).digest('hex');
}

export const registerController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);

    if (isSupabaseConfigured && !isDemoMode()) {
      try {
        // 1. Verificar se slug já existe
        const { data: existingBiz } = await supabaseAdmin
          .from('businesses')
          .select('id')
          .eq('slug', data.slug)
          .single();

        if (existingBiz) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'SLUG_ALREADY_EXISTS',
              message: 'Este slug/endereço já está em uso por outro estabelecimento.',
              timestamp: new Date().toISOString()
            }
          });
        }

        // 2. Criar usuário no Supabase Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true
        });

        if (authError || !authUser?.user) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'USER_CREATION_FAILED',
              message: authError?.message || 'Falha ao criar conta de usuário.',
              timestamp: new Date().toISOString()
            }
          });
        }

        const userId = authUser.user.id;

        await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            full_name: data.fullName,
            phone: data.phone || null
          });

        const { data: biz, error: bizError } = await supabaseAdmin
          .from('businesses')
          .insert({
            owner_user_id: userId,
            name: data.businessName,
            slug: data.slug,
            phone: data.phone || null,
            whatsapp: data.phone || null,
            status: 'PENDING_ACTIVATION'
          })
          .select('id, slug')
          .single();

        if (bizError || !biz) {
          return res.status(500).json({
            success: false,
            error: {
              code: 'BUSINESS_CREATION_FAILED',
              message: 'Falha ao registrar estabelecimento.',
              timestamp: new Date().toISOString()
            }
          });
        }

        const rawToken = generateActivationToken();
        const tokenHash = hashActivationToken(rawToken);

        await supabaseAdmin
          .from('activation_tokens')
          .insert({
            token: tokenHash,
            business_id: biz.id,
            expires_at: new Date(Date.now() + 86400000).toISOString()
          });

        return res.status(201).json({
          success: true,
          data: {
            userId,
            businessId: biz.id,
            slug: biz.slug,
            activationToken: rawToken,
            requiresActivation: true,
            message: 'Cadastro realizado com sucesso! Utilize o token de ativação para liberar seu acesso.'
          }
        });

      } catch (sbErr) {
        console.error('[Auth Audit]', { event: 'supabase_register_failed' });
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Modo local / demonstração explícito
    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Banco de dados principal não está configurado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const existingLocalBiz = localDb.businesses.find(b => b.slug === data.slug);
    if (existingLocalBiz) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'SLUG_ALREADY_EXISTS',
          message: 'Este slug/endereço já está em uso por outro estabelecimento.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const userId = `usr_${Date.now()}`;
    const bizId = `biz_${Date.now()}`;
    const rawToken = generateActivationToken();
    const tokenHash = hashActivationToken(rawToken);

    localDb.users.push({
      id: userId,
      email: data.email,
      passwordHash: localDb.hashPassword(data.password),
      fullName: data.fullName
    });

    localDb.businesses.push({
      id: bizId,
      owner_user_id: userId,
      name: data.businessName,
      slug: data.slug,
      status: 'PENDING_ACTIVATION',
      phone: data.phone || null,
      whatsapp: data.phone || null
    });

    localDb.activationTokens.push({
      id: `tok_${Date.now()}`,
      tokenHash,
      business_id: bizId,
      is_used: false,
      expires_at: new Date(Date.now() + 86400000).toISOString()
    });

    return res.status(201).json({
      success: true,
      data: {
        userId,
        businessId: bizId,
        slug: data.slug,
        activationToken: rawToken,
        requiresActivation: true,
        message: 'Cadastro realizado com sucesso! Utilize o token de ativação para liberar seu acesso.'
      }
    });

  } catch (error: any) {
    next(error);
  }
};

export const activateController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = activateSchema.parse(req.body);
    const cleanToken = token.trim().toUpperCase();
    const tokenHash = hashActivationToken(cleanToken);

    if (isSupabaseConfigured && !isDemoMode()) {
      try {
        // Atualização atômica contra race conditions: tenta pelo hash HMAC primeiro
        let updateResult = await supabaseAdmin
          .from('activation_tokens')
          .update({ is_used: true, used_at: new Date().toISOString() })
          .eq('token', tokenHash)
          .eq('is_used', false)
          .gt('expires_at', new Date().toISOString())
          .select('business_id')
          .maybeSingle();

        // Compatibilidade temporária: se não encontrou pelo hash, tentar pelo token em texto puro (legado)
        if (!updateResult.data) {
          updateResult = await supabaseAdmin
            .from('activation_tokens')
            .update({ is_used: true, used_at: new Date().toISOString() })
            .eq('token', cleanToken)
            .eq('is_used', false)
            .gt('expires_at', new Date().toISOString())
            .select('business_id')
            .maybeSingle();
        }

        if (updateResult.data) {
          const businessId = updateResult.data.business_id;

          await supabaseAdmin
            .from('businesses')
            .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
            .eq('id', businessId);

          return res.status(200).json({
            success: true,
            data: {
              businessId,
              status: 'ACTIVE',
              activatedAt: new Date().toISOString(),
              message: 'Conta ativada com sucesso! Você já pode acessar seu painel.'
            }
          });
        }

        // Se o update atômico não modificou nenhuma linha, investigar o motivo exato
        const { data: existingCheck } = await supabaseAdmin
          .from('activation_tokens')
          .select('is_used, expires_at')
          .or(`token.eq.${tokenHash},token.eq.${cleanToken}`)
          .maybeSingle();

        if (existingCheck) {
          if (existingCheck.is_used) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'TOKEN_ALREADY_USED',
                message: 'Este token de ativação já foi utilizado anteriormente.',
                timestamp: new Date().toISOString()
              }
            });
          }
          if (new Date(existingCheck.expires_at) < new Date()) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'TOKEN_EXPIRED',
                message: 'Este token de ativação expirou. Solicite um novo cadastro.',
                timestamp: new Date().toISOString()
              }
            });
          }
        }

        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token de ativação inválido ou não encontrado.',
            timestamp: new Date().toISOString()
          }
        });

      } catch (sbErr) {
        console.error('[Auth Audit]', { event: 'supabase_activation_failed' });
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Serviço temporariamente indisponível. Tente novamente mais tarde.',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Modo local / demo
    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Banco de dados principal não está configurado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Local DB check (tenta hash primeiro, depois compatibilidade legado)
    const localTok = localDb.activationTokens.find(
      t => t.tokenHash === tokenHash || t.tokenHash === cleanToken
    );

    if (!localTok) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token de ativação inválido ou não encontrado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (localTok.is_used) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_ALREADY_USED',
          message: 'Este token de ativação já foi utilizado anteriormente.',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (new Date(localTok.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Este token de ativação expirou.',
          timestamp: new Date().toISOString()
        }
      });
    }

    localTok.is_used = true;
    const biz = localDb.businesses.find(b => b.id === localTok.business_id);
    if (biz) {
      biz.status = 'ACTIVE';
    }

    return res.status(200).json({
      success: true,
      data: {
        businessId: localTok.business_id,
        status: 'ACTIVE',
        activatedAt: new Date().toISOString(),
        message: 'Conta ativada com sucesso! Você já pode acessar seu painel.'
      }
    });

  } catch (error: any) {
    next(error);
  }
};

export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    if (isSupabaseConfigured && !isDemoMode()) {
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
          email,
          password
        });

        if (authError || !authData?.session) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'E-mail ou senha incorretos.',
              timestamp: new Date().toISOString()
            }
          });
        }

        const { data: biz } = await supabaseAdmin
          .from('businesses')
          .select('id, name, slug, status, logo_url')
          .eq('owner_user_id', authData.user.id)
          .maybeSingle();

        return res.status(200).json({
          success: true,
          data: {
            accessToken: authData.session.access_token,
            refreshToken: authData.session.refresh_token,
            user: {
              id: authData.user.id,
              email: authData.user.email
            },
            business: biz || null
          }
        });
      } catch (sbErr) {
        console.error('[Auth Audit]', { event: 'supabase_login_failed' });
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Serviço de autenticação indisponível. Tente novamente mais tarde.',
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    // Modo local / demo explícito
    if (!isDemoMode()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Banco de dados principal não está configurado.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const localUser = localDb.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!localUser || !localDb.verifyPassword(password, localUser.passwordHash)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'E-mail ou senha incorretos.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const localBiz = localDb.businesses.find(b => b.owner_user_id === localUser.id);
    if (!localBiz) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: 'Nenhum estabelecimento associado a este usuário.',
          timestamp: new Date().toISOString()
        }
      });
    }

    const mockToken = `local_jwt_${localUser.id}_${Date.now()}`;

    return res.status(200).json({
      success: true,
      data: {
        accessToken: mockToken,
        refreshToken: `refresh_${mockToken}`,
        user: {
          id: localUser.id,
          email: localUser.email,
          fullName: localUser.fullName
        },
        business: localBiz
      }
    });

  } catch (error: any) {
    next(error);
  }
};
