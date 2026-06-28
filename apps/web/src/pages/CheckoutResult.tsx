import { Link, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../auth';

// MercadoPago vuelve con ?status=approved|pending|failure (y collection_status).
export default function CheckoutResult() {
  const [params] = useSearchParams();
  const { refreshCart } = useAuth();
  const status = params.get('status') ?? params.get('collection_status') ?? 'pending';

  useEffect(() => {
    // Tras volver, el carrito pudo vaciarse por el webhook
    refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ok = status === 'approved';
  const pending = status === 'pending' || status === 'in_process';

  return (
    <div className="checkout-result">
      <div className="card" style={{ maxWidth: 480, margin: '30px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>{ok ? '✅' : pending ? '⏳' : '❌'}</div>
        <h1>{ok ? '¡Pago aprobado!' : pending ? 'Pago pendiente' : 'Pago no completado'}</h1>
        <p className="hint">
          {ok
            ? 'Tu compra fue confirmada. Te contactaremos para coordinar la entrega.'
            : pending
              ? 'Tu pago está en proceso. Te avisaremos cuando se acredite.'
              : 'El pago no se completó. Podés intentarlo de nuevo desde el carrito.'}
        </p>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <Link to="/pedidos" className="btn primary">Ver mis pedidos</Link>
          <Link to="/tienda" className="btn">Seguir comprando</Link>
        </div>
      </div>
    </div>
  );
}
