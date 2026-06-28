// Middleware de prerender: inyecta meta tags (SEO + Open Graph) por libro en las
// rutas /coleccion/:id y /tienda/:id. Corre antes del fallback SPA: pide el HTML
// base con next() y le pone el <title>, description y og:* del libro.

const API = 'https://biblioteca-api.aldescobar.workers.dev';
const SITE = 'https://biblioteca-cordillera.pages.dev';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inject(html: string, m: { title: string; desc: string; img: string; url: string }): string {
  const rep = (re: RegExp, val: string) => {
    html = html.replace(re, val);
  };
  rep(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`);
  rep(/(<meta name="description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`);
  rep(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(m.url)}$2`);
  rep(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(m.title)}$2`);
  rep(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`);
  rep(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(m.img)}$2`);
  rep(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(m.url)}$2`);
  rep(/(<meta property="og:type" content=")[^"]*(")/, `$1book$2`);
  return html;
}

export async function onRequest(context: any): Promise<Response> {
  const { request, next } = context;
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/(?:coleccion|tienda)\/(\d+)\/?$/);
  if (!match) return next();

  const id = match[1];
  const response = await next(); // HTML base del SPA (fallback index.html)
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  let html = await response.text();
  try {
    const res = await fetch(`${API}/api/collection/${id}`);
    if (res.ok) {
      const b: any = await res.json();
      const autores = Array.isArray(b.autores) && b.autores.length ? ` de ${b.autores.join(', ')}` : '';
      const title = `${b.titulo} | Biblioteca Cordillera`;
      // Si hay reseña propia, la usamos (recortada) como descripción; si no, una genérica.
      const resena = typeof b.resena === 'string' ? b.resena.replace(/\s+/g, ' ').trim() : '';
      const desc = resena
        ? resena.length > 158
          ? resena.slice(0, 155).trimEnd() + '…'
          : resena
        : `${b.titulo}${autores}. ${b.enVenta ? 'A la venta' : 'En la colección'} en Biblioteca Cordillera${b.condicion ? ` · Estado: ${b.condicion}` : ''}.`;
      const img = b.portadaUrl || `${SITE}/logo.png`;
      const canonical = `${SITE}/coleccion/${id}`;
      html = inject(html, { title, desc, img, url: canonical });
    }
  } catch {
    /* devolvemos el HTML base si la API falla */
  }

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=600' },
  });
}
