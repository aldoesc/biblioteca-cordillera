// Botón flotante de WhatsApp (esquina inferior derecha, en todas las páginas).
const NUMERO = '51915964917'; // +51 (Perú) 915964917
const MENSAJE = '¡Hola! Quiero hacer una consulta sobre la Biblioteca Cordillera.';

export default function FloatingWhatsApp() {
  const href = `https://wa.me/${NUMERO}?text=${encodeURIComponent(MENSAJE)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="wa-float"
      aria-label="Consultar por WhatsApp"
      title="Consultar por WhatsApp"
    >
      <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
        <path d="M16 0C7.164 0 0 7.164 0 16c0 2.824.738 5.475 2.03 7.78L0 32l8.42-2.21A15.93 15.93 0 0 0 16 32c8.836 0 16-7.164 16-16S24.836 0 16 0zm0 29.2c-2.46 0-4.86-.66-6.95-1.9l-.5-.3-5 1.31 1.33-4.87-.33-.52A13.13 13.13 0 0 1 2.8 16C2.8 8.71 8.71 2.8 16 2.8S29.2 8.71 29.2 16 23.29 29.2 16 29.2zm7.24-9.86c-.4-.2-2.35-1.16-2.71-1.29-.36-.13-.63-.2-.9.2-.26.4-1.03 1.29-1.26 1.55-.23.26-.46.3-.86.1-.4-.2-1.68-.62-3.2-1.97-1.18-1.05-1.98-2.35-2.21-2.75-.23-.4-.02-.61.18-.81.18-.18.4-.46.6-.69.2-.23.26-.4.4-.66.13-.26.07-.5-.03-.69-.1-.2-.9-2.17-1.23-2.97-.32-.78-.65-.67-.9-.68l-.76-.01c-.26 0-.69.1-1.05.5-.36.4-1.38 1.35-1.38 3.29s1.41 3.82 1.61 4.08c.2.26 2.78 4.25 6.74 5.96.94.41 1.67.65 2.24.83.94.3 1.8.26 2.48.16.76-.11 2.35-.96 2.68-1.89.33-.93.33-1.72.23-1.89-.1-.16-.36-.26-.76-.46z" />
      </svg>
    </a>
  );
}
