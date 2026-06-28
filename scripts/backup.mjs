// Exporta la base D1 de producción a un archivo .sql con fecha, en /backups.
// Uso: npm run backup
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'backups');
mkdirSync(dir, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = join(dir, `biblioteca-${ts}.sql`);

console.log('Exportando base D1 a:', out);
execSync(`npx wrangler d1 export biblioteca --remote --output "${out}"`, {
  stdio: 'inherit',
  cwd: join(root, 'apps', 'api'),
});
console.log('✅ Backup completo.');
