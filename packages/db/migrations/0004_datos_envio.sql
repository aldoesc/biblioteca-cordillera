-- Datos de entrega del comprador en cada pedido (aditivo, sin recrear tabla).
ALTER TABLE `orders` ADD `comprador_nombre` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `comprador_telefono` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `direccion_envio` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `ciudad` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `notas_envio` text;
