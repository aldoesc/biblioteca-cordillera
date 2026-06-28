import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Tabla núcleo de la Fase 1: cada fila es un libro físico de la biblioteca.
 *
 * `estado` separa los tres casos que pidió el dueño:
 *   - 'archivado'  : lo tengo, registrado, pero no lo muestro/ofrezco
 *   - 'disponible' : disponible (p.ej. para préstamo) pero NO a la venta
 *   - 'en_venta'   : a la venta; en este caso `precio` debería tener valor
 *
 * `precio` es nullable a propósito: un libro puede existir sin precio.
 */
export const books = sqliteTable('books', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  // Identificación y metadatos (autocompletados por ISBN cuando se puede)
  isbn: text('isbn'),
  titulo: text('titulo').notNull(),
  autores: text('autores'), // JSON: string[]
  anio: integer('anio'),
  editorial: text('editorial'),
  idioma: text('idioma'),
  numPaginas: integer('num_paginas'),
  categoria: text('categoria', { enum: ['infantil', 'juvenil', 'adulto'] }),
  portadaUrl: text('portada_url'),
  fotos: text('fotos'), // JSON: string[] — fotos adicionales (tomos, estado, detalles)
  resena: text('resena'),

  // Visibilidad en la colección pública:
  //   'disponible' = visible en mi colección (la tenga o no a la venta)
  //   'archivado'  = oculta (no aparece en colección ni tienda)
  // (Los valores 'en_venta'/'vendido' quedan por compatibilidad; la venta hoy
  //  la maneja el stock, no el estado.)
  estado: text('estado', { enum: ['archivado', 'disponible', 'en_venta', 'vendido'] })
    .notNull()
    .default('disponible'),

  // Stock: cuántas copias poseo en total y cuántas de esas están a la venta.
  // copias personales = cantidadTotal - stockVenta. A la venta si stockVenta > 0.
  cantidadTotal: integer('cantidad_total').notNull().default(1),
  stockVenta: integer('stock_venta').notNull().default(0),

  precio: real('precio'), // precio unitario de venta; NULL = sin precio asignado
  moneda: text('moneda').notNull().default('PEN'),

  // Datos físicos
  condicion: text('condicion'), // p.ej. 'nuevo', 'usado-bueno', 'usado-regular'
  ubicacionFisica: text('ubicacion_fisica'), // estante / caja para encontrarlo
  notas: text('notas'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;

/** Usuarios de la tienda. El primer registro con el email admin se vuelve 'admin'. */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  nombre: text('nombre'),
  passwordHash: text('password_hash').notNull(),
  rol: text('rol', { enum: ['admin', 'cliente'] }).notNull().default('cliente'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Sesiones: token aleatorio asociado a un usuario (auth por Bearer token). */
export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

/** Ítems del carrito de cada usuario. */
export const cartItems = sqliteTable('cart_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bookId: integer('book_id')
    .notNull()
    .references(() => books.id, { onDelete: 'cascade' }),
  cantidad: integer('cantidad').notNull().default(1),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Pedidos generados al iniciar un checkout. */
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  estado: text('estado', { enum: ['pendiente', 'pagado', 'fallido', 'cancelado'] })
    .notNull()
    .default('pendiente'),
  // Estado de cumplimiento/envío (una vez pagado)
  cumplimiento: text('cumplimiento', { enum: ['por_atender', 'enviado', 'entregado'] })
    .notNull()
    .default('por_atender'),
  // Medio de pago usado
  metodoPago: text('metodo_pago', { enum: ['mercadopago', 'cripto'] })
    .notNull()
    .default('mercadopago'),
  total: real('total').notNull(),
  moneda: text('moneda').notNull().default('PEN'),
  mpPreferenceId: text('mp_preference_id'),
  mpPaymentId: text('mp_payment_id'),

  // Datos de entrega que completa el comprador antes de pagar
  compradorNombre: text('comprador_nombre'),
  compradorTelefono: text('comprador_telefono'),
  direccionEnvio: text('direccion_envio'),
  ciudad: text('ciudad'),
  notasEnvio: text('notas_envio'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Ítems de cada pedido. Guarda título y precio "congelados" al momento de la compra. */
export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  bookId: integer('book_id').references(() => books.id, { onDelete: 'set null' }),
  titulo: text('titulo').notNull(),
  precioUnitario: real('precio_unitario').notNull(),
  cantidad: integer('cantidad').notNull().default(1),
});

/** Libro de Reclamaciones (Perú / INDECOPI). */
export const reclamos = sqliteTable('reclamos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tipo: text('tipo', { enum: ['reclamo', 'queja'] }).notNull().default('reclamo'),
  // Consumidor
  nombre: text('nombre').notNull(),
  tipoDocumento: text('tipo_documento'),
  documento: text('documento'),
  domicilio: text('domicilio'),
  telefono: text('telefono'),
  email: text('email'),
  // Bien contratado
  bien: text('bien'), // producto / servicio
  monto: real('monto'),
  // Detalle
  detalle: text('detalle').notNull(),
  pedidoConsumidor: text('pedido_consumidor'),
  estado: text('estado', { enum: ['pendiente', 'atendido'] }).notNull().default('pendiente'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Limitador de intentos de login (anti fuerza bruta), por IP. */
export const loginThrottle = sqliteTable('login_throttle', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: integer('reset_at', { mode: 'timestamp' }).notNull(),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Reclamo = typeof reclamos.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
