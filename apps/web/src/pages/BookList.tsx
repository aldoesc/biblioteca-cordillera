import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ESTADO_LABEL, type Book } from '../api';
import { formatPrecio } from './Store';

export default function BookList() {
  const [books, setBooks] = useState<Book[]>([]);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setBooks(await api.listBooks({ q, estado }));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  return (
    <div className="book-list">
      <div className="admin-head">
        <h1>Catálogo (administración)</h1>
        <Link to="/admin/nuevo" className="btn primary">+ Agregar libro</Link>
      </div>
      <div className="filters">
        <input
          type="search"
          placeholder="Buscar por título, autor o ISBN…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="archivado">Archivado</option>
          <option value="disponible">Disponible</option>
          <option value="en_venta">En venta</option>
        </select>
        <button className="btn" onClick={load}>Buscar</button>
      </div>

      {loading && <p>Cargando…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !books.length && (
        <div className="empty">
          <p>Todavía no hay libros.</p>
          <Link to="/admin/nuevo" className="btn primary">Agregar el primero</Link>
        </div>
      )}

      <div className="grid-cards">
        {books.map((b) => (
          <Link to={`/admin/libro/${b.id}`} key={b.id} className="book-card">
            <div className="cover">
              {b.portadaUrl ? <img src={b.portadaUrl} alt={b.titulo} /> : <div className="no-cover">Sin portada</div>}
              {b.stockVenta > 0
                ? <span className="badge en_venta">{b.stockVenta} a la venta</span>
                : <span className={`badge ${b.estado}`}>{ESTADO_LABEL[b.estado]}</span>}
            </div>
            <div className="info">
              <strong>{b.titulo}</strong>
              <span className="autor">{b.autores.join(', ') || '—'}</span>
              <span className="autor">{b.cantidadTotal} copia(s){b.stockVenta > 0 ? ` · ${b.stockVenta} en venta` : ''}</span>
              {b.stockVenta > 0 && b.precio != null && (
                <span className="precio">{formatPrecio(b.precio, b.moneda)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
