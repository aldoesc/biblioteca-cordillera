import { defineConfig } from 'drizzle-kit';

// Genera el SQL de migración a partir del esquema.
// Aplicamos el SQL a D1 con wrangler (ver apps/api), no con drizzle directamente.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './migrations',
});
