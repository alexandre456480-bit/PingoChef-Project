import { z } from 'zod';
import { isSafeSocialUrl } from './social-links';

export const disabledOrders = { enabled: false, channel: 'whatsapp' as const, url: '', button_text: 'Fazer pedido' };

export function whatsappNumber(value: string): string | null {
  try {
    const url = new URL(value);
    const number = url.hostname === 'wa.me'
      ? (/^\/([1-9]\d{7,14})\/?$/.exec(url.pathname)?.[1] ?? '')
      : /^(api\.|web\.|www\.)?whatsapp\.com$/.test(url.hostname) && url.pathname === '/send'
        && url.searchParams.getAll('phone').length === 1 ? url.searchParams.get('phone') || '' : '';
    return /^[1-9]\d{7,14}$/.test(number) ? number : null;
  } catch { return null; }
}

export const orderSettingsSchema = z.object({
  enabled: z.boolean(),
  channel: z.enum(['whatsapp', 'ifood', 'website', 'delivery', 'other']),
  url: z.string().trim().max(2048),
  button_text: z.string().trim().min(1).max(40).regex(/^[^<>\x00-\x1f\x7f]+$/),
}).strict().superRefine((settings, ctx) => {
  if (!settings.url && !settings.enabled) return;
  let valid = isSafeSocialUrl(settings.url);
  if (valid && settings.channel === 'whatsapp') valid = !!whatsappNumber(settings.url);
  if (valid && settings.channel === 'ifood') {
    const host = new URL(settings.url).hostname;
    valid = host === 'ifood.com.br' || host.endsWith('.ifood.com.br');
  }
  if (!valid) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['url'], message:
    settings.channel === 'whatsapp' ? 'Use um link do WhatsApp com DDI e número, como https://wa.me/5511999999999.'
      : 'Informe um link HTTPS público válido do canal escolhido, sem usuário ou senha.' });
});

export type OrderSettings = z.infer<typeof orderSettingsSchema>;
export function publicOrderSettings(value: unknown): OrderSettings {
  const parsed = orderSettingsSchema.safeParse(value);
  return parsed.success && parsed.data.enabled ? parsed.data : { ...disabledOrders };
}
