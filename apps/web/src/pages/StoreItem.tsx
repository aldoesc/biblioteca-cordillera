import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, CATEGORIA_LABEL, type PublicBook } from '../api';
import { useAuth } from '../auth';
import { formatPrecio } from './Store';
import { useSeo, useJsonLd } from '../useSeo';

export default function StoreItem() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, refreshCart } = useAuth();
  const [book, setBook] = useState<PublicBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api.publicBook(id!).then(setBook).catch((e) => setError(e.message));
  }, [id]);

  // SEO de la ficha: título y descripción propios (sin copiar la reseña)
  const autoresTxt = book?.autores.join(', ') ?? '';
  const resenaResumen = book?.resena ? book.resena.replace(/\s+/g, ' ').trim() : '';
  useSeo(
    book ? `${book.titulo}${autoresTxt ? ` — ${autoresTxt}` : ''} | Biblioteca Cordillera` : 'Biblioteca Cordillera',
    book
      ? resenaResumen
        ? resenaResumen.length > 158
          ? resenaResumen.slice(0, 155).trimEnd() + '…'
          : resenaResumen
        : `${book.titulo}${autoresTxt ? ` de ${autoresTxt}` : ''}. ${book.enVenta ? 'A la venta' : 'En la colección'} en Biblioteca Cordillera${book.condicion ? ` · Estado: ${book.condicion}` : ''}.`
      : undefined,
  );
  useJsonLd(
    book
      ? {
          '@context': 'https://schema.org',
          '@type': 'Book',
          name: book.titulo,
          ...(book.autores.length ? { author: book.autores.map((n) => ({ '@type': 'Person', name: n })) } : {}),
          ...(book.portadaUrl ? { image: book.portadaUrl } : {}),
          ...(book.isbn ? { isbn: book.isbn } : {}),
          ...(book.idioma ? { inLanguage: book.idioma } : {}),
          ...(book.numPaginas ? { numberOfPages: book.numPaginas } : {}),
          ...(book.enVenta && book.precio != null
            ? {
                offers: {
                  '@type': 'Offer',
                  price: book.precio,
                  priceCurrency: book.moneda,
                  availability: 'https://schema.org/InStock',
                  itemCondition:
                    book.condicion && /usad/i.test(book.condicion)
                      ? 'https://schema.org/UsedCondition'
                      : 'https://schema.org/NewCondition',
                },
              }
            : {}),
        }
      : null,
  );

  function urlLibro() {
    return book ? `${window.location.origin}/coleccion/${book.id}` : window.location.href;
  }
  function textoCompartir() {
    if (!book) return '';
    const precio = book.enVenta ? ` — ${formatPrecio(book.precio, book.moneda)}` : '';
    return `📚 ${book.titulo}${precio} · Biblioteca Cordillera`;
  }
  async function compartir() {
    const url = urlLibro();
    const text = textoCompartir();
    if (navigator.share) {
      try {
        await navigator.share({ title: book?.titulo ?? 'Biblioteca Cordillera', text, url });
      } catch {
        /* el usuario canceló */
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      } catch {
        /* sin portapapeles */
      }
    }
  }

  async function agregar() {
    if (!book) return;
    if (!user) {
      nav('/login', { state: { from: `/tienda/${book.id}` } });
      return;
    }
    await api.addToCart(book.id);
    await refreshCart();
    setAdded(true);
  }

  if (error) return (
    <div>
      <Link to="/" className="back">← Volver a la colección</Link>
      <p className="error">Este libro no está disponible.</p>
    </div>
  );
  if (!book) return <p>Cargando…</p>;

  return (
    <div className="store-item">
      <Link to="/" className="back">← Volver a la colección</Link>
      <div className="detail-grid">
        <div className="cover-col">
          {book.portadaUrl ? <img src={book.portadaUrl} alt={book.titulo} /> : <div className="no-cover">Sin portada</div>}
          {book.fotos.length > 0 && (
            <div className="fotos-grid">
              {book.fotos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="foto-thumb">
                  <img src={url} alt="Foto del ejemplar" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="meta-col">
          <h1>{book.titulo}</h1>
          <p className="autor">{book.autores.join(', ')}</p>
          {book.enVenta && <p className="precio-grande">{formatPrecio(book.precio, book.moneda)}</p>}

          <dl>
            <dt>Año</dt><dd>{book.anio ?? '—'}</dd>
            <dt>Editorial</dt><dd>{book.editorial ?? '—'}</dd>
            <dt>Categoría</dt><dd>{book.categoria ? CATEGORIA_LABEL[book.categoria] : '—'}</dd>
            <dt>Idioma</dt><dd>{book.idioma ?? '—'}</dd>
            <dt>Páginas</dt><dd>{book.numPaginas ?? '—'}</dd>
            <dt>Condición</dt><dd>{book.condicion ?? '—'}</dd>
            <dt>ISBN</dt><dd>{book.isbn ?? '—'}</dd>
          </dl>

          {book.resena && <p className="resena">{book.resena}</p>}

          {book.enVenta ? (
            <>
              <div className="actions">
                {added ? (
                  <Link to="/carrito" className="btn primary">✓ Agregado — ver carrito</Link>
                ) : (
                  <button className="btn primary" onClick={agregar}>🛒 Agregar al carrito</button>
                )}
              </div>
              {book.stockVenta <= 3 && <p className="hint">Quedan {book.stockVenta} disponible(s).</p>}
            </>
          ) : (
            <p className="coleccion-nota">📖 Ejemplar de la colección — no está a la venta.</p>
          )}

          <div className="share-row">
            <button className="btn" onClick={compartir}>🔗 {copiado ? '¡Link copiado!' : 'Compartir'}</button>
            <a
              className="btn whatsapp"
              href={`https://wa.me/?text=${encodeURIComponent(`${textoCompartir()}\n${urlLibro()}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
