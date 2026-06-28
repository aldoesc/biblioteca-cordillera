-- Medio de pago de cada pedido (mercadopago / cripto). Aditivo.
ALTER TABLE `orders` ADD `metodo_pago` text DEFAULT 'mercadopago' NOT NULL;
