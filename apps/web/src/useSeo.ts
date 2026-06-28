import { useEffect } from 'react';

/**
 * Ajusta el <title> y la meta description de la página actual (SPA).
 * Mejora el SEO (Google renderiza JS) y la experiencia en la pestaña.
 */
export function useSeo(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let m = document.querySelector('meta[name="description"]');
      if (!m) {
        m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
      }
      m.setAttribute('content', description);
    }
  }, [title, description]);
}

/** Inserta/actualiza datos estructurados (JSON-LD) para un producto/libro. */
export function useJsonLd(data: unknown | null) {
  useEffect(() => {
    const id = 'jsonld-producto';
    document.getElementById(id)?.remove();
    if (!data) return;
    const s = document.createElement('script');
    s.id = id;
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [data]);
}
