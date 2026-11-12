import { resolveFlavor } from './product-flavors';
import { validSocialUrl } from './social-links';
import type { CartItem } from '../services/cart.service';
import type { MenuItem } from '../services/menu.service';

export interface OrderSettings {
  enabled: boolean;
  channel: 'whatsapp' | 'ifood' | 'website' | 'delivery' | 'other';
  url: string;
  button_text: string;
}
export const defaultOrderSettings = (): OrderSettings => ({ enabled: false, channel: 'whatsapp', url: '', button_text: 'Fazer pedido' });
export const formatOrderMoney = (value: number): string => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const ORDER_CHANNELS: { key: OrderSettings['channel']; label: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp' }, { key: 'ifood', label: 'iFood' },
  { key: 'website', label: 'Site próprio' }, { key: 'delivery', label: 'Sistema de delivery' }, { key: 'other', label: 'Outro link' },
];

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

export function orderSettingsError(settings: OrderSettings): string {
  if (!ORDER_CHANNELS.some(channel => channel.key === settings.channel)) return 'Escolha onde o cliente fará o pedido.';
  if (!settings.button_text?.trim() || settings.button_text.length > 40 || /[<>\x00-\x1f\x7f]/.test(settings.button_text))
    return 'Use um texto de botão entre 1 e 40 caracteres, sem marcação HTML.';
  if (!settings.url && !settings.enabled) return '';
  if (!validSocialUrl(settings.channel === 'ifood' ? 'ifood' : 'other', settings.url))
    return 'Informe um link HTTPS público válido do canal escolhido, sem usuário ou senha.';
  if (settings.channel === 'whatsapp' && !whatsappNumber(settings.url))
    return 'Use um link do WhatsApp com DDI e número, como https://wa.me/5511999999999.';
  return '';
}

export function safeOrderSettings(value: unknown): OrderSettings {
  if (!value || typeof value !== 'object') return defaultOrderSettings();
  const settings = value as OrderSettings;
  if (typeof settings.enabled !== 'boolean' || typeof settings.url !== 'string' || typeof settings.button_text !== 'string'
    || orderSettingsError(settings)) return defaultOrderSettings();
  return { enabled: settings.enabled, channel: settings.channel, url: settings.url, button_text: settings.button_text };
}

// Use current catalog names, never persisted cart names, for the outgoing message.
export function orderDestination(settings: OrderSettings, cart: CartItem[], catalog: MenuItem[], businessName: string): string | null {
  if (!settings.enabled || orderSettingsError(settings) || !cart.length) return null;

  const clean = (value: string) => value.replace(/[\x00-\x1f\x7f*_~`]/g, ' ').trim();
  const lines = [`Olá! Gostaria de fazer um pedido em ${clean(businessName)}:`, ''];
  for (const row of cart) {
    const item = catalog.find(item => item.id === row.itemId && item.isAvailable !== false);
    if (!item || !Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.quantity > 9999) return null;
    const flavor = resolveFlavor(item, row.flavorId);
    if (flavor === undefined) return null;
    lines.push(`${row.quantity}x ${clean(item.name)}${flavor ? ' - Sabor: ' + clean(flavor.name) : ''}`);
  }
  if (settings.channel !== 'whatsapp') return settings.url;
  return `https://wa.me/${whatsappNumber(settings.url)}?text=${encodeURIComponent(lines.join('\n'))}`;
}
