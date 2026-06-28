import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Book } from '../api';
import { resizeImage } from '../imageResize';

// Carga diferida: la librería de escaneo (zxing) solo se baja cuando hace falta.
const IsbnScanner = lazy(() => import('../components/IsbnScanner'));

type Form = Partial<Book> & { autoresText?: string };

const VACIO: Form = { estado: 'disponible', moneda: 'PEN', cantidadTotal: 1, stockVenta: 0, fotos: [], autores: [], autoresText: '' };

export default function AddBook() {
  const nav = useNavigate();
  const [isbn, setIsbn] = useState('');
  const [form, setForm] = useState<Form>(VACIO);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [foundCover, setFoundCover] = useState<string | null>(null);

  async function buscar(isbnValue: string) {
    const clean = isbnValue.trim();
    if (!clean) return;
    setLoading(true);
    setMsg(null);
    try {
      const meta = await api.lookup(clean);
      setForm({
        isbn: meta.isbn,
        titulo: meta.titulo ?? '',
        autores: meta.autores,
        autoresText: meta.autores.join(', '),
        anio: meta.anio,
        editorial: meta.editorial,
        idioma: meta.idioma,
        numPaginas: meta.numPaginas,
        portadaUrl: meta.portadaUrl,
        resena: meta.resena,
        estado: 'disponible',
        cantidadTotal: 1,
        stockVenta: 0,
        fotos: [],
        moneda: 'PEN',
      });
      setFoundCover(meta.portadaUrl);
      setMsg(`✓ Datos encontrados (${meta.fuente.join(', ')}). Revisá y corregí si hace falta.`);
    } catch (e: any) {
      setForm({ ...VACIO, isbn: clean });
      setMsg(`No se encontraron datos para ${clean}. Podés cargarlo a mano.`);
    } finally {
      setLoading(false);
    }
  }

  function onDetected(code: string) {
    setIsbn(code);
    buscar(code);
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const [subiendo, setSubiendo] = useState(false);
  async function subirFoto(file?: File) {
    if (!file) return;
    setSubiendo(true);
    setMsg(null);
    try {
      const url = await api.uploadImage(await resizeImage(file));
      set('portadaUrl', url);
      setFoundCover(url);
    } catch (e: any) {
      setMsg(e?.message ?? 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }
  async function subirFotoAdicional(file?: File) {
    if (!file) return;
    setSubiendo(true);
    setMsg(null);
    try {
      const url = await api.uploadImage(await resizeImage(file));
      set('fotos', [...(form.fotos ?? []), url]);
    } catch (e: any) {
      setMsg(e?.message ?? 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }
  function quitarFoto(url: string) {
    set('fotos', (form.fotos ?? []).filter((f) => f !== url));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo?.trim()) {
      setMsg('El título es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const stockVenta = Math.min(form.stockVenta ?? 0, form.cantidadTotal ?? 0);
      const payload: Partial<Book> = {
        ...form,
        autores: (form.autoresText ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        stockVenta,
        // Solo tiene sentido un precio si hay stock a la venta
        precio: stockVenta > 0 ? form.precio ?? null : null,
      };
      delete (payload as any).autoresText;
      const created = await api.createBook(payload);
      nav(`/admin/libro/${created.id}`);
    } catch (e: any) {
      setMsg(e?.message ?? 'Error al guardar');
      setSaving(false);
    }
  }

  return (
    <div className="add-book">
      <h1>Agregar libro</h1>

      <section className="card">
        <h2>1. Escaneá o escribí el ISBN</h2>
        <p className="hint">El ISBN está en el código de barras de la contratapa. Autocompleta los datos.</p>
        <Suspense fallback={<p className="hint">Cargando escáner…</p>}>
          <IsbnScanner onDetected={onDetected} />
        </Suspense>
        <div className="isbn-manual">
          <input
            type="text"
            inputMode="numeric"
            placeholder="ISBN (ej: 9788437604947)"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar(isbn)}
          />
          <button type="button" className="btn" disabled={loading} onClick={() => buscar(isbn)}>
            {loading ? 'Buscando…' : 'Buscar datos'}
          </button>
        </div>
        {msg && <p className="msg">{msg}</p>}
      </section>

      <form className="card" onSubmit={guardar}>
        <h2>2. Revisá y guardá</h2>
        <div className="grid">
          {foundCover && (
            <img className="cover-preview" src={foundCover} alt="Portada" />
          )}
          <div className="fields">
            <label>Título *
              <input value={form.titulo ?? ''} onChange={(e) => set('titulo', e.target.value)} required />
            </label>
            <label>Autores (separados por coma)
              <input value={form.autoresText ?? ''} onChange={(e) => set('autoresText', e.target.value)} />
            </label>
            <div className="row">
              <label>Año
                <input type="number" value={form.anio ?? ''} onChange={(e) => set('anio', e.target.value ? Number(e.target.value) : null)} />
              </label>
              <label>Editorial
                <input value={form.editorial ?? ''} onChange={(e) => set('editorial', e.target.value)} />
              </label>
            </div>
            <div className="row">
              <label>Idioma
                <input value={form.idioma ?? ''} onChange={(e) => set('idioma', e.target.value)} />
              </label>
              <label>N° páginas
                <input type="number" value={form.numPaginas ?? ''} onChange={(e) => set('numPaginas', e.target.value ? Number(e.target.value) : null)} />
              </label>
            </div>
            <label>Categoría
              <select value={form.categoria ?? ''} onChange={(e) => set('categoria', (e.target.value || null) as Book['categoria'])}>
                <option value="">Sin categoría</option>
                <option value="infantil">Infantil</option>
                <option value="juvenil">Juvenil</option>
                <option value="adulto">Adulto</option>
              </select>
            </label>
            <label>URL de portada
              <input value={form.portadaUrl ?? ''} onChange={(e) => { set('portadaUrl', e.target.value); setFoundCover(e.target.value); }} />
            </label>
            <label>…o subí una foto (PNG/JPG)
              <input type="file" accept="image/*" disabled={subiendo}
                onChange={(e) => subirFoto(e.target.files?.[0])} />
            </label>
            {subiendo && <p className="hint">Subiendo imagen…</p>}

            <label style={{ marginTop: 8 }}>Fotos adicionales (colección / estado del ejemplar)
              <input type="file" accept="image/*" disabled={subiendo}
                onChange={(e) => { subirFotoAdicional(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </label>
            {(form.fotos ?? []).length > 0 && (
              <div className="fotos-grid">
                {(form.fotos ?? []).map((url) => (
                  <div key={url} className="foto-thumb">
                    <img src={url} alt="Foto del ejemplar" />
                    <button type="button" className="foto-quitar" onClick={() => quitarFoto(url)} title="Quitar">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <label>Reseña
          <textarea rows={4} value={form.resena ?? ''} onChange={(e) => set('resena', e.target.value)} />
        </label>

        <h3>Stock y disponibilidad</h3>
        <div className="row">
          <label>Visibilidad
            <select value={form.estado} onChange={(e) => set('estado', e.target.value as Book['estado'])}>
              <option value="disponible">En mi biblioteca (visible)</option>
              <option value="archivado">Oculto (no se muestra)</option>
            </select>
          </label>
          <label>Copias que poseo
            <input type="number" min={0} value={form.cantidadTotal ?? 1}
              onChange={(e) => set('cantidadTotal', e.target.value ? Number(e.target.value) : 0)} />
          </label>
        </div>
        <div className="row">
          <label>Cuántas a la venta
            <input type="number" min={0} max={form.cantidadTotal ?? 0} value={form.stockVenta ?? 0}
              onChange={(e) => set('stockVenta', e.target.value ? Number(e.target.value) : 0)} />
          </label>
          {(form.stockVenta ?? 0) > 0 && (
            <label>Precio (S/)
              <input type="number" value={form.precio ?? ''} onChange={(e) => set('precio', e.target.value ? Number(e.target.value) : null)} />
            </label>
          )}
        </div>
        <p className="hint">
          Personales (no a la venta): {Math.max(0, (form.cantidadTotal ?? 0) - (form.stockVenta ?? 0))}.
          {(form.stockVenta ?? 0) > 0 ? ' Aparecerá en la tienda.' : ' Solo en tu colección.'}
        </p>
        <div className="row">
          <label>Condición
            <input placeholder="nuevo / usado-bueno…" value={form.condicion ?? ''} onChange={(e) => set('condicion', e.target.value)} />
          </label>
          <label>Ubicación física
            <input placeholder="estante / caja" value={form.ubicacionFisica ?? ''} onChange={(e) => set('ubicacionFisica', e.target.value)} />
          </label>
        </div>

        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar libro'}
        </button>
      </form>
    </div>
  );
}
