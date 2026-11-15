#pragma once
/**
 * Port série d'usine (UART0) — ouvert UNIQUEMENT tant que le boîtier n'a pas de numéro de série.
 * Trois commandes, une par ligne :
 *   BB50 INFO                 → BB50 INFO {"fw":"…","pub":"04…","pin":"123456"}
 *   BB50 POP <défi 64 hex>    → BB50 POP <signature DER hex>   (preuve de possession de la clé)
 *   BB50 SERIAL <BB50V1-A01>  → BB50 OK BB50V1-A01, puis redémarrage (numéro écrit une seule fois)
 * La clé privée n'est jamais affichée ; rien d'autre n'est signé sur demande.
 */
void factory_console_start(void);
