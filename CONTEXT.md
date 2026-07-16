# VIPBOX — Contexte détaillé

> Ce fichier complète CLAUDE.md. Consulter pour les détails sur tarifs, options, codes promo, paiement, emails, BDD, sécurité, blocage des disponibilités.

## Tarification saisonnière

### VIPBOX Classic
- Basse saison (jan–avr / oct–déc) : 340€
- Moyenne saison (mai–août) : 390€
- Haute saison (septembre) : 440€

### Smart
- Basse saison (oct–avr) : 290€
- Haute saison (mai–sep) : 340€

### Spinner 360°
- Prix fixe : 490€
- Option Forfait Confort : +260€

## Options par modèle

### VIPBOX Classic
- Pack Full Options Numériques (GIF + Boomerang + Livre d'or numérique + Boîte à questions) : 100€
- Mode GIF : 30€ / Mode Boomerang : 30€ / Mode Vidéo : 40€
- Boîte à questions : 60€ / Livre d'or numérique : 30€
- Personnalisation écran de veille : 30€
- Mise en page supplémentaire : 30€ / 2 MEP supplémentaires : 60€
- 400 tirages supplémentaires : 80€ / 800 tirages supplémentaires : 160€
- Ré-impression de toutes les photos : 80€

### Smart
- Pack Full Options Numériques : 60€
- Mode Boomerang : 30€ / Mode GIF : 30€
- Mise en page supplémentaire : 30€ / 2 MEP supplémentaires : 60€
- 400 tirages supplémentaires : 80€

### Spinner 360°
- Forfait Confort (livraison + installation + opérateur) : 260€

## Codes promo — ✅ implémenté (plus un placeholder)

- 3 types : remise fixe €, option(s) offertes (0€), ou les deux
- Validation réelle dans `lib/promo.ts` (`validatePromoCode()`, `getBestAutoPromoCode()`) — vérifie dates, quota global, quota par email, restriction géographique (PR/région)
- **Revalidé côté serveur à l'insertion finale** (`app/api/reservations/route.ts`) — le serveur ne fait jamais confiance à la remise calculée côté client, il rappelle `validatePromoCode()` lui-même avant d'enregistrer la réservation. Un code devenu invalide entre l'affichage et la soumission est ignoré silencieusement plutôt que de faire échouer la réservation.
- Store : `promoCode` (string), `promoEffect` ({ discountAmount, freeOptionIds[] })
- Changer de modèle remet le code à zéro
- Options offertes : badge "Offert" vert, non décochables

### Affichage automatique (yield management)
- `/api/promo/auto` applique automatiquement le meilleur code applicable à la date + lieu choisis, à l'étape Modèle
- Étape Modèle : prix affichés intègrent déjà la remise
- Étape Code promo : pré-rempli si code auto-appliqué, saisie manuelle possible

### Critères d'un code
- Plage de dates d'événement, plage de dates de réservation, PR/régions ciblés, quota global (`max_uses`), quota par email (`max_uses_per_user`), emails autorisés (`allowed_emails`), actif/inactif

### Table Supabase `promo_codes` (créée, en prod)
Colonnes réelles : `id`, `code`, `discount_amount`, `free_option_ids` (array), `booking_valid_from`/`booking_valid_until`, `event_valid_from`/`event_valid_until`, `allowed_pr_slugs` (array), `allowed_region_ids` (array), `max_uses`, `uses_count`, `max_uses_per_user`, `allowed_emails` (array), `active`

### Gestion
- Interface admin `/admin/codes-promo` (liste, création, activer/désactiver), protégée par l'auth cookie HMAC-SHA256

## Paiement — ⬜ toujours en attente (ne pas coder avant validation)

### Choix en attente
- **Option A — Stripe** : compte déjà client VIPBOX, ~1,5%+0,25€/transaction, 2x via Alma probable
- **Option B — Crédit Agricole CAWL** : produit joint-venture CA+Worldline (2024), distinct de l'ancien "E-transactions" utilisé sur vipboxbooking.com/photoshaker.com — mail envoyé au Chargé d'Affaires CA le 2026-07-02 (tarifs, 2x natif ?, accès preprod), réponse toujours attendue
- Architecture envisagée si CAWL retenu : Hosted Checkout Page, SDK `@worldline-solutions/sdk-nodejs` côté serveur, env preprod gratuite sur `signup.preprod.cawl-solutions.fr`
- CGV à accepter à l'étape Paiement

### Variables d'env Stripe (si retenu)
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

### Variables d'env CAWL (si retenu)
- `CAWL_API_KEY`, `CAWL_API_SECRET`, `CAWL_PSPID`

### État du code
- Étape 8 (Paiement) : placeholder (`Paiement.tsx`), rien n'est réellement encaissé
- `app/api/webhooks/payment/route.ts` : stub, signature à implémenter selon le prestataire retenu — **ne peut pas être fait avant la décision**, le mécanisme de vérification diffère entre les deux prestataires
- `lib/payment-handler.ts` : orchestrateur post-paiement déjà écrit (`handleSuccessfulPayment()` — update Supabase, création/liaison compte mon-espace, envoi des 2 emails), mais jamais déclenché en conditions réelles puisqu'aucun webhook ne l'appelle encore
- Double écriture CRM (`postToCrm()` dans `lib/crm.ts`, mapping complet et testé) : pas encore câblée dans `payment-handler.ts`, prévu dès que le paiement est intégré

## Emails transactionnels — ✅ implémenté et testé

### Infrastructure
- Envoi via **Brevo API v3** (confirmé, pas "vraisemblablement") — `BREVO_API_KEY` en `.env.local`, domaine `vip-box.fr` vérifié dans Brevo
- Expéditeur : `reservation@vip-box.fr` (nom affiché : VIPBOX)
- Déclenchement prévu : webhook paiement → `handleSuccessfulPayment()` (`lib/payment-handler.ts`) → 2 emails en `Promise.allSettled` — **pas encore actif en pratique**, le webhook réel n'existe pas tant que le prestataire de paiement n'est pas choisi
- Toutes les valeurs utilisateur interpolées dans le HTML sont échappées (fonction `esc()` dans `lib/email.ts`) — pas de risque XSS-in-email

### Email client (`sendClientConfirmationEmail`)
- Récapitulatif complet : date, PR + adresse + horaires + téléphone, modèle, options (offertes en vert avec "(Offert)", payantes en noir), code promo + détail remise, total
- Section "mon-espace" : identifiant (email) + mot de passe (en clair si nouveau compte, "votre mot de passe habituel" si compte existant) + lien de connexion `mon-espace.vip-box.fr/login`
- Objet et texte d'intro personnalisables via `/admin/emails` (variables `{date}` `{prenom}` `{nom}`), valeurs par défaut sinon

### Email interne (`sendInternalNotificationEmail`)
- Sections : Réservation (date, PR, modèle, options, promo, total) · Client (nom, email, tél, adresse) · Mon-espace (nouveau/existant, ID vipbox_users) · Références (ID CRM si dispo, ID Supabase)
- Destinataires personnalisables via `/admin/emails` (liste séparée par virgules), défaut `julien@vip-box.fr`

### Interface admin `/admin/emails`
- Configure destinataires internes, objet + intro de l'email client — stocké dans la table Supabase `settings` (`lib/settings.ts`, `getSetting`/`setSetting`)

## Sécurité — ✅ implémenté (2026-07-09)

### Cloudflare Turnstile (anti-bot)
- Widget invisible (`appearance: "interaction-only"`), séparé du widget du formulaire de contact WP (domaines différents → paires de clés différentes)
- `lib/turnstile.ts` (`verifyTurnstileToken()`) vérifie le token côté serveur avant tout insert ; no-op (toujours `true`) si `TURNSTILE_SECRET_KEY` absent, pour ne jamais bloquer un client tant que les clés ne sont pas configurées
- En local : clés de test officielles Cloudflare (`1x00000000000000000000BB` / secret associé) — "always passes, invisible", d'où l'absence totale d'UI visible en dev, comportement normal et non un bug
- Clés réelles pour `reservation.vip-box.fr` : à créer et renseigner en prod (constantes commentées dans `.env.local`)

### Anti-spam volumétrique (rate limiting)
- Table Supabase `rate_limit_hits` (`bucket` text, `created_at`) — pas de mémoire partagée fiable entre invocations serverless Vercel, d'où un stockage externe plutôt que des transients
- `lib/rate-limit.ts` (`checkRateLimit()`) : fenêtre glissante, auto-nettoyante
- Sur `POST /api/reservations` : 5 réservations/heure/IP, 3 réservations/jour/email (protège contre le harcèlement d'un tiers via l'email de confirmation)
- Ordre des vérifications : Turnstile d'abord, puis rate limit IP, puis rate limit email — volontaire, pour ne pas laisser un attaquant griller le quota d'un tiers avec un token invalide

### Intégrité des données à l'insertion (`POST /api/reservations`)
Le serveur ne fait confiance à **aucune donnée financière** envoyée par le navigateur — tout est recalculé côté serveur avant insertion :
- `model_price` recalculé via `getModelPrice(model_slug, event_date)`, jamais lu depuis le corps de la requête
- Options payantes revalidées contre le catalogue du modèle choisi (rejet 400 si un ID d'option n'appartient pas à ce modèle)
- Code promo revalidé via `validatePromoCode()` (même logique que `/api/promo/validate`)
- `total_amount = model_price + optionsTotal − discount`, calculé uniquement côté serveur
- `status` forcé à `"en_attente"` côté serveur quoi que le client envoie
- Coordonnées client (email, champs requis) validées côté serveur, pas seulement côté formulaire
- `PATCH /api/reservations` verrouillé : whitelist stricte des champs modifiables (`stripe_payment_intent_id` seulement), et seulement si `status = 'en_attente'` (une réservation finalisée ne peut plus être modifiée par cette route)

### Routes de test
- `/api/test-crm`, `/api/test-email` : protégées par un garde `NODE_ENV === "production"` (renvoient 403 en prod, fonctionnent en dev)
- `/api/test-crm`, `/api/test-email`, `/admin/test-email` : **à supprimer avant la mise en prod définitive**, cleanup pas encore fait (pas urgent, déjà sans risque actif)

## Blocage des disponibilités — ✅ implémenté avec les vraies données CRM (2026-07-16)

### Principe
Empêcher les doubles réservations sur une combinaison PR + modèle + date déjà confirmée (payée). Vérifié à l'**étape Modèle** (premier moment où on connaît date + PR + modèle) : carte grisée "Non disponible" si le modèle est complet à cette date/lieu ; si tous les modèles du PR sont complets, message + boutons "Changer de lieu"/"Changer de date".

### Mécanisme
- `lib/availability.ts` : `getModelCapacity(pickupPoint, modelSlug)` lit la capacité réelle sur la fiche CRM (`point_retrait.reservation_maximum_classic/_smart/_360`) via `pickupPoint.crmId` ; `countPaidReservations()` compte les réservations Supabase `status='payé'` pour ce PR+modèle+date exacte ; `checkModelsAvailability()` combine les deux
- `app/api/availability/route.ts` : route serveur appelée par `ModelSelector.tsx` au chargement de l'étape
- Philosophie "fail open" : capacité inconnue (PR non rapproché du CRM, fiche sans valeur) ou erreur CRM → traité comme disponible, ne bloque jamais un client réel (même principe que Turnstile/rate-limit)
- Cache CRM 1h pour cette lecture (`getCrmPickupPointCapacity()` dans `lib/crm.ts`) — une capacité modifiée par Julien met jusqu'à 1h à se répercuter côté tunnel, acceptable pour cette donnée

### Source de capacité — colonnes CRM réelles
Les 3 colonnes `reservation_maximum_classic`/`_smart`/`_360` ont été ajoutées par Joris sur `point_retrait` (type `integer`) et sont éditables dans `/admin/disponibilites`. Les champs CRM `stock_theorique`/`stock_maximum` restent explicitement écartés (ne représentent pas la capacité de réservation simultanée).

### Rapprochement WP ↔ CRM — via `id_base` (ACF), pas le code postal
Le rapprochement par code postal (`matchCrmPr`) s'est révélé peu fiable : plusieurs PR CRM peuvent légitimement partager un même code postal (partenariats Zodio, PR dupliqués type "Saint-Nazaire II"), et certaines fiches CRM ont des champs `code_postal`/`ville` vides ou inversés. Remplacé par un champ ACF `id_base` sur chaque PR WP, contenant directement `point_retrait.ID` côté CRM — lien explicite et fiable, exposé via l'API REST par le mu-plugin `vipbox-api.php` (`C:\Users\Julien\OneDrive\Bureau\Claude Code\mu-plugins\vipbox-api.php`, à redéployer manuellement sur le serveur WP en cas de modification). Résolu dans `getPickupPoints()` (`lib/wordpress.ts`).

## Base de données — CRM serveurdms.com

- API REST (php-crud-api) : `https://api.serveurdms.com/api.php`
- Doc : https://github.com/mevdschee/php-crud-api
- Credentials : `.env.local` uniquement (`CRM_API_URL`, `CRM_API_USER`, `CRM_API_PASSWORD`)
- Schéma complet consultable via `GET /api.php/openapi` (utile pour explorer les tables/colonnes sans avoir à demander)
- Table `prestations` (~34 000 lignes) : toutes les commandes historiques, tous canaux confondus (vipboxbooking.com, photoshaker.com, tunnel...)

### Champ `type_animation_choisie` — convention confirmée (2026-07-09)
Trouvée par inspection directe de vraies données existantes (pas par supposition) : `"Photobooth"` = Classic, `"Smart"` = Smart, `"360"` = Spinner 360°. Le code (`lib/crm.ts`, `getTypeAnimationChoisie()`) utilise désormais ces valeurs exactes — avant ce fix, Classic et Smart étaient tous deux écrits comme `"Photobooth"`, faussant les rapports internes distinguant les modèles.

### Table `point_retrait`
Champ `materiel` : liste (séparée par virgule) des modèles proposés par ce PR (`vipbox_classic`, `smart`, etc.). Champs `stock_theorique`/`stock_maximum` : existent mais ne représentent PAS la capacité de réservation simultanée (écartés pour le blocage des disponibilités, voir section dédiée). `commercial_b2b_id` : routage commercial B2B (539=Marie, 795=Emma).

### `lib/crm.ts` — état
- `postToCrm(input, table)` : mapping complet et testé (table `prestations` ou `prestations_test`), pas encore appelé depuis `payment-handler.ts`
- `commercial` hardcodé à 595 pour toutes les commandes tunnel (indépendant du routage 539/795/669 utilisé côté formulaire de contact WP)
- En cas d'échec écriture CRM : ne doit jamais bloquer le client (pas encore vérifié en conditions réelles puisque pas câblé)

## Formulaire de contact WP (vip-box.fr/contact) — projet séparé, quasi terminé

Mu-plugin WordPress indépendant (`vipbox-contact-mu-plugin/`, hors du repo tunnel), remplace à terme l'ancien formulaire de Joris sur `/contact`. Détail complet dans la mémoire de session — résumé utile ici :
- Sécurité auditée et jugée solide (nonce CSRF, honeypot, Turnstile, rate-limit, échappement XSS, validation serveur) — rien à corriger côté code
- Turnstile actif (clés créées par Julien), bug d'espacement du widget invisible corrigé (`margin: -30px` sur `.vipbox-turnstile-wrap` pour compenser la non-fusion des marges causée par `overflow:hidden`)
- **Seul point réellement en attente** : bascule vers la vraie page `/contact` (remplacer l'ancien formulaire) + passage simultané de `VIPBOX_CONTACT_TEST_MODE` à `false` (restaure le vrai routage email équipe + rate-limiting + coupe les messages de debug) — les deux vont ensemble, ne pas faire l'un sans l'autre
- Le tunnel redirige déjà les clics "Professionnel" vers `vip-box.fr/contact/?type=pro` (`ProfileCards.tsx`) — ce lien atterrit sur l'ANCIEN formulaire de Joris tant que la bascule ci-dessus n'est pas faite
- La page interne `/pro` du tunnel (`app/pro/page.tsx`) n'est plus utilisée depuis ce changement — fichier orphelin, à supprimer un jour par propreté (pas fait, sans urgence)

## Photos modèles
- VIPBOX Classic : https://www.vip-box.fr/wp-content/uploads/2026/04/Classic-Oai-1-air.jpg
- Smart : https://www.vip-box.fr/wp-content/uploads/2026/04/Smart-Oai-1-air.jpg
- Spinner 360° : https://www.vip-box.fr/wp-content/uploads/2026/04/Spinner-Oai-1-air.jpg
