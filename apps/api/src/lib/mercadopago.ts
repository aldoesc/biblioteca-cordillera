/**
 * Cliente mínimo de MercadoPago (Checkout Pro) usando la API REST.
 * Solo necesita el Access Token de la cuenta del vendedor.
 * Docs: https://www.mercadopago.com.ar/developers/es/reference
 */

const MP_API = 'https://api.mercadopago.com';

export interface PreferenceItem {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

export interface CreatePreferenceArgs {
  items: PreferenceItem[];
  externalReference: string; // nuestro orderId
  backUrls: { success: string; failure: string; pending: string };
  notificationUrl: string;
  payerEmail?: string;
}

export interface PreferenceResult {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export async function createPreference(
  accessToken: string,
  args: CreatePreferenceArgs,
): Promise<PreferenceResult> {
  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: args.items,
      external_reference: args.externalReference,
      back_urls: args.backUrls,
      auto_return: 'approved',
      notification_url: args.notificationUrl,
      ...(args.payerEmail ? { payer: { email: args.payerEmail } } : {}),
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MercadoPago preference error ${res.status}: ${txt}`);
  }
  return (await res.json()) as PreferenceResult;
}

export interface MpPayment {
  id: number;
  status: string; // approved | rejected | pending | in_process | ...
  external_reference: string | null;
  transaction_amount: number;
}

export async function getPayment(accessToken: string, paymentId: string): Promise<MpPayment> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`MercadoPago payment error ${res.status}`);
  return (await res.json()) as MpPayment;
}

/** Reembolso total de un pago (devuelve el dinero al comprador). */
export async function refundPayment(accessToken: string, paymentId: string): Promise<void> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}/refunds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // body vacío = reembolso total
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`MercadoPago refund error ${res.status}: ${txt}`);
  }
}
