# Biblioteca Cordillera

Plataforma fullstack para indexar una biblioteca física y vender libros online.
Stack 100% Cloudflare + TypeScript.

🌐 **[biblioteca-cordillera.pages.dev](https://biblioteca-cordillera.pages.dev)**

## Funcionalidades

- **Catálogo personal** — alta de libros escaneando el ISBN por cámara (autocompletado vía Google Books + Open Library)
- **Estados** — archivado / disponible / en venta, con stock y precio configurable
- **Tienda pública** — vitrina de libros disponibles para compra
- **Carrito + Checkout** — con autenticación por Bearer token
- **Pagos** — MercadoPago (tarjetas) y criptomonedas via NOWPayments
- **Fotos de portada** — subida a Cloudflare R2
- **Pedidos** — panel de administración con historial y datos de envío

## Arquitectura

```
apps/web     React + Vite (PWA)    → Cloudflare Pages
apps/api     Hono en Workers       → D1 (datos) + R2 (fotos)
packages/db  Esquema Drizzle       → migraciones compartidas
```

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router, PWA |
| Escaneo ISBN | ZXing Browser (cámara del dispositivo) |
| Backend | Hono 4, Cloudflare Workers |
| ORM | Drizzle ORM |
| Base de datos | Cloudflare D1 (SQLite serverless) |
| Storage | Cloudflare R2 (fotos de portadas) |
| Auth | Bearer token, PBKDF2 (Web Crypto API) |
| Pagos | MercadoPago Checkout Pro + NOWPayments (cripto) |
| Monorepo | npm workspaces |

## Desarrollo local

```bash
npm install
npm run db:generate          # genera migración desde esquema Drizzle
npm run db:migrate:local     # aplica migración a D1 local

# Terminal 1 — API (http://localhost:8787)
npm run dev:api

# Terminal 2 — Web (http://localhost:5173)
npm run dev:web
```

## Deploy a producción

```bash
# API
npm run deploy --workspace=apps/api

# Web (Cloudflare Pages)
npm run build --workspace=apps/web
npx wrangler pages deploy apps/web/dist --project-name=biblioteca-cordillera
```

## Variables de entorno requeridas

Configurar como secrets en Wrangler:

```bash
npx wrangler secret put ADMIN_EMAIL        # email del administrador
npx wrangler secret put MP_ACCESS_TOKEN    # MercadoPago access token
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET
```

---

Desarrollado por [Aldo Escobar](https://hexa38.com) · Hexa38
