import { createHmac } from 'node:crypto';

export function hashInvitationCode(code: string): string {
  const secret = process.env.INVITATION_HASH_SECRET?.trim();
  if (!secret || secret.length < 32) throw Object.assign(new Error('Configuração de convites indisponível.'), {
    status: 503, code: 'INVITATION_CONFIGURATION_ERROR'
  });
  return createHmac('sha256', secret).update(code.trim()).digest('hex');
}
