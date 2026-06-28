import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, CATEGORIA_LABEL, type Categoria, type PublicBook } from '../api';
import { useSeo } from '../useSeo';

const CATEGORIAS: Categoria[] = ['infantil', 'juvenil', 'adulto'];

const LOCALE_POR_MONEDA: Record<string, string> = { PEN: 'es-PE', USD: 'en-US', CLP: 'es-CL' };

export function formatPrecio(precio: number | null, moneda = 'PEN') {
  if (precio == null) return 'Consultar';
  try {
    return new Intl.NumberFormat(LOCALE_POR_MONEDA[moneda] ?? 'es-PE', {
      style: 'currency',
      currency: moneda,
    }).format(precio);
  } catch {
    return `${precio} ${moneda}`;
  }
}

export default function Store() {
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useSeo(
    'Tienda — Biblioteca Cordillera',
    'Libros a la venta en la Biblioteca Cordillera. Comprá ejemplares nuevos y usados con envío.',
  );

  async function load(cat: Categoria | '' = categoria) {
    setLoading(true);
    setError(null);
    try {
      setBooks(await api.storeList(q, cat || undefined));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegirCategoria(cat: Categoria | '') {
    setCategoria(cat);
    load(cat);
  }

  return (
    <div className="store">
      <div className="store-hero">
        <h1>Libros a la venta</h1>
        <p>Ejemplares seleccionados de la Biblioteca Cordillera.</p>
      </div>

      <div className="filters">
        <input
          type="search"
          placeholder="Buscar por título o autor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn" onClick={() => load()}>Buscar</button>
      </div>

      <div className="cat-tabs">
        <button className={`cat-tab ${categoria === '' ? 'active' : ''}`} onClick={() => elegirCategoria('')}>Todas</button>
        {CATEGORIAS.map((cat) => (
          <button key={cat} className={`cat-tab ${categoria === cat ? 'active' : ''}`} onClick={() => elegirCategoria(cat)}>
            {CATEGORIA_LABEL[cat]}
          </button>
        ))}
      </div>

      {loading && <p>Cargando…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !books.length && (
        <div className="empty"><p>Por ahora no hay libros a la venta. Volvé pronto.</p></div>
      )}

      <div className="grid-cards">
        {books.map((b) => (
          <Link to={`/tienda/${b.id}`} key={b.id} className="book-card">
            <div className="cover">
              {b.portadaUrl ? <img src={b.portadaUrl} alt={b.titulo} /> : <div className="no-cover">Sin portada</div>}
            </div>
            <div className="info">
              <strong>{b.titulo}</strong>
              <span className="autor">{b.autores.join(', ') || '—'}</span>
              <span className="precio">{formatPrecio(b.precio, b.moneda)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
