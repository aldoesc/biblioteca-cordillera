export interface Book {
  id: number;
  isbn: string | null;
  titulo: string;
  autores: string[];
  anio: number | null;
  editorial: string | null;
  idioma: string | null;
  numPaginas: number | null;
  categoria: 'infantil' | 'juvenil' | 'adulto' | null;
  portadaUrl: string | null;
  fotos: string[];
  resena: string | null;
  estado: 'archivado' | 'disponible' | 'en_venta' | 'vendido';
  cantidadTotal: number;
  stockVenta: number;
  precio: number | null;
  moneda: string;
  condicion: string | null;
  ubicacionFisica: string | null;
  notas: string | null;
  createdAt: number;
  updatedAt: number;
}

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

// En dev queda vacío y Vite proxea /api al Worker local.
// En producción se define VITE_API_URL con la URL del Worker desplegado.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

const TOKEN_KEY = 'biblioteca_token';
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface AuthUser {
  id: number;
  email: string;
  nombre: string | null;
  rol: 'admin' | 'cliente';
}
export interface CartLine {
  id: number;
  bookId: number;
  cantidad: number;
  titulo: string;
  autores: string[];
  portadaUrl: string | null;
  precio: number | null;
  moneda: string;
}

// Libro tal como lo ve el público en la tienda (sin datos internos)
export interface PublicBook {
  id: number;
  isbn: string | null;
  titulo: string;
  autores: string[];
  anio: number | null;
  editorial: string | null;
  idioma: string | null;
  numPaginas: number | null;
  categoria: 'infantil' | 'juvenil' | 'adulto' | null;
  portadaUrl: string | null;
  fotos: string[];
  resena: string | null;
  condicion: string | null;
  enVenta: boolean;
  stockVenta: number;
  precio: number | null;
  moneda: string;
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export type Categoria = 'infantil' | 'juvenil' | 'adulto';
export const CATEGORIA_LABEL: Record<Categoria, string> = {
  infantil: 'Infantil',
  juvenil: 'Juvenil',
  adulto: 'Adulto',
};

export const api = {
  lookup: (isbn: string) => req<BookMetadata>(`/api/lookup/${encodeURIComponent(isbn)}`),

  // Público: tienda (solo a la venta) y colección (todo lo visible)
  storeList: (q?: string, categoria?: string) =>
    req<PublicBook[]>(`/api/store${qs({ q, categoria })}`),
  collectionList: (q?: string, categoria?: string) =>
    req<PublicBook[]>(`/api/collection${qs({ q, categoria })}`),
  publicBook: (id: number | string) => req<PublicBook>(`/api/collection/${id}`),

  listBooks: (params: { q?: string; estado?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.estado) sp.set('estado', params.estado);
    const qs = sp.toString();
    return req<Book[]>(`/api/books${qs ? `?${qs}` : ''}`);
  },
  // Auth
  register: (data: { email: string; password: string; nombre?: string }) =>
    req<{ token: string; user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    req<{ token: string; user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => req<{ user: AuthUser }>('/api/auth/me'),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // Carrito
  getCart: () => req<{ items: CartLine[]; total: number }>('/api/cart'),
  addToCart: (bookId: number, cantidad = 1) =>
    req<{ ok: boolean }>('/api/cart', { method: 'POST', body: JSON.stringify({ bookId, cantidad }) }),
  removeFromCart: (bookId: number) =>
    req<{ ok: boolean }>(`/api/cart/${bookId}`, { method: 'DELETE' }),

  // Checkout y pedidos
  checkout: (envio: { nombre?: string; telefono: string; direccion: string; ciudad?: string; notas?: string }) =>
    req<{ orderId: number; init_point: string; sandbox_init_point: string }>('/api/checkout', {
      method: 'POST',
      body: JSON.stringify(envio),
    }),
  checkoutCripto: (envio: { nombre?: string; telefono: string; direccion: string; ciudad?: string; notas?: string }) =>
    req<{ orderId: number; init_point: string }>('/api/checkout/cripto', {
      method: 'POST',
      body: JSON.stringify(envio),
    }),
  getOrders: () => req<Order[]>('/api/orders'),
  getAdminOrders: () => req<AdminOrder[]>('/api/admin/orders'),
  updateOrderCumplimiento: (id: number, cumplimiento: Cumplimiento) =>
    req<{ ok: boolean }>(`/api/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ cumplimiento }) }),
  cancelarOrden: (id: number) =>
    req<{ ok: boolean; refund: 'auto' | 'manual' | 'error' | 'none' }>(`/api/admin/orders/${id}/cancelar`, { method: 'POST' }),

  // Libro de Reclamaciones
  enviarReclamo: (data: Record<string, string>) =>
    req<{ ok: boolean; numero: number }>('/api/reclamos', { method: 'POST', body: JSON.stringify(data) }),
  getReclamos: () => req<Reclamo[]>('/api/admin/reclamos'),
  marcarReclamo: (id: number, estado: 'pendiente' | 'atendido') =>
    req<{ ok: boolean }>(`/api/admin/reclamos/${id}`, { method: 'PATCH', body: JSON.stringify({ estado }) }),

  // Sube una imagen (ya optimizada) a R2 y devuelve su URL absoluta
  uploadImage: async (file: Blob): Promise<string> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error((b as any)?.error ?? 'No se pudo subir la imagen');
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  },

  getBook: (id: number | string) => req<Book>(`/api/books/${id}`),
  createBook: (data: Partial<Book>) =>
    req<Book>('/api/books', { method: 'POST', body: JSON.stringify(data) }),
  updateBook: (id: number, data: Partial<Book>) =>
    req<Book>(`/api/books/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBook: (id: number) => req<{ ok: boolean }>(`/api/books/${id}`, { method: 'DELETE' }),
};

export interface OrderItem {
  id: number;
  bookId: number | null;
  titulo: string;
  precioUnitario: number;
  cantidad: number;
}
export interface Order {
  id: number;
  estado: 'pendiente' | 'pagado' | 'fallido' | 'cancelado';
  metodoPago: 'mercadopago' | 'cripto';
  total: number;
  moneda: string;
  compradorNombre: string | null;
  compradorTelefono: string | null;
  direccionEnvio: string | null;
  ciudad: string | null;
  notasEnvio: string | null;
  createdAt: number;
  items: OrderItem[];
}
export type Cumplimiento = 'por_atender' | 'enviado' | 'entregado';
export interface AdminOrder extends Order {
  cumplimiento: Cumplimiento;
  comprador: { email: string; nombre: string | null } | null;
}

export interface Reclamo {
  id: number;
  tipo: 'reclamo' | 'queja';
  nombre: string;
  tipoDocumento: string | null;
  documento: string | null;
  domicilio: string | null;
  telefono: string | null;
  email: string | null;
  bien: string | null;
  monto: number | null;
  detalle: string;
  pedidoConsumidor: string | null;
  estado: 'pendiente' | 'atendido';
  createdAt: number;
}

export const CUMPLIMIENTO_LABEL: Record<Cumplimiento, string> = {
  por_atender: 'Por atender',
  enviado: 'Enviado',
  entregado: 'Entregado',
};

export const ESTADO_LABEL: Record<Book['estado'], string> = {
  archivado: 'Archivado',
  disponible: 'Disponible',
  en_venta: 'En venta',
  vendido: 'Vendido',
};

export const ORDER_LABEL: Record<Order['estado'], string> = {
  pendiente: 'Pendiente de pago',
  pagado: 'Pagado',
  fallido: 'Fallido',
  cancelado: 'Cancelado',
};
