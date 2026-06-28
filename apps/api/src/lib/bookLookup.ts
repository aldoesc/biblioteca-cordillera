/**
 * Búsqueda de metadatos de un libro a partir del ISBN.
 * Consulta Google Books y Open Library (ambas gratuitas) y combina lo mejor
 * de cada una. Devuelve `null` si ninguna lo encuentra.
 */

export interface BookMetadata {
  isbn: string;
  titulo: string | null;
  autores: string[];
  anio: number | null;
  editorial: string | null;
  idioma: string | null;
  numPaginas: number | null;
  portadaUrl: string | null;
  resena: string | null;
  fuente: string[];
}

function limpiarIsbn(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, '').toUpperCase();
}

async function googleBooks(isbn: string, apiKey?: string): Promise<Partial<BookMetadata> | null> {
  // Con API key: cuota propia estable (1000/día). Sin key, cuota compartida que
  // se agota rápido en Workers. `country` ayuda con resultados regionales.
  let url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=PE`;
  if (apiKey) url += `&key=${apiKey}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'BibliotecaCordillera/0.1' } });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const item = data?.items?.[0]?.volumeInfo;
  if (!item) return null;

  const anioMatch = String(item.publishedDate ?? '').match(/\d{4}/);
  // Preferir imagen grande y forzar https
  const img: string | undefined =
    item.imageLinks?.thumbnail ?? item.imageLinks?.smallThumbnail;

  return {
    titulo: item.title ?? null,
    autores: Array.isArray(item.authors) ? item.authors : [],
    anio: anioMatch ? Number(anioMatch[0]) : null,
    editorial: item.publisher ?? null,
    idioma: item.language ?? null,
    numPaginas: typeof item.pageCount === 'number' ? item.pageCount : null,
    portadaUrl: img ? img.replace(/^http:/, 'https:') : null,
    resena: item.description ?? null,
    fuente: ['google_books'],
  };
}

async function openLibrary(isbn: string): Promise<Partial<BookMetadata> | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url, { headers: { 'User-Agent': 'BibliotecaCordillera/0.1' } });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const item = data?.[`ISBN:${isbn}`];
  if (!item) return null;

  const anioMatch = String(item.publish_date ?? '').match(/\d{4}/);
  return {
    titulo: item.title ?? null,
    autores: Array.isArray(item.authors) ? item.authors.map((a: any) => a.name) : [],
    anio: anioMatch ? Number(anioMatch[0]) : null,
    editorial: Array.isArray(item.publishers) ? item.publishers[0]?.name ?? null : null,
    numPaginas: typeof item.number_of_pages === 'number' ? item.number_of_pages : null,
    portadaUrl: item.cover?.large ?? item.cover?.medium ?? null,
    resena: item.notes ?? null,
    fuente: ['open_library'],
  };
}

/** Combina dos fuentes priorizando la primera, rellenando huecos con la segunda. */
function combinar(
  a: Partial<BookMetadata> | null,
  b: Partial<BookMetadata> | null,
): Partial<BookMetadata> | null {
  if (!a) return b;
  if (!b) return a;
  return {
    titulo: a.titulo ?? b.titulo,
    autores: a.autores?.length ? a.autores : b.autores ?? [],
    anio: a.anio ?? b.anio,
    editorial: a.editorial ?? b.editorial,
    idioma: a.idioma ?? b.idioma,
    numPaginas: a.numPaginas ?? b.numPaginas,
    portadaUrl: a.portadaUrl ?? b.portadaUrl,
    resena: a.resena ?? b.resena,
    fuente: [...(a.fuente ?? []), ...(b.fuente ?? [])],
  };
}

export async function lookupByIsbn(isbnRaw: string, googleApiKey?: string): Promise<BookMetadata | null> {
  const isbn = limpiarIsbn(isbnRaw);
  if (isbn.length !== 10 && isbn.length !== 13) return null;

  // Consultar ambas en paralelo; tolerar fallos individuales
  const [g, o] = await Promise.allSettled([googleBooks(isbn, googleApiKey), openLibrary(isbn)]);
  const gv = g.status === 'fulfilled' ? g.value : null;
  const ov = o.status === 'fulfilled' ? o.value : null;

  const merged = combinar(gv, ov);
  if (!merged || !merged.titulo) return null;

  // Fallback de portada: si ninguna fuente la trajo, probar la imagen de
  // Open Library por ISBN (existe para muchos libros aunque no tengan datos).
  if (!merged.portadaUrl) {
    const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    try {
      const r = await fetch(`${coverUrl}?default=false`, { method: 'HEAD' });
      if (r.ok) merged.portadaUrl = coverUrl;
    } catch {
      /* sin portada */
    }
  }

  return {
    isbn,
    titulo: merged.titulo ?? null,
    autores: merged.autores ?? [],
    anio: merged.anio ?? null,
    editorial: merged.editorial ?? null,
    idioma: merged.idioma ?? null,
    numPaginas: merged.numPaginas ?? null,
    portadaUrl: merged.portadaUrl ?? null,
    resena: merged.resena ?? null,
    fuente: merged.fuente ?? [],
  };
}
