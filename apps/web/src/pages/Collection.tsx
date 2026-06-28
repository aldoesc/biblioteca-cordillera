import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, CATEGORIA_LABEL, type Categoria, type PublicBook } from '../api';
import { formatPrecio } from './Store';
import { useSeo } from '../useSeo';

const CATEGORIAS: Categoria[] = ['infantil', 'juvenil', 'adulto'];

// Vitrina pública de toda la biblioteca: muestra todo lo visible,
// marcando con un badge cuáles se pueden comprar.
export default function Collection() {
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState<Categoria | ''>('');
  const [soloVenta, setSoloVenta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(cat: Categoria | '' = categoria) {
    setLoading(true);
    setError(null);
    try {
      setBooks(await api.collectionList(q, cat || undefined));
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

  useSeo(
    'Biblioteca Cordillera — Catálogo de libros',
    'Explorá la colección completa de la Biblioteca Cordillera. Libros nuevos y usados, con ejemplares seleccionados a la venta.',
  );

  const visibles = soloVenta ? books.filter((b) => b.enVenta) : books;

  return (
    <div className="store">
      <div className="store-hero">
        <h1>Biblioteca Cordillera</h1>
        <p>La colección completa. Algunos ejemplares están a la venta.</p>
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
        <label className="check">
          <input type="checkbox" checked={soloVenta} onChange={(e) => setSoloVenta(e.target.checked)} />
          Solo a la venta
        </label>
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
      {!loading && !visibles.length && (
        <div className="empty"><p>No hay libros para mostrar.</p></div>
      )}

      <div className="grid-cards">
        {visibles.map((b) => (
          <Link to={`/coleccion/${b.id}`} key={b.id} className="book-card">
            <div className="cover">
              {b.portadaUrl ? <img src={b.portadaUrl} alt={b.titulo} /> : <div className="no-cover">Sin portada</div>}
              {b.enVenta && <span className="badge en_venta">En venta</span>}
            </div>
            <div className="info">
              <strong>{b.titulo}</strong>
              <span className="autor">{b.autores.join(', ') || '—'}</span>
              {b.enVenta
                ? <span className="precio">{formatPrecio(b.precio, b.moneda)}</span>
                : <span className="autor">En la colección</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
