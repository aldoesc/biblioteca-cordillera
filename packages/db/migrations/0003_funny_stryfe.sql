-- Stock: agrega columnas de forma aditiva (sin recrear la tabla, sin perder datos).
-- Los libros existentes quedan con cantidad_total=1 y stock_venta=0 (no a la venta).
ALTER TABLE `books` ADD `cantidad_total` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `stock_venta` integer DEFAULT 0 NOT NULL;
