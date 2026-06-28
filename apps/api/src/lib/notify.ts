/**
 * Notificaciones de venta. Cada canal se activa solo si su credencial está
 * configurada (como secret/var). Si falta, ese canal se omite sin romper nada.
 */

interface NotifyEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  RESEND_API_KEY?: string;
  ADMIN_NOTIFY_EMAIL?: string;
  ADMIN_EMAIL?: string;
}

interface OrderLike {
  id: number;
  total: number;
  moneda: string;
  compradorNombre: string | null;
  compradorTelefono: string | null;
  direccionEnvio: string | null;
  ciudad: string | null;
  notasEnvio: string | null;
}
interface ItemLike {
  titulo: string;
  cantidad: number;
}

function armarTexto(order: OrderLike, items: ItemLike[]): string {
  const libros = items.map((i) => `• ${i.titulo}${i.cantidad > 1 ? ` x${i.cantidad}` : ''}`).join('\n');
  return (
    `🔔 NUEVA VENTA — Pedido #${order.id}\n\n` +
    `💰 Total: ${order.moneda} ${order.total}\n` +
    `👤 Comprador: ${order.compradorNombre ?? '—'}\n` +
    `📞 Teléfono: ${order.compradorTelefono ?? '—'}\n` +
    `📍 Dirección: ${order.direccionEnvio ?? '—'}${order.ciudad ? `, ${order.ciudad}` : ''}\n` +
    (order.notasEnvio ? `📝 Nota: ${order.notasEnvio}\n` : '') +
    `\n📚 Libros:\n${libros}`
  );
}

async function sendTelegram(env: NotifyEnv, texto: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: texto }),
  });
}

async function sendEmail(env: NotifyEnv, asunto: string, texto: string): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const to = env.ADMIN_NOTIFY_EMAIL ?? env.ADMIN_EMAIL;
  if (!to) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Biblioteca Cordillera <onboarding@resend.dev>',
      to,
      subject: asunto,
      text: texto,
    }),
  });
}

/** Envía la notificación de venta por todos los canales configurados. */
export async function notifySale(env: NotifyEnv, order: OrderLike, items: ItemLike[]): Promise<void> {
  const texto = armarTexto(order, items);
  await Promise.allSettled([
    sendTelegram(env, texto),
    sendEmail(env, `Nueva venta #${order.id} — ${order.moneda} ${order.total}`, texto),
  ]);
}

/** Aviso genérico al admin (p. ej. un nuevo reclamo). */
export async function notifyAdmin(env: NotifyEnv, asunto: string, texto: string): Promise<void> {
  await Promise.allSettled([sendTelegram(env, texto), sendEmail(env, asunto, texto)]);
}
