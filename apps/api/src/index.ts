import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import { books, users, sessions, cartItems, orders, orderItems, reclamos, loginThrottle, type User } from '@biblioteca/db';
import { lookupByIsbn } from './lib/bookLookup';
import { bearerToken, generateToken, hashPassword, sessionExpiry, verifyPassword } from './lib/auth';
import { createPreference, getPayment, refundPayment } from './lib/mercadopago';
import { createInvoice, verifyIpn, penToUsd } from './lib/nowpayments';
import { notifySale, notifyAdmin } from './lib/notify';

export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket; // opcional hasta habilitar R2 en el dashboard
  ADMIN_EMAIL?: string; // email que recibe rol 'admin' al registrarse
  MP_ACCESS_TOKEN?: string; // secret: access token de MercadoPago
  WEB_URL?: string; // URL pública de la web (para back_urls)
  SELF_URL?: string; // URL pública de esta API (para el webhook)
  // Notificaciones de venta (cada canal se activa si su credencial está)
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  RESEND_API_KEY?: string;
  ADMIN_NOTIFY_EMAIL?: string;
  GOOGLE_BOOKS_API_KEY?: string; // cuota propia estable para Google Books
  NOWPAYMENTS_API_KEY?: string; // pagos en cripto
  NOWPAYMENTS_IPN_SECRET?: string; // verificación del webhook de cripto
}

type Variables = { db: DrizzleD1Database; user: User | null };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', cors());

// Inyecta el cliente Drizzle y resuelve el usuario actual (si hay token válido)
app.use('*', async (c, next) => {
  const db = drizzle(c.env.DB);
  c.set('db', db);
  c.set('user', null);

  const token = bearerToken(c.req.header('Authorization'));
  if (token) {
    const [sess] = await db.select().from(sessions).where(eq(sessions.token, token));
    if (sess && sess.expiresAt.getTime() > Date.now()) {
      const [u] = await db.select().from(users).where(eq(users.id, sess.userId));
      if (u) c.set('user', u);
    }
  }
  await next();
});

// Helpers de autorización
function requireUser(c: any): User | Response {
  const u = c.get('user') as User | null;
  if (!u) return c.json({ error: 'No autenticado' }, 401);
  return u;
}
function requireAdmin(c: any): User | Response {
  const u = c.get('user') as User | null;
  if (!u) return c.json({ error: 'No autenticado' }, 401);
  if (u.rol !== 'admin') return c.json({ error: 'Requiere permisos de administrador' }, 403);
  return u;
}
function publicUser(u: User) {
  return { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol };
}

const ESTADOS = ['archivado', 'disponible', 'en_venta'] as const;
type Estado = (typeof ESTADOS)[number];

// Normaliza el payload entrante a columnas de la tabla
function parseBookBody(body: any) {
  const out: Record<string, unknown> = {};
  if (body.isbn !== undefined) out.isbn = body.isbn ? String(body.isbn) : null;
  if (body.titulo !== undefined) out.titulo = String(body.titulo);
  if (body.autores !== undefined)
    out.autores = Array.isArray(body.autores)
      ? JSON.stringify(body.autores)
      : body.autores
        ? JSON.stringify([String(body.autores)])
        : null;
  if (body.anio !== undefined) out.anio = body.anio ? Number(body.anio) : null;
  if (body.editorial !== undefined) out.editorial = body.editorial ?? null;
  if (body.idioma !== undefined) out.idioma = body.idioma ?? null;
  if (body.numPaginas !== undefined)
    out.numPaginas = body.numPaginas ? Number(body.numPaginas) : null;
  if (body.categoria !== undefined)
    out.categoria = ['infantil', 'juvenil', 'adulto'].includes(body.categoria) ? body.categoria : null;
  if (body.portadaUrl !== undefined) out.portadaUrl = body.portadaUrl ?? null;
  if (body.fotos !== undefined)
    out.fotos = Array.isArray(body.fotos) && body.fotos.length ? JSON.stringify(body.fotos) : null;
  if (body.resena !== undefined) out.resena = body.resena ?? null;
  if (body.estado !== undefined && ESTADOS.includes(body.estado)) out.estado = body.estado as Estado;
  if (body.cantidadTotal !== undefined) out.cantidadTotal = Math.max(0, Number(body.cantidadTotal) || 0);
  if (body.stockVenta !== undefined) out.stockVenta = Math.max(0, Number(body.stockVenta) || 0);
  // El stock a la venta nunca puede superar el total que poseo.
  if (out.cantidadTotal !== undefined && out.stockVenta !== undefined) {
    out.stockVenta = Math.min(out.stockVenta as number, out.cantidadTotal as number);
  }
  if (body.precio !== undefined) out.precio = body.precio === null || body.precio === '' ? null : Number(body.precio);
  if (body.moneda !== undefined) out.moneda = body.moneda ?? 'PEN';
  if (body.condicion !== undefined) out.condicion = body.condicion ?? null;
  if (body.ubicacionFisica !== undefined) out.ubicacionFisica = body.ubicacionFisica ?? null;
  if (body.notas !== undefined) out.notas = body.notas ?? null;
  return out;
}

// Devuelve la fila con `autores` ya parseado a array para el front
function serializeBook(row: any) {
  return {
    ...row,
    autores: row.autores ? safeJsonArray(row.autores) : [],
    fotos: row.fotos ? safeJsonArray(row.fotos) : [],
  };
}
function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Versión pública: solo campos visibles en la tienda.
// Omite a propósito datos internos (ubicacionFisica, notas, createdAt/updatedAt).
function serializePublic(row: any) {
  const enVenta = row.stockVenta > 0 && row.precio != null && row.estado !== 'archivado';
  return {
    id: row.id,
    isbn: row.isbn,
    titulo: row.titulo,
    autores: row.autores ? safeJsonArray(row.autores) : [],
    anio: row.anio,
    editorial: row.editorial,
    idioma: row.idioma,
    numPaginas: row.numPaginas,
    categoria: row.categoria,
    portadaUrl: row.portadaUrl,
    fotos: row.fotos ? safeJsonArray(row.fotos) : [],
    resena: row.resena,
    condicion: row.condicion,
    enVenta,
    stockVenta: row.stockVenta,
    precio: enVenta ? row.precio : null, // no exponemos precio si no está a la venta
    moneda: row.moneda,
  };
}

// ¿El libro se puede comprar ahora mismo?
function esComprable(book: any): boolean {
  return book.stockVenta > 0 && book.precio != null && book.estado !== 'archivado';
}

app.get('/api/health', (c) => c.json({ ok: true }));

// ============================================================
//  LIBRO DE RECLAMACIONES (Perú)
// ============================================================
app.post('/api/reclamos', async (c) => {
  const db = c.get('db');
  const b = await c.req.json().catch(() => ({} as any));
  const nombre = String(b.nombre ?? '').trim();
  const detalle = String(b.detalle ?? '').trim();
  if (!nombre || !detalle) return c.json({ error: 'El nombre y el detalle son obligatorios' }, 400);
  const tipo = b.tipo === 'queja' ? 'queja' : 'reclamo';

  const [row] = await db
    .insert(reclamos)
    .values({
      tipo,
      nombre,
      tipoDocumento: b.tipoDocumento ?? null,
      documento: b.documento ?? null,
      domicilio: b.domicilio ?? null,
      telefono: b.telefono ?? null,
      email: b.email ?? null,
      bien: b.bien ?? null,
      monto: b.monto ? Number(b.monto) : null,
      detalle,
      pedidoConsumidor: b.pedidoConsumidor ?? null,
    })
    .returning();

  const texto =
    `📕 NUEVO ${tipo.toUpperCase()} — Libro de Reclamaciones #${row!.id}\n\n` +
    `👤 ${nombre}${b.documento ? ` (${b.tipoDocumento ?? 'doc'} ${b.documento})` : ''}\n` +
    `📞 ${b.telefono ?? '—'} · ✉️ ${b.email ?? '—'}\n` +
    (b.bien ? `📦 Bien: ${b.bien}${b.monto ? ` (S/ ${b.monto})` : ''}\n` : '') +
    `\n📝 Detalle:\n${detalle}\n` +
    (b.pedidoConsumidor ? `\n🙏 Pedido del consumidor:\n${b.pedidoConsumidor}` : '');
  c.executionCtx.waitUntil(notifyAdmin(c.env, `Nuevo ${tipo} #${row!.id} — Libro de Reclamaciones`, texto));

  return c.json({ ok: true, numero: row!.id }, 201);
});

app.get('/api/admin/reclamos', async (c) => {
  const g = requireAdmin(c);
  if (g instanceof Response) return g;
  const db = c.get('db');
  const rows = await db.select().from(reclamos).orderBy(desc(reclamos.createdAt)).limit(500);
  return c.json(rows);
});

app.patch('/api/admin/reclamos/:id', async (c) => {
  const g = requireAdmin(c);
  if (g instanceof Response) return g;
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const { estado } = await c.req.json().catch(() => ({}));
  if (estado !== 'pendiente' && estado !== 'atendido') return c.json({ error: 'Estado inválido' }, 400);
  await db.update(reclamos).set({ estado }).where(eq(reclamos.id, id));
  return c.json({ ok: true });
});

// ============================================================
//  AUTENTICACIÓN (Fase 3)
// ============================================================

app.post('/api/auth/register', async (c) => {
  const db = c.get('db');
  const { email, password, nombre } = await c.req.json().catch(() => ({}));
  if (!email || !password) return c.json({ error: 'Email y contraseña son obligatorios' }, 400);
  if (String(password).length < 6) return c.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);

  const emailNorm = String(email).trim().toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, emailNorm));
  if (existing) return c.json({ error: 'Ese email ya está registrado' }, 409);

  const rol = c.env.ADMIN_EMAIL && emailNorm === c.env.ADMIN_EMAIL.toLowerCase() ? 'admin' : 'cliente';
  const passwordHash = await hashPassword(String(password));
  const [u] = await db
    .insert(users)
    .values({ email: emailNorm, nombre: nombre ?? null, passwordHash, rol })
    .returning();

  const token = generateToken();
  await db.insert(sessions).values({ token, userId: u!.id, expiresAt: sessionExpiry() });
  return c.json({ token, user: publicUser(u!) }, 201);
});

const LOGIN_MAX_INTENTOS = 8;
const LOGIN_VENTANA_MIN = 15;

app.post('/api/auth/login', async (c) => {
  const db = c.get('db');
  const ip = c.req.header('cf-connecting-ip') ?? 'desconocida';
  const now = Date.now();

  // Rate-limit por IP (anti fuerza bruta)
  const [t] = await db.select().from(loginThrottle).where(eq(loginThrottle.key, ip));
  const ventanaActiva = t && t.resetAt.getTime() > now;
  if (ventanaActiva && t.count >= LOGIN_MAX_INTENTOS) {
    return c.json({ error: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.' }, 429);
  }

  const { email, password } = await c.req.json().catch(() => ({}));
  const emailNorm = String(email ?? '').trim().toLowerCase();
  const [u] = await db.select().from(users).where(eq(users.email, emailNorm));

  if (!u || !(await verifyPassword(String(password ?? ''), u.passwordHash))) {
    // Registrar el intento fallido
    const count = ventanaActiva ? t.count + 1 : 1;
    const resetAt = ventanaActiva ? t.resetAt : new Date(now + LOGIN_VENTANA_MIN * 60 * 1000);
    await db
      .insert(loginThrottle)
      .values({ key: ip, count, resetAt })
      .onConflictDoUpdate({ target: loginThrottle.key, set: { count, resetAt } });
    return c.json({ error: 'Email o contraseña incorrectos' }, 401);
  }

  // Login OK: limpiar el contador de esa IP
  if (t) await db.delete(loginThrottle).where(eq(loginThrottle.key, ip));
  const token = generateToken();
  await db.insert(sessions).values({ token, userId: u.id, expiresAt: sessionExpiry() });
  return c.json({ token, user: publicUser(u) });
});

app.get('/api/auth/me', (c) => {
  const u = c.get('user');
  if (!u) return c.json({ error: 'No autenticado' }, 401);
  return c.json({ user: publicUser(u) });
});

app.post('/api/auth/logout', async (c) => {
  const db = c.get('db');
  const token = bearerToken(c.req.header('Authorization'));
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
  return c.json({ ok: true });
});

// ============================================================
//  CARRITO (Fase 3) — requiere usuario autenticado
// ============================================================

app.get('/api/cart', async (c) => {
  const u = requireUser(c);
  if (u instanceof Response) return u;
  const db = c.get('db');
  // Une carrito con libros y devuelve solo los que siguen en venta
  const rows = await db
    .select({ item: cartItems, book: books })
    .from(cartItems)
    .innerJoin(books, eq(cartItems.bookId, books.id))
    .where(eq(cartItems.userId, u.id));

  const items = rows
    .filter((r) => esComprable(r.book))
    .map((r) => ({
      id: r.item.id,
      bookId: r.book.id,
      cantidad: Math.min(r.item.cantidad, r.book.stockVenta),
      titulo: r.book.titulo,
      autores: r.book.autores ? safeJsonArray(r.book.autores) : [],
      portadaUrl: r.book.portadaUrl,
      precio: r.book.precio,
      moneda: r.book.moneda,
    }));
  const total = items.reduce((acc, i) => acc + (i.precio ?? 0) * i.cantidad, 0);
  return c.json({ items, total });
});

app.post('/api/cart', async (c) => {
  const u = requireUser(c);
  if (u instanceof Response) return u;
  const db = c.get('db');
  const { bookId, cantidad } = await c.req.json().catch(() => ({}));
  const bid = Number(bookId);
  const [book] = await db.select().from(books).where(eq(books.id, bid));
  if (!book || !esComprable(book)) return c.json({ error: 'Libro no disponible para la venta' }, 400);

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, u.id), eq(cartItems.bookId, bid)));
  const deseada = (existing?.cantidad ?? 0) + (Number(cantidad) || 1);
  const nuevaCantidad = Math.min(deseada, book.stockVenta); // no superar el stock
  if (existing) {
    await db.update(cartItems).set({ cantidad: nuevaCantidad }).where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({ userId: u.id, bookId: bid, cantidad: nuevaCantidad });
  }
  return c.json({ ok: true }, 201);
});

app.delete('/api/cart/:bookId', async (c) => {
  const u = requireUser(c);
  if (u instanceof Response) return u;
  const db = c.get('db');
  const bid = Number(c.req.param('bookId'));
  await db.delete(cartItems).where(and(eq(cartItems.userId, u.id), eq(cartItems.bookId, bid)));
  return c.json({ ok: true });
});

// ============================================================
//  CHECKOUT + PEDIDOS (Fase 4) — MercadoPago
// ============================================================

// Inicia el pago: crea el pedido y la preferencia de MercadoPago.
app.post('/api/checkout', async (c) => {
  const u = requireUser(c);
  if (u instanceof Response) return u;
  if (!c.env.MP_ACCESS_TOKEN) return c.json({ error: 'Pagos no configurados (falta MP_ACCESS_TOKEN)' }, 503);
  const db = c.get('db');
  await cancelarPendientesVencidos(db); // libera reservas de checkouts abandonados

  // Datos de entrega (obligatorios teléfono y dirección para poder enviar)
  const envio = await c.req.json().catch(() => ({} as any));
  const telefono = String(envio.telefono ?? '').trim();
  const direccion = String(envio.direccion ?? '').trim();
  if (!telefono || !direccion) {
    return c.json({ error: 'Falta el teléfono o la dirección de envío' }, 400);
  }

  // Cargar carrito (solo libros aún en venta)
  const rows = await db
    .select({ item: cartItems, book: books })
    .from(cartItems)
    .innerJoin(books, eq(cartItems.bookId, books.id))
    .where(eq(cartItems.userId, u.id));
  // Solo libros comprables, y la cantidad nunca supera el stock disponible
  const lineas = rows
    .filter((r) => esComprable(r.book))
    .map((r) => ({ book: r.book, cantidad: Math.min(r.item.cantidad, r.book.stockVenta) }));
  if (!lineas.length) return c.json({ error: 'El carrito está vacío o sin libros disponibles' }, 400);

  const moneda = lineas[0]!.book.moneda;
  const total = lineas.reduce((acc, r) => acc + (r.book.precio ?? 0) * r.cantidad, 0);

  // Reservar stock (atómico). Si algún libro se agotó entre medio, abortar.
  if (!(await reservarStock(db, lineas))) {
    return c.json({ error: 'Uno de los libros ya no está disponible. Revisá tu carrito.' }, 409);
  }

  // Crear pedido pendiente + ítems (con datos congelados)
  const [order] = await db
    .insert(orders)
    .values({
      userId: u.id,
      estado: 'pendiente',
      total,
      moneda,
      compradorNombre: envio.nombre ? String(envio.nombre).trim() : u.nombre,
      compradorTelefono: telefono,
      direccionEnvio: direccion,
      ciudad: envio.ciudad ? String(envio.ciudad).trim() : null,
      notasEnvio: envio.notas ? String(envio.notas).trim() : null,
    })
    .returning();
  await db.insert(orderItems).values(
    lineas.map((r) => ({
      orderId: order!.id,
      bookId: r.book.id,
      titulo: r.book.titulo,
      precioUnitario: r.book.precio ?? 0,
      cantidad: r.cantidad,
    })),
  );

  const webUrl = c.env.WEB_URL ?? '';
  const selfUrl = c.env.SELF_URL ?? new URL(c.req.url).origin;
  try {
    const pref = await createPreference(c.env.MP_ACCESS_TOKEN, {
      items: lineas.map((r) => ({
        title: r.book.titulo,
        quantity: r.cantidad,
        unit_price: r.book.precio ?? 0,
        currency_id: moneda,
      })),
      externalReference: String(order!.id),
      backUrls: {
        success: `${webUrl}/checkout/resultado`,
        failure: `${webUrl}/checkout/resultado`,
        pending: `${webUrl}/checkout/resultado`,
      },
      notificationUrl: `${selfUrl}/api/webhooks/mercadopago`,
      payerEmail: u.email,
    });
    await db
      .update(orders)
      .set({ mpPreferenceId: pref.id, updatedAt: new Date() })
      .where(eq(orders.id, order!.id));
    // sandbox_init_point para credenciales de prueba; init_point en producción
    return c.json({ orderId: order!.id, init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point });
  } catch (e: any) {
    await restaurarStockPedido(db, order!.id); // liberar la reserva si no se creó el pago
    await db.update(orders).set({ estado: 'fallido', updatedAt: new Date() }).where(eq(orders.id, order!.id));
    return c.json({ error: 'No se pudo crear el pago', detalle: e?.message }, 502);
  }
});

// --- Gestión de STOCK reservado (anti-sobreventa) ---
// El stock se RESERVA al iniciar el checkout (no al confirmar el pago), con un
// descuento atómico condicional. Si el pago no se concreta, se restaura.

type LineaReserva = { book: { id: number }; cantidad: number };

// Reserva atómicamente cada línea. Si alguna no tiene stock, revierte y devuelve false.
async function reservarStock(db: DrizzleD1Database, lineas: LineaReserva[]): Promise<boolean> {
  const reservadas: LineaReserva[] = [];
  for (const r of lineas) {
    const upd = await db
      .update(books)
      .set({ stockVenta: sql`${books.stockVenta} - ${r.cantidad}`, updatedAt: new Date() })
      .where(and(eq(books.id, r.book.id), sql`${books.stockVenta} >= ${r.cantidad}`))
      .returning({ id: books.id });
    if (upd.length) {
      reservadas.push(r);
    } else {
      // No había stock: revertir lo ya reservado y abortar
      for (const rr of reservadas) {
        await db
          .update(books)
          .set({ stockVenta: sql`${books.stockVenta} + ${rr.cantidad}`, updatedAt: new Date() })
          .where(eq(books.id, rr.book.id));
      }
      return false;
    }
  }
  return true;
}

// Devuelve el stock reservado por un pedido (al fallar/cancelar/vencer).
async function restaurarStockPedido(db: DrizzleD1Database, orderId: number): Promise<void> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    if (it.bookId != null) {
      await db
        .update(books)
        .set({ stockVenta: sql`${books.stockVenta} + ${it.cantidad}`, updatedAt: new Date() })
        .where(eq(books.id, it.bookId));
    }
  }
}

// Cancela pedidos pendientes vencidos (>2 h) y libera su stock reservado.
async function cancelarPendientesVencidos(db: DrizzleD1Database): Promise<void> {
  const limite = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const viejos = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.estado, 'pendiente'), sql`${orders.createdAt} < ${Math.floor(limite.getTime() / 1000)}`));
  for (const o of viejos) {
    await restaurarStockPedido(db, o.id);
    await db.update(orders).set({ estado: 'cancelado', updatedAt: new Date() }).where(eq(orders.id, o.id));
  }
}

// Cierra una venta pagada: marca el pedido, vacía carrito y notifica.
// El stock ya fue reservado al checkout; si el pedido estaba cancelado (vencido y
// liberado) pero llega el pago, se vuelve a descontar para no sobrevender.
async function cerrarVentaPagada(c: any, order: any, externalPaymentId: string) {
  const db = c.get('db');
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  if (order.estado === 'cancelado') {
    for (const it of items) {
      if (it.bookId != null) {
        await db
          .update(books)
          .set({ stockVenta: sql`MAX(0, ${books.stockVenta} - ${it.cantidad})`, updatedAt: new Date() })
          .where(eq(books.id, it.bookId));
      }
    }
  }
  await db
    .update(orders)
    .set({ estado: 'pagado', mpPaymentId: externalPaymentId, updatedAt: new Date() })
    .where(eq(orders.id, order.id));
  await db.delete(cartItems).where(eq(cartItems.userId, order.userId));
  c.executionCtx.waitUntil(notifySale(c.env, order, items));
}

// Webhook de MercadoPago: confirma el pago y cierra el pedido.
app.post('/api/webhooks/mercadopago', async (c) => {
  if (!c.env.MP_ACCESS_TOKEN) return c.json({ ok: true });
  const db = c.get('db');

  // MP manda el id del pago por query (?type=payment&data.id=) o en el body
  const type = c.req.query('type') ?? c.req.query('topic');
  let paymentId = c.req.query('data.id') ?? c.req.query('id');
  if (!paymentId) {
    const body = await c.req.json().catch(() => ({} as any));
    paymentId = body?.data?.id ?? body?.id;
    if (!type && body?.type !== 'payment') return c.json({ ok: true });
  }
  if (type && type !== 'payment') return c.json({ ok: true });
  if (!paymentId) return c.json({ ok: true });

  try {
    const pago = await getPayment(c.env.MP_ACCESS_TOKEN, String(paymentId));
    const orderId = Number(pago.external_reference);
    if (!orderId) return c.json({ ok: true });
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
    if (!order || order.estado === 'pagado') return c.json({ ok: true });

    if (pago.status === 'approved') {
      await cerrarVentaPagada(c, order, String(pago.id));
    } else if (pago.status === 'rejected' || pago.status === 'cancelled') {
      if (order.estado === 'pendiente') await restaurarStockPedido(db, orderId); // liberar reserva
      await db.update(orders).set({ estado: 'fallido', updatedAt: new Date() }).where(eq(orders.id, orderId));
    }
  } catch {
    // No fallar el webhook: MP reintenta si devolvemos error
  }
  return c.json({ ok: true });
});

// Checkout con CRIPTO (NOWPayments): crea el pedido y una invoice de pago.
app.post('/api/checkout/cripto', async (c) => {
  const u = requireUser(c);
  if (u instanceof Response) return u;
  if (!c.env.NOWPAYMENTS_API_KEY) return c.json({ error: 'Pagos en cripto no configurados' }, 503);
  const db = c.get('db');
  await cancelarPendientesVencidos(db);

  const envio = await c.req.json().catch(() => ({} as any));
  const telefono = String(envio.telefono ?? '').trim();
  const direccion = String(envio.direccion ?? '').trim();
  if (!telefono || !direccion) return c.json({ error: 'Falta el teléfono o la dirección de envío' }, 400);

  const rows = await db
    .select({ item: cartItems, book: books })
    .from(cartItems)
    .innerJoin(books, eq(cartItems.bookId, books.id))
    .where(eq(cartItems.userId, u.id));
  const lineas = rows
    .filter((r) => esComprable(r.book))
    .map((r) => ({ book: r.book, cantidad: Math.min(r.item.cantidad, r.book.stockVenta) }));
  if (!lineas.length) return c.json({ error: 'El carrito está vacío o sin libros disponibles' }, 400);

  const moneda = lineas[0]!.book.moneda;
  const total = lineas.reduce((acc, r) => acc + (r.book.precio ?? 0) * r.cantidad, 0);

  // Mínimo para cripto: en montos chicos las comisiones fijas no convienen.
  const CRIPTO_MIN_PEN = 50;
  if (moneda === 'PEN' && total < CRIPTO_MIN_PEN) {
    return c.json({ error: `El pago en cripto está disponible para compras desde S/ ${CRIPTO_MIN_PEN}.` }, 400);
  }

  // Reservar stock (atómico, anti-sobreventa)
  if (!(await reservarStock(db, lineas))) {
    return c.json({ error: 'Uno de los libros ya no está disponible. Revisá tu carrito.' }, 409);
  }

  const [order] = await db
    .insert(orders)
    .values({
      userId: u.id,
      estado: 'pendiente',
      metodoPago: 'cripto',
      total,
      moneda,
      compradorNombre: envio.nombre ? String(envio.nombre).trim() : u.nombre,
      compradorTelefono: telefono,
      direccionEnvio: direccion,
      ciudad: envio.ciudad ? String(envio.ciudad).trim() : null,
      notasEnvio: envio.notas ? String(envio.notas).trim() : null,
    })
    .returning();
  await db.insert(orderItems).values(
    lineas.map((r) => ({
      orderId: order!.id,
      bookId: r.book.id,
      titulo: r.book.titulo,
      precioUnitario: r.book.precio ?? 0,
      cantidad: r.cantidad,
    })),
  );

  const webUrl = c.env.WEB_URL ?? '';
  const selfUrl = c.env.SELF_URL ?? new URL(c.req.url).origin;
  try {
    // NOWPayments cotiza en USD; convertimos el total de PEN al cambio del día.
    const priceUsd = moneda === 'USD' ? total : await penToUsd(total);
    const inv = await createInvoice(c.env.NOWPAYMENTS_API_KEY, {
      priceAmount: priceUsd,
      priceCurrency: 'usd',
      orderId: String(order!.id),
      orderDescription: `Biblioteca Cordillera · pedido #${order!.id}`,
      ipnCallbackUrl: `${selfUrl}/api/webhooks/nowpayments`,
      successUrl: `${webUrl}/checkout/resultado?status=approved`,
      cancelUrl: `${webUrl}/checkout/resultado?status=failure`,
    });
    await db.update(orders).set({ mpPreferenceId: inv.id, updatedAt: new Date() }).where(eq(orders.id, order!.id));
    return c.json({ orderId: order!.id, init_point: inv.invoice_url });
  } catch (e: any) {
    await restaurarStockPedido(db, order!.id);
    await db.update(orders).set({ estado: 'fallido', updatedAt: new Date() }).where(eq(orders.id, order!.id));
    return c.json({ error: 'No se pudo crear el pago en cripto', detalle: e?.message }, 502);
  }
});

// Webhook (IPN) de NOWPayments: confirma el pago en cripto y cierra el pedido.
app.post('/api/webhooks/nowpayments', async (c) => {
  if (!c.env.NOWPAYMENTS_IPN_SECRET) return c.json({ ok: true });
  const db = c.get('db');
  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ ok: true });

  const valido = await verifyIpn(c.env.NOWPAYMENTS_IPN_SECRET, raw, c.req.header('x-nowpayments-sig') ?? null);
  if (!valido) return c.json({ error: 'firma inválida' }, 401);

  const orderId = Number(raw.order_id);
  const status = String(raw.payment_status ?? '');
  if (!orderId) return c.json({ ok: true });
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order || order.estado === 'pagado') return c.json({ ok: true });

  if (status === 'finished' || status === 'confirmed') {
    await cerrarVentaPagada(c, order, `np_${raw.payment_id ?? ''}`);
  } else if (status === 'failed' || status === 'expired' || status === 'refunded') {
    if (order.estado === 'pendiente') await restaurarStockPedido(db, orderId);
    await db.update(orders).set({ estado: 'fallido', updatedAt: new Date() }).where(eq(orders.id, orderId));
  }
  return c.json({ ok: true });
});

// Pedidos del usuario autenticado
app.get('/api/orders', async (c) => {
  const u = requireUser(c);
  if (u instanceof Response) return u;
  const db = c.get('db');
  const os = await db.select().from(orders).where(eq(orders.userId, u.id)).orderBy(desc(orders.createdAt));
  const result = [];
  for (const o of os) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    result.push({ ...o, items });
  }
  return c.json(result);
});

// Admin: actualizar estado de cumplimiento/envío de un pedido
app.patch('/api/admin/orders/:id', async (c) => {
  const g = requireAdmin(c);
  if (g instanceof Response) return g;
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const { cumplimiento } = await c.req.json().catch(() => ({}));
  const validos = ['por_atender', 'enviado', 'entregado'];
  if (!validos.includes(cumplimiento)) return c.json({ error: 'Estado inválido' }, 400);
  await db
    .update(orders)
    .set({ cumplimiento, updatedAt: new Date() })
    .where(eq(orders.id, id));
  return c.json({ ok: true });
});

// Admin: cancelar/reembolsar un pedido (repone stock y reintegra el dinero).
app.post('/api/admin/orders/:id/cancelar', async (c) => {
  const g = requireAdmin(c);
  if (g instanceof Response) return g;
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return c.json({ error: 'No encontrado' }, 404);
  if (order.estado === 'cancelado') return c.json({ ok: true, refund: 'none' });

  let refund: 'auto' | 'manual' | 'error' | 'none' = 'none';
  if (order.estado === 'pagado') {
    if (order.metodoPago === 'mercadopago' && order.mpPaymentId && c.env.MP_ACCESS_TOKEN) {
      try {
        await refundPayment(c.env.MP_ACCESS_TOKEN, order.mpPaymentId);
        refund = 'auto';
      } catch {
        refund = 'error'; // no se pudo reembolsar automáticamente (hacerlo manual)
      }
    } else if (order.metodoPago === 'cripto') {
      refund = 'manual'; // las cripto se devuelven manualmente desde tu wallet
    }
  }

  // Reponer stock si el pedido tenía stock comprometido
  if (order.estado === 'pagado' || order.estado === 'pendiente') {
    await restaurarStockPedido(db, id);
  }
  await db.update(orders).set({ estado: 'cancelado', updatedAt: new Date() }).where(eq(orders.id, id));
  return c.json({ ok: true, refund });
});

// Admin: todos los pedidos
app.get('/api/admin/orders', async (c) => {
  const g = requireAdmin(c);
  if (g instanceof Response) return g;
  const db = c.get('db');
  const os = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
  const result = [];
  for (const o of os) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const [buyer] = await db.select().from(users).where(eq(users.id, o.userId));
    result.push({ ...o, items, comprador: buyer ? { email: buyer.email, nombre: buyer.nombre } : null });
  }
  return c.json(result);
});

// --- Búsqueda de metadatos por ISBN (autocompletado) ---
app.get('/api/lookup/:isbn', async (c) => {
  const g = requireAdmin(c);
  if (g instanceof Response) return g;
  const meta = await lookupByIsbn(c.req.param('isbn'), c.env.GOOGLE_BOOKS_API_KEY);
  if (!meta) {
    return c.json(
      { error: 'No se encontraron datos para ese ISBN. Podés cargarlo a mano.' },
      404,
    );
  }
  return c.json(meta);
});

// ============================================================
//  PÚBLICO — Colección y Tienda (campos públicos)
// ============================================================

// Colección pública: todos los libros visibles (no archivados).
app.get('/api/collection', async (c) => {
  const db = c.get('db');
  const q = c.req.query('q')?.trim();
  const soloVenta = c.req.query('venta') === '1';

  const categoria = c.req.query('categoria');
  const conds = [sql`${books.estado} != 'archivado'`];
  if (q) conds.push(or(like(books.titulo, `%${q}%`), like(books.autores, `%${q}%`))!);
  if (categoria && ['infantil', 'juvenil', 'adulto'].includes(categoria))
    conds.push(eq(books.categoria, categoria as 'infantil' | 'juvenil' | 'adulto'));

  const rows = await db
    .select()
    .from(books)
    .where(and(...conds))
    .orderBy(desc(books.createdAt))
    .limit(1000);

  let result = rows.map(serializePublic);
  if (soloVenta) result = result.filter((b) => b.enVenta);
  return c.json(result);
});

// Tienda: solo libros comprables ahora (stock > 0 y con precio).
app.get('/api/store', async (c) => {
  const db = c.get('db');
  const q = c.req.query('q')?.trim();

  const categoria = c.req.query('categoria');
  const conds = [sql`${books.estado} != 'archivado'`, sql`${books.stockVenta} > 0`, sql`${books.precio} IS NOT NULL`];
  if (q) conds.push(or(like(books.titulo, `%${q}%`), like(books.autores, `%${q}%`))!);
  if (categoria && ['infantil', 'juvenil', 'adulto'].includes(categoria))
    conds.push(eq(books.categoria, categoria as 'infantil' | 'juvenil' | 'adulto'));

  const rows = await db
    .select()
    .from(books)
    .where(and(...conds))
    .orderBy(desc(books.createdAt))
    .limit(500);

  return c.json(rows.map(serializePublic));
});

// Ficha pública de un libro (cualquiera no archivado; marca si es comprable).
app.get('/api/collection/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const [row] = await db.select().from(books).where(eq(books.id, id));
  if (!row || row.estado === 'archivado') return c.json({ error: 'No disponible' }, 404);
  return c.json(serializePublic(row));
});

// ============================================================
//  ADMIN — catálogo completo (todo el inventario). Requiere rol admin.
// ============================================================

const adminGuard = async (c: any, next: any) => {
  const g = requireAdmin(c);
  if (g instanceof Response) return g;
  await next();
};
app.use('/api/books', adminGuard);
app.use('/api/books/*', adminGuard);

// --- Listado / búsqueda / filtro ---
app.get('/api/books', async (c) => {
  const db = c.get('db');
  const q = c.req.query('q')?.trim();
  const estado = c.req.query('estado');

  const conds = [];
  if (q) conds.push(or(like(books.titulo, `%${q}%`), like(books.autores, `%${q}%`), like(books.isbn, `%${q}%`)));
  if (estado && ESTADOS.includes(estado as Estado)) conds.push(eq(books.estado, estado as Estado));

  const rows = await db
    .select()
    .from(books)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(books.createdAt))
    .limit(500);

  return c.json(rows.map(serializeBook));
});

// --- Detalle ---
app.get('/api/books/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const [row] = await db.select().from(books).where(eq(books.id, id));
  if (!row) return c.json({ error: 'No encontrado' }, 404);
  return c.json(serializeBook(row));
});

// --- Crear ---
app.post('/api/books', async (c) => {
  const db = c.get('db');
  const body = await c.req.json().catch(() => ({}));
  const data = parseBookBody(body);
  if (!data.titulo) return c.json({ error: 'El título es obligatorio' }, 400);

  const [row] = await db.insert(books).values(data as any).returning();
  return c.json(serializeBook(row), 201);
});

// --- Actualizar ---
app.patch('/api/books/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const data = parseBookBody(body);
  data.updatedAt = new Date();

  const [row] = await db.update(books).set(data as any).where(eq(books.id, id)).returning();
  if (!row) return c.json({ error: 'No encontrado' }, 404);
  return c.json(serializeBook(row));
});

// --- Eliminar ---
app.delete('/api/books/:id', async (c) => {
  const db = c.get('db');
  const id = Number(c.req.param('id'));
  await db.delete(books).where(eq(books.id, id));
  return c.json({ ok: true });
});

// --- Subir foto (portada / ejemplar) a R2. Solo admin. ---
app.post('/api/uploads', async (c) => {
  const g = requireAdmin(c);
  if (g instanceof Response) return g;
  if (!c.env.BUCKET) return c.json({ error: 'Almacenamiento R2 no habilitado' }, 503);

  const contentType = c.req.header('content-type') ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) return c.json({ error: 'El archivo debe ser una imagen' }, 400);
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
        ? 'gif'
        : 'jpg';

  const body = await c.req.arrayBuffer();
  if (body.byteLength > 8 * 1024 * 1024) return c.json({ error: 'La imagen supera 8 MB' }, 413);

  const key = `${crypto.randomUUID()}.${ext}`;
  await c.env.BUCKET.put(key, body, { httpMetadata: { contentType } });
  // URL absoluta (la web vive en otro dominio) para usar directo en <img src>
  const base = c.env.SELF_URL ?? new URL(c.req.url).origin;
  return c.json({ url: `${base}/api/uploads/${key}` }, 201);
});

// --- Servir foto de portada desde R2 ---
app.get('/api/uploads/:key', async (c) => {
  if (!c.env.BUCKET) return c.notFound();
  const key = c.req.param('key');
  const obj = await c.env.BUCKET.get(key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000');
  return new Response(obj.body, { headers });
});

export default app;
