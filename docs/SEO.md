# SEO de Biblioteca Cordillera — Guía técnica de estudio

Documento para entender **qué configuraciones se hicieron**, **por qué**, y **cómo mejorar el
indexado y la exposición** del sitio en buscadores (Google, Bing) y redes.

> Sitio: `https://biblioteca-cordillera.pages.dev`
> Web: React + Vite (SPA) en Cloudflare Pages · API: Hono en Cloudflare Workers

---

## 1. Conceptos base (para arrancar)

- **SEO** (Search Engine Optimization): el conjunto de prácticas para que un sitio aparezca
  más arriba y más seguido en los resultados de búsqueda.
- **Crawler / bot / araña**: el programa de Google (Googlebot) que recorre la web siguiendo
  enlaces y leyendo el HTML de cada página.
- **Indexar**: que Google guarde tu página en su índice. Sin indexar, no aparecés.
- **Rankear / posicionar**: en qué puesto aparecés para una búsqueda. Depende de relevancia,
  autoridad del dominio, velocidad, contenido, enlaces, etc.
- **SERP**: la página de resultados de búsqueda.

El flujo es: **rastrear → indexar → rankear**. Cada configuración de abajo ayuda a una o varias
de esas etapas.

---

## 2. El desafío particular de este sitio: es una SPA

La web es una **SPA** (Single Page Application): el servidor manda un HTML casi vacío y el
contenido lo arma **JavaScript** en el navegador.

- **Google** sí ejecuta JavaScript, así que puede ver el contenido… pero más lento y con menos
  garantía que un HTML ya armado.
- **Las redes sociales** (WhatsApp, Facebook, X) **NO ejecutan JavaScript**: solo leen el HTML
  inicial. Por eso, sin un truco, todas las páginas compartidas mostrarían el mismo título/imagen.

La solución que aplicamos para esto es el **prerender por libro** (ver punto 8).

---

## 3. Títulos y meta descriptions (`<title>` y `<meta name="description">`)

**Qué son:** el título es lo que se ve como enlace azul en Google; la *description* es el textito
gris debajo. Son la "portada" de tu página en los resultados.

**Qué hicimos:**
- En `index.html` hay un título y descripción **por defecto** del sitio.
- Con un hook propio (`src/useSeo.ts`) cada página ajusta su **título y descripción propios**:
  - Colección → "Biblioteca Cordillera — Catálogo de libros"
  - Tienda → "Tienda — Biblioteca Cordillera"
  - Ficha de libro → "{título del libro} | Biblioteca Cordillera"

**Por qué ayuda:** títulos únicos y descriptivos mejoran el *clic-through* (cuánta gente hace clic)
y le dicen a Google de qué trata cada página.

**Buenas prácticas:**
- Título: ~50–60 caracteres, con la palabra clave principal adelante.
- Description: ~150–160 caracteres, atractiva, única por página.

---

## 4. Open Graph (compartir en redes)

**Qué es:** unas etiquetas `<meta property="og:...">` que definen cómo se ve tu link cuando lo
pegás en WhatsApp/Facebook (título, descripción e **imagen** de la tarjeta).

**Qué hicimos:**
- `index.html` trae Open Graph por defecto (logo + textos del sitio).
- Para cada **libro**, un *prerender* (punto 8) reemplaza esas etiquetas por las del libro:
  su **portada**, su título y su descripción.

**Por qué ayuda:** un link con portada y título atractivos se comparte y se clickea mucho más
→ más tráfico → más señales positivas para SEO.

Etiquetas clave: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`.

---

## 5. `robots.txt`

**Qué es:** un archivo de texto en la raíz (`/robots.txt`) que le dice a los bots **qué pueden y
qué no pueden** rastrear.

**Qué hicimos** (`apps/web/public/robots.txt`):
```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /carrito
Disallow: /login
Disallow: /pedidos
Sitemap: https://biblioteca-cordillera.pages.dev/sitemap.xml
```
- Permite indexar todo lo público.
- **Bloquea** áreas privadas/inútiles para SEO (panel admin, carrito, login, pedidos).
- Le indica **dónde está el sitemap**.

**Importante:** `robots.txt` controla el *rastreo*, no es seguridad. No publiques ahí rutas
secretas (la protección real la da el login del backend).

---

## 6. `sitemap.xml`

**Qué es:** un archivo XML que **lista todas las URLs** que querés que Google indexe. Es como
entregarle el índice del sitio.

**Qué hicimos:** un sitemap **dinámico** generado por una *Pages Function*
(`apps/web/functions/sitemap.xml.ts`). Cada vez que se pide `/sitemap.xml`:
1. Consulta la API (`/api/collection`) por todos los libros.
2. Arma el XML con la portada (`/`), la tienda (`/tienda`) y **una URL por libro**
   (`/coleccion/{id}`).
3. Se cachea 1 hora.

**Por qué dinámico:** así, cuando cargás libros nuevos, **aparecen solos** en el sitemap, sin
tener que regenerar nada.

**Cómo se usa:** se lo enviás a Google en **Search Console → Sitemaps** (punto 11).

---

## 7. Datos estructurados (Schema.org / JSON-LD)

**Qué es:** un bloque de datos en formato JSON (`<script type="application/ld+json">`) que le
describe a Google **qué tipo de cosa** es la página, con un vocabulario estándar (schema.org).

**Qué hicimos:** en cada ficha de libro inyectamos un objeto tipo `Book` con:
- nombre, autor(es), imagen, ISBN, idioma, número de páginas;
- si está a la venta: un `Offer` con **precio, moneda, disponibilidad y condición** (nuevo/usado).

**Por qué ayuda:** habilita **resultados enriquecidos** (rich results): Google puede mostrar
precio, stock o estrellas directamente en el resultado, lo que llama más la atención.

**Cómo verificarlo:** Google "Rich Results Test" → pegás la URL del libro.

---

## 8. Prerender por libro (la pieza más técnica)

**El problema:** como es SPA, las redes (y parcialmente Google) ven el HTML "vacío" con los meta
genéricos del sitio, iguales para todos los libros.

**La solución:** un **middleware** en Cloudflare Pages (`apps/web/functions/_middleware.ts`) que
se ejecuta **en el servidor** antes de entregar la página. Cuando la URL es `/coleccion/:id` o
`/tienda/:id`:
1. Toma el HTML base de la SPA.
2. Consulta la API por ese libro.
3. **Reemplaza** en el HTML el `<title>`, la description y las etiquetas Open Graph por las del
   libro (incluida su portada).
4. Devuelve ese HTML "ya personalizado".

Después el JavaScript de la app sigue funcionando normal; pero los **bots ya leyeron** los meta
correctos. Es un "prerender" liviano y selectivo (solo en las fichas).

> Nota: probamos primero con rutas dinámicas de archivo (`functions/coleccion/[id].ts`), pero en
> Pages no siempre enganchan; el `_middleware.ts` resultó más robusto.

---

## 9. URLs canónicas

**Qué es:** la etiqueta `<link rel="canonical">` le dice a Google **cuál es la URL "oficial"** de
un contenido cuando hay varias que muestran lo mismo.

**Qué hicimos:** la misma ficha es accesible en `/coleccion/:id` y en `/tienda/:id`. Para que
Google **no lo cuente como contenido duplicado**, ambas declaran como canónica la versión
`/coleccion/:id`.

**Por qué ayuda:** evita penalizaciones por duplicado y concentra la "autoridad" en una sola URL.

---

## 10. Botón de compartir

Cada ficha tiene un botón **"Compartir"** que usa la *Web Share API* del celular (abre WhatsApp,
etc.) o copia el link en escritorio, más un acceso directo a **WhatsApp**. Comparte siempre la URL
canónica `/coleccion/:id` (la que tiene el prerender), así el preview sale perfecto.

**Por qué ayuda al SEO:** más compartidos → más visitas y más posibilidades de conseguir
**backlinks** (que otros sitios te enlacen), que es una de las señales más fuertes de autoridad.

---

## 11. Lo que falta hacer (tu tarea, gratis)

1. **Google Search Console** (`search.google.com/search-console`):
   - Agregá la propiedad por **prefijo de URL**: `https://biblioteca-cordillera.pages.dev`.
   - **Verificá** la propiedad (método HTML tag, archivo, o DNS).
   - En **Sitemaps**, enviá: `sitemap.xml`.
   - Ahí vas a ver qué páginas indexó Google, errores, y por qué búsquedas aparecés.
2. **Bing Webmaster Tools**: lo mismo para Bing (se puede importar desde Search Console).
3. **Dominio propio** (lo que más mueve la aguja): un `.com`/`.pe` rankea mucho mejor que un
   `.pages.dev`. Al migrar hay que actualizar las URLs en el SEO y en MercadoPago.

---

## 12. Cómo mejorar la exposición (continuo)

- **Contenido**: descripciones únicas y propias por libro (no copiar la contratapa). Usá las
  palabras que la gente busca ("comprar {título} usado Perú", "librería online …").
- **Imágenes**: portadas nítidas; el `alt` de las imágenes describe el libro.
- **Velocidad**: Cloudflare ya es rápido; mantené las imágenes livianas.
- **Backlinks**: que te enlacen desde grupos de lectura, redes, blogs.
- **Redes sociales**: publicá libros con el link → tráfico + señales.
- **Google Business Profile**: si tenés zona/punto físico, aparecés en Maps y búsquedas locales.
- **Constancia**: el SEO tarda semanas/meses en madurar. Cargar libros seguido = más páginas
  indexables = más puertas de entrada.

---

## 13. Checklist rápido de verificación

| Qué | Cómo verificar |
|-----|----------------|
| robots.txt | abrir `…/robots.txt` |
| sitemap | abrir `…/sitemap.xml` (debe listar tus libros) |
| meta por libro | abrir una ficha y ver el título de la pestaña |
| Open Graph | pegar el link de un libro en WhatsApp y ver el preview |
| datos estructurados | Google "Rich Results Test" con la URL del libro |
| indexado | en Google buscar `site:biblioteca-cordillera.pages.dev` |

---

## 14. Glosario express

- **SPA**: app que se arma con JS en el navegador.
- **Crawler/bot**: el robot que lee tu web.
- **Indexar**: que Google guarde tu página.
- **Open Graph**: meta tags para el preview al compartir.
- **Sitemap**: lista de tus URLs para Google.
- **Schema.org / JSON-LD**: datos estructurados para resultados enriquecidos.
- **Canonical**: la URL "oficial" cuando hay duplicados.
- **Backlink**: enlace desde otro sitio hacia el tuyo (suma autoridad).
- **Prerender**: armar el HTML en el servidor para que los bots lo lean sin ejecutar JS.
