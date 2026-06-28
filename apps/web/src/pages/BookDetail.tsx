import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, ESTADO_LABEL, type Book } from '../api';
import { resizeImage } from '../imageResize';

export default function BookDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [autoresText, setAutoresText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    api
      .getBook(id!)
      .then((b) => {
        setBook(b);
        setAutoresText(b.autores.join(', '));
      })
      .catch((e) => setError(e.message));
  }, [id]);

  function set<K extends keyof Book>(key: K, value: Book[K]) {
    setBook((b) => (b ? { ...b, [key]: value } : b));
  }

  async function subirFoto(file?: File) {
    if (!file) return;
    setSubiendo(true);
    try {
      const url = await api.uploadImage(await resizeImage(file));
      set('portadaUrl', url);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }

  async function subirFotoAdicional(file?: File) {
    if (!file || !book) return;
    setSubiendo(true);
    try {
      const url = await api.uploadImage(await resizeImage(file));
      set('fotos', [...book.fotos, url]);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }
  function quitarFoto(url: string) {
    if (book) set('fotos', book.fotos.filter((f) => f !== url));
  }

  async function guardar() {
    if (!book) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateBook(book.id, {
        // Datos del libro
        titulo: book.titulo,
        autores: autoresText.split(',').map((s) => s.trim()).filter(Boolean),
        anio: book.anio,
        editorial: book.editorial,
        idioma: book.idioma,
        numPaginas: book.numPaginas,
        categoria: book.categoria,
        isbn: book.isbn,
        resena: book.resena,
        // Stock y físico
        estado: book.estado,
        cantidadTotal: book.cantidadTotal,
        stockVenta: Math.min(book.stockVenta, book.cantidadTotal),
        precio: book.stockVenta > 0 ? book.precio : null,
        portadaUrl: book.portadaUrl,
        fotos: book.fotos,
        ubicacionFisica: book.ubicacionFisica,
        condicion: book.condicion,
        notas: book.notas,
      });
      setBook(updated);
      setAutoresText(updated.autores.join(', '));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    if (!book || !confirm(`¿Eliminar "${book.titulo}"?`)) return;
    await api.deleteBook(book.id);
    nav('/admin');
  }

  if (error && !book) return <p className="error">{error}</p>;
  if (!book) return <p>Cargando…</p>;

  return (
    <div className="book-detail">
      <Link to="/admin" className="back">← Volver al catálogo</Link>
      <div className="detail-grid">
        <div className="cover-col">
          {book.portadaUrl ? <img src={book.portadaUrl} alt={book.titulo} /> : <div className="no-cover">Sin portada</div>}
          <span className={`badge ${book.estado}`}>{ESTADO_LABEL[book.estado]}</span>
        </div>
        <div className="meta-col">
          <h1>{book.titulo || 'Sin título'}</h1>
          <p className="autor">{autoresText || '—'}</p>

          <div className="edit-box">
            <h3>Datos del libro</h3>
            <label>Título *
              <input value={book.titulo} onChange={(e) => set('titulo', e.target.value)} />
            </label>
            <label>Autores (separados por coma)
              <input value={autoresText} onChange={(e) => setAutoresText(e.target.value)} />
            </label>
            <div className="row">
              <label>Año
                <input type="number" value={book.anio ?? ''} onChange={(e) => set('anio', e.target.value ? Number(e.target.value) : null)} />
              </label>
              <label>Editorial
                <input value={book.editorial ?? ''} onChange={(e) => set('editorial', e.target.value)} />
              </label>
            </div>
            <div className="row">
              <label>Idioma
                <input value={book.idioma ?? ''} onChange={(e) => set('idioma', e.target.value)} />
              </label>
              <label>N° páginas
                <input type="number" value={book.numPaginas ?? ''} onChange={(e) => set('numPaginas', e.target.value ? Number(e.target.value) : null)} />
              </label>
            </div>
            <label>Categoría
              <select value={book.categoria ?? ''} onChange={(e) => set('categoria', (e.target.value || null) as Book['categoria'])}>
                <option value="">Sin categoría</option>
                <option value="infantil">Infantil</option>
                <option value="juvenil">Juvenil</option>
                <option value="adulto">Adulto</option>
              </select>
            </label>
            <label>ISBN
              <input value={book.isbn ?? ''} onChange={(e) => set('isbn', e.target.value)} />
            </label>
            <label>Reseña
              <textarea rows={4} value={book.resena ?? ''} onChange={(e) => set('resena', e.target.value)} />
            </label>

            <h3>Portada</h3>
            <label>URL de portada
              <input value={book.portadaUrl ?? ''} onChange={(e) => set('portadaUrl', e.target.value)} placeholder="Pegá el link de una imagen de portada" />
            </label>
            <label>…o subí una foto (PNG/JPG)
              <input type="file" accept="image/*" disabled={subiendo} onChange={(e) => subirFoto(e.target.files?.[0])} />
            </label>
            {subiendo && <p className="hint">Subiendo imagen…</p>}

            <h3>Fotos adicionales</h3>
            <p className="hint">Para colecciones (fotos de cada tomo) o para mostrar el estado real del ejemplar (rayaduras, lomo, etc.).</p>
            {book.fotos.length > 0 && (
              <div className="fotos-grid">
                {book.fotos.map((url) => (
                  <div key={url} className="foto-thumb">
                    <img src={url} alt="Foto del ejemplar" />
                    <button type="button" className="foto-quitar" onClick={() => quitarFoto(url)} title="Quitar">×</button>
                  </div>
                ))}
              </div>
            )}
            <label>Agregar foto (PNG/JPG)
              <input type="file" accept="image/*" disabled={subiendo} onChange={(e) => { subirFotoAdicional(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </label>

            <h3>Stock y disponibilidad</h3>
            <div className="row">
              <label>Visibilidad
                <select value={book.estado === 'archivado' ? 'archivado' : 'disponible'} onChange={(e) => set('estado', e.target.value as Book['estado'])}>
                  <option value="disponible">En mi biblioteca</option>
                  <option value="archivado">Oculto</option>
                </select>
              </label>
              <label>Copias que poseo
                <input type="number" min={0} value={book.cantidadTotal}
                  onChange={(e) => set('cantidadTotal', e.target.value ? Number(e.target.value) : 0)} />
              </label>
            </div>
            <div className="row">
              <label>Cuántas a la venta
                <input type="number" min={0} max={book.cantidadTotal} value={book.stockVenta}
                  onChange={(e) => set('stockVenta', e.target.value ? Number(e.target.value) : 0)} />
              </label>
              {book.stockVenta > 0 && (
                <label>Precio (S/)
                  <input type="number" value={book.precio ?? ''} onChange={(e) => set('precio', e.target.value ? Number(e.target.value) : null)} />
                </label>
              )}
            </div>
            <p className="hint">Personales: {Math.max(0, book.cantidadTotal - book.stockVenta)}. {book.stockVenta > 0 ? 'En la tienda.' : 'Solo en la colección.'}</p>
            <div className="row">
              <label>Ubicación física
                <input value={book.ubicacionFisica ?? ''} onChange={(e) => set('ubicacionFisica', e.target.value)} />
              </label>
              <label>Condición
                <input value={book.condicion ?? ''} onChange={(e) => set('condicion', e.target.value)} />
              </label>
            </div>
            <label>Notas
              <textarea rows={3} value={book.notas ?? ''} onChange={(e) => set('notas', e.target.value)} />
            </label>

            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button className="btn primary" disabled={saving} onClick={guardar}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button className="btn danger" onClick={eliminar}>Eliminar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
