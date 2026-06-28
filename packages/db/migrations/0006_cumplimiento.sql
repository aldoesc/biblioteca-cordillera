-- Estado de cumplimiento/envío de cada pedido. Aditivo.
ALTER TABLE `orders` ADD `cumplimiento` text DEFAULT 'por_atender' NOT NULL;
