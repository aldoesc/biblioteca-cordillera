// Pages Function: genera /sitemap.xml dinámicamente con todos los libros de la
// colección, para que Google indexe cada ficha. Se cachea 1 hora.

const BASE = 'https://biblioteca-cordillera.pages.dev';
const API = 'https://biblioteca-api.aldescobar.workers.dev';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function onRequestGet(): Promise<Response> {
  let books: Array<{ id: number }> = [];
  try {
    const res = await fetch(`${API}/api/collection`);
    if (res.ok) books = await res.json();
  } catch {
    /* si la API falla, igual devolvemos las páginas fijas */
  }

  const urls = [
    { loc: `${BASE}/`, priority: '1.0' },
    { loc: `${BASE}/tienda`, priority: '0.9' },
    ...books.map((b) => ({ loc: `${BASE}/coleccion/${b.id}`, priority: '0.7' })),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><priority>${u.priority}</priority></url>`).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
