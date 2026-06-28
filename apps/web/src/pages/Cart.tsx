import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type CartLine } from '../api';
import { useAuth } from '../auth';
import { formatPrecio } from './Store';
import PaymentMethods from '../components/PaymentMethods';

// Monto mínimo (en soles) para habilitar el pago en cripto: en montos chicos
// las comisiones fijas de red/wallet no convienen.
const CRIPTO_MIN = 50;

export default function Cart() {
  const { user, refreshCart } = useAuth();
  const [items, setItems] = useState<CartLine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { items, total } = await api.getCart();
    setItems(items);
    setTotal(total);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos de entrega
  const [nombre, setNombre] = useState(user?.nombre ?? '');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [notas, setNotas] = useState('');

  async function quitar(bookId: number) {
    await api.removeFromCart(bookId);
    await load();
    await refreshCart();
  }

  function validarEnvio() {
    if (!telefono.trim() || !direccion.trim()) {
      setError('Completá teléfono y dirección de envío para continuar.');
      return false;
    }
    return true;
  }

  async function pagar() {
    if (!validarEnvio()) return;
    setPagando(true);
    setError(null);
    try {
      const { init_point } = await api.checkout({ nombre, telefono, direccion, ciudad, notas });
      // Redirige a MercadoPago. Usamos SIEMPRE init_point: el dominio sandbox
      // (sandbox_init_point) está obsoleto y entra en bucle de redirección.
      // El entorno (prueba/producción) lo determina el token, no la URL.
      window.location.href = init_point;
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo iniciar el pago');
      setPagando(false);
    }
  }

  async function pagarCripto() {
    if (!validarEnvio()) return;
    setPagando(true);
    setError(null);
    try {
      const { init_point } = await api.checkoutCripto({ nombre, telefono, direccion, ciudad, notas });
      window.location.href = init_point; // página de pago de NOWPayments
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo iniciar el pago en cripto');
      setPagando(false);
    }
  }

  if (!user) return (
    <div className="empty">
      <p>Iniciá sesión para ver tu carrito.</p>
      <Link to="/login" className="btn primary">Iniciar sesión</Link>
    </div>
  );

  if (loading) return <p>Cargando…</p>;

  return (
    <div className="cart">
      <h1>Tu carrito</h1>
      {!items.length ? (
        <div className="empty">
          <p>Tu carrito está vacío.</p>
          <Link to="/tienda" className="btn primary">Ir a la tienda</Link>
        </div>
      ) : (
        <>
          <ul className="cart-list">
            {items.map((i) => (
              <li key={i.id} className="cart-row">
                <div className="thumb">
                  {i.portadaUrl ? <img src={i.portadaUrl} alt={i.titulo} /> : <div className="no-cover">—</div>}
                </div>
                <div className="cart-info">
                  <Link to={`/tienda/${i.bookId}`}><strong>{i.titulo}</strong></Link>
                  <span className="autor">{i.autores.join(', ')}</span>
                  <span className="cant">Cantidad: {i.cantidad}</span>
                </div>
                <div className="cart-precio">
                  {formatPrecio(i.precio != null ? i.precio * i.cantidad : null, i.moneda)}
                  <button className="link danger" onClick={() => quitar(i.bookId)}>Quitar</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="cart-total">
            <span>Total</span>
            <strong>{formatPrecio(total, items[0]?.moneda ?? 'PEN')}</strong>
          </div>

          <div className="card envio-form">
            <h3>Datos de entrega</h3>
            <label>Nombre y apellido
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Para coordinar la entrega" />
            </label>
            <div className="row">
              <label>Teléfono / WhatsApp *
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" placeholder="9XX XXX XXX" />
              </label>
              <label>Ciudad
                <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Lima, Cusco…" />
              </label>
            </div>
            <label>Dirección de envío *
              <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, distrito, referencia" />
            </label>
            <label>Notas (opcional)
              <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Horario de entrega, indicaciones…" />
            </label>
            <p className="hint envio-aviso">📦 El precio incluye solo los libros. El <strong>costo de envío se coordina por WhatsApp</strong> después de la compra, según tu zona y el peso del pedido.</p>
          </div>

          {error && <p className="error">{error}</p>}
          <button className="btn primary big" onClick={pagar} disabled={pagando}>
            {pagando ? 'Redirigiendo…' : 'Pagar con MercadoPago'}
          </button>
          {total >= CRIPTO_MIN ? (
            <button className="btn big cripto" onClick={pagarCripto} disabled={pagando}>
              ₿ Pagar con cripto (BTC · ETH · USDT)
            </button>
          ) : (
            <p className="hint" style={{ marginTop: 10, textAlign: 'center' }}>
              ₿ Pago en cripto disponible para compras desde S/ {CRIPTO_MIN}.
            </p>
          )}
          <div className="cart-pay-methods"><PaymentMethods size="sm" /></div>
        </>
      )}
    </div>
  );
}
