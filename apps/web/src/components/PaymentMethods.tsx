// Tira de medios de pago aceptados (diseño genérico, sin logos de marca).
// Más adelante se pueden reemplazar los íconos por los badges oficiales.

function CardIcon() {
  return (
    <svg viewBox="0 0 36 24" aria-hidden="true">
      <rect x="1" y="1" width="34" height="22" rx="3" fill="#fff" stroke="#cbd2e0" />
      <rect x="1" y="5" width="34" height="4" fill="#1f2937" />
      <rect x="5" y="15" width="10" height="3" rx="1" fill="#9aa3b8" />
    </svg>
  );
}

export default function PaymentMethods({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div className={`pay-methods ${size}`}>
      <span className="pay-badge"><CardIcon /> Visa</span>
      <span className="pay-badge"><CardIcon /> Mastercard</span>
      <span className="pay-badge yape">Yape</span>
      <span className="pay-badge cripto"><b>₿</b> BTC · ETH · USDT</span>
    </div>
  );
}
