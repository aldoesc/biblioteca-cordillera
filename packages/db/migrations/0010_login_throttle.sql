-- Limitador de intentos de login (anti fuerza bruta).
CREATE TABLE `login_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`reset_at` integer NOT NULL
);
