/**
 * Cliente mínimo de NOWPayments (pagos en cripto: BTC, ETH, USDT, etc.).
 * Flujo: creamos una "invoice" con página de pago hospedada → el cliente paga →
 * NOWPayments nos avisa por IPN (webhook) con la firma HMAC-SHA512.
 * Docs: https://documenter.getpostman.com/view/7907941/S1a32n38
 */

const NP_API = 'https://api.nowpayments.io/v1';

export interface CreateInvoiceArgs {
  priceAmount: number;
  priceCurrency: string; // p.ej. 'usd'
  orderId: string; // nuestro id de pedido
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
}

export interface InvoiceResult {
  id: string;
  invoice_url: string;
}

export async function createInvoice(apiKey: string, args: CreateInvoiceArgs): Promise<InvoiceResult> {
  const res = await fetch(`${NP_API}/invoice`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: args.priceAmount,
      price_currency: args.priceCurrency,
      order_id: args.orderId,
      order_description: args.orderDescription,
      ipn_callback_url: args.ipnCallbackUrl,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`NOWPayments invoice error ${res.status}: ${txt}`);
  }
  return (await res.json()) as InvoiceResult;
}

/** Ordena las claves de un objeto recursivamente (requisito de la firma IPN). */
function sortObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = sortObject(obj[k]);
        return acc;
      }, {});
  }
  return obj;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Verifica la firma HMAC-SHA512 del IPN (header x-nowpayments-sig). */
export async function verifyIpn(secret: string, payload: any, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const sorted = JSON.stringify(sortObject(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sorted));
  const expected = toHex(sig);
  // comparación de longitud constante
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** Convierte un monto en PEN a USD (NOWPayments cotiza mejor en USD). */
export async function penToUsd(montoPen: number): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/PEN');
    if (res.ok) {
      const data = (await res.json()) as any;
      const rate = data?.rates?.USD;
      if (rate) return Math.round(montoPen * rate * 100) / 100;
    }
  } catch {
    /* usar fallback */
  }
  // Fallback aproximado si la API de cambio falla (1 PEN ≈ 0.27 USD)
  return Math.round(montoPen * 0.27 * 100) / 100;
}
