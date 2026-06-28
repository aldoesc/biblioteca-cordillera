-- Libro de Reclamaciones (Perú).
CREATE TABLE `reclamos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tipo` text DEFAULT 'reclamo' NOT NULL,
	`nombre` text NOT NULL,
	`tipo_documento` text,
	`documento` text,
	`domicilio` text,
	`telefono` text,
	`email` text,
	`bien` text,
	`monto` real,
	`detalle` text NOT NULL,
	`pedido_consumidor` text,
	`estado` text DEFAULT 'pendiente' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
