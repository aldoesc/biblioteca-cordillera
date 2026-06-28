import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Reclamo } from '../api';

export default function AdminReclamos() {
  const [items, setItems] = useState<Reclamo[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setItems(await api.getReclamos());
  }
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function alternar(r: Reclamo) {
    await api.marcarReclamo(r.id, r.estado === 'atendido' ? 'pendiente' : 'atendido');
    await load();
  }

  if (loading) return <p>Cargando…</p>;

  return (
    <div className="orders">
      <div className="admin-head">
        <h1>Libro de Reclamaciones</h1>
        <Link to="/admin" className="btn">← Catálogo</Link>
      </div>
      {!items.length && <div className="empty"><p>Aún no hay reclamos.</p></div>}
      {items.map((r) => (
        <div key={r.id} className="card order-card">
          <div className="order-head">
            <span>#{r.id} · {r.tipo === 'queja' ? 'Queja' : 'Reclamo'} · {r.nombre}</span>
            <span className={`order-badge ${r.estado === 'atendido' ? 'pagado' : 'pendiente'}`}>
              {r.estado === 'atendido' ? 'Atendido' : 'Pendiente'}
            </span>
          </div>
          <p className="hint">
            {r.tipoDocumento ?? 'Doc'}: {r.documento ?? '—'} · 📞 {r.telefono ?? '—'} · ✉️ {r.email ?? '—'}
          </p>
          {r.bien && <p className="hint">Bien: {r.bien}{r.monto ? ` · S/ ${r.monto}` : ''}</p>}
          <p><strong>Detalle:</strong> {r.detalle}</p>
          {r.pedidoConsumidor && <p><strong>Pedido del consumidor:</strong> {r.pedidoConsumidor}</p>}
          <div className="actions">
            <button className="btn" onClick={() => alternar(r)}>
              {r.estado === 'atendido' ? 'Marcar pendiente' : 'Marcar atendido'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
