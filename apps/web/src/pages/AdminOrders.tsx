import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ORDER_LABEL, CUMPLIMIENTO_LABEL, type AdminOrder, type Cumplimiento } from '../api';
import { formatPrecio } from './Store';

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'por_atender' | 'todos'>('por_atender');

  async function load() {
    const os = await api.getAdminOrders();
    setOrders(os);
    // Marca como "vistas" las ventas pagadas (apaga el badge de la barra)
    const pagadas = os.filter((o) => o.estado === 'pagado').length;
    localStorage.setItem('ventas_vistas', String(pagadas));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function avanzar(o: AdminOrder, cumplimiento: Cumplimiento) {
    await api.updateOrderCumplimiento(o.id, cumplimiento);
    await load();
  }

  async function cancelar(o: AdminOrder) {
    const cripto = o.metodoPago === 'cripto';
    const aviso = cripto
      ? `Cancelar el pedido #${o.id}? Se repone el stock. El reembolso en CRIPTO se hace MANUALMENTE desde tu wallet.`
      : `Cancelar y REEMBOLSAR el pedido #${o.id}? Se devuelve el dinero por MercadoPago y se repone el stock.`;
    if (!confirm(aviso)) return;
    const r = await api.cancelarOrden(o.id);
    if (r.refund === 'auto') alert('✅ Pedido cancelado y dinero reembolsado por MercadoPago.');
    else if (r.refund === 'manual') alert('✅ Pedido cancelado. Acordate de devolver la cripto manualmente desde tu wallet.');
    else if (r.refund === 'error') alert('⚠️ Pedido cancelado y stock repuesto, pero el reembolso automático falló. Reembolsá manualmente desde MercadoPago.');
    else alert('✅ Pedido cancelado.');
    await load();
  }

  if (loading) return <p>Cargando…</p>;

  const pagados = orders.filter((o) => o.estado === 'pagado');
  const porAtender = pagados.filter((o) => o.cumplimiento === 'por_atender').length;
  const visibles = filtro === 'por_atender'
    ? pagados.filter((o) => o.cumplimiento !== 'entregado')
    : orders;

  return (
    <div className="orders">
      <div className="admin-head">
        <h1>Ventas {porAtender > 0 && <span className="cart-badge" style={{ position: 'static' }}>{porAtender}</span>}</h1>
        <Link to="/admin" className="btn">← Catálogo</Link>
      </div>

      <div className="filters">
        <button className={`btn ${filtro === 'por_atender' ? 'primary' : ''}`} onClick={() => setFiltro('por_atender')}>
          Por atender / en curso
        </button>
        <button className={`btn ${filtro === 'todos' ? 'primary' : ''}`} onClick={() => setFiltro('todos')}>
          Todos
        </button>
      </div>

      {!visibles.length && (
        <div className="empty"><p>{filtro === 'por_atender' ? 'No hay envíos pendientes. ¡Todo al día! 🎉' : 'Aún no hay pedidos.'}</p></div>
      )}

      {visibles.map((o) => (
        <div key={o.id} className="card order-card">
          <div className="order-head">
            <span>Pedido #{o.id} · {o.comprador?.email ?? '—'} · {o.metodoPago === 'cripto' ? '₿ Cripto' : 'MercadoPago'}</span>
            <span className={`order-badge ${o.estado}`}>{ORDER_LABEL[o.estado]}</span>
          </div>
          <ul className="order-items">
            {o.items.map((it) => (
              <li key={it.id}>
                <span>{it.titulo}{it.cantidad > 1 ? ` ×${it.cantidad}` : ''}</span>
                <span>{formatPrecio(it.precioUnitario * it.cantidad, o.moneda)}</span>
              </li>
            ))}
          </ul>
          <div className="order-total"><span>Total</span><strong>{formatPrecio(o.total, o.moneda)}</strong></div>

          {o.estado === 'pagado' && (
            <>
              <div className="envio-box">
                <h4>📦 Datos de entrega</h4>
                <p><strong>{o.compradorNombre ?? '—'}</strong> · 📞 {o.compradorTelefono ?? '—'}</p>
                <p>{o.direccionEnvio ?? '—'}{o.ciudad ? `, ${o.ciudad}` : ''}</p>
                {o.notasEnvio && <p className="hint">Nota: {o.notasEnvio}</p>}
              </div>

              <div className="cumplimiento">
                <span className={`cumpl-badge ${o.cumplimiento}`}>{CUMPLIMIENTO_LABEL[o.cumplimiento]}</span>
                <div className="cumpl-actions">
                  {o.cumplimiento === 'por_atender' && (
                    <button className="btn" onClick={() => avanzar(o, 'enviado')}>Marcar enviado</button>
                  )}
                  {o.cumplimiento === 'enviado' && (
                    <>
                      <button className="btn primary" onClick={() => avanzar(o, 'entregado')}>Marcar entregado</button>
                      <button className="link" onClick={() => avanzar(o, 'por_atender')}>Volver a por atender</button>
                    </>
                  )}
                  {o.cumplimiento === 'entregado' && (
                    <button className="link" onClick={() => avanzar(o, 'enviado')}>Reabrir</button>
                  )}
                  <button className="link danger" onClick={() => cancelar(o)}>Cancelar / Reembolsar</button>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
