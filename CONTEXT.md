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
- **Revalidé côté serveur à l'insertion finale** (`app/api/reservations/route.ts`) — le serveur ne fait jamais confiance à la remise calculée côté client, il rappelle `validatePromoCode()` lui-même avant d'enregistrer la réservation. Un code devenu invalide entre l'affichage et la soumission (ex. quota par e-mail, vérifiable seulement une fois l'e-mail connu) ne fait pas échouer la réservation, mais **le client en est désormais informé** (écran dédié dans `CoordonneesForm.tsx` avec le total corrigé, voir bug du 2026-09-03 plus bas) — plus un rejet totalement silencieux comme avant.
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

## Paiement — 🔶 CAWL en cours de mise en place, environnement de test accessible dès maintenant

### Choix — CAWL très probable, réponse du CA reçue (2026-08-31)
- **Option A — Stripe** : compte déjà client VIPBOX, ~1,5%+0,25€/transaction, 2x via Alma probable
- **Option B — Crédit Agricole CAWL** : mail envoyé au Chargé d'Affaires CA le 2026-07-02, **réponse reçue le 2026-08-31** (Pascal MICHAUX, Analyste Expert Flux, CA Provence Côte d'Azur — tél. 04 89 32 32 32 choix 3). Fiche de renseignements retournée par Julien le même jour (dirigeant renseigné : **Guillaume Serfaty**, pas Julien — contact technique/interlocuteur reste Julien ; URL boutique : `reservation.vip-box.fr` ; solution technique : Next.js ; offre choisie : **Par abonnement**)
- Tarifs confirmés (`TARIFICATION.pdf`) :
  - **À l'usage** : 1,2 % + 0,20 €/transaction (mini perception 10 €/mois), pas d'abonnement — adapté aux volumes < 7 500 €/mois
  - **Par abonnement** (recommandé, et cohérent avec le volume VIPBOX ~650 k€/an ≈ 54 k€/mois, largement au-dessus du seuil) : 0,8 % + 0,20 €/transaction + 29 € HT/mois — moins cher par transaction que Stripe (~1,5 %+0,25 €) au-delà d'un faible volume
- Compte pro CA requis depuis 2 ans minimum — déjà le cas (RIB fourni : SARL DREAMAKERS, agence C.A. Antibes Pro, IBAN `FR76 1910 6006 0243 6431 5800 185`, BIC `AGRIFRPP891`)
- CGV à accepter à l'étape Paiement

### ✅ Environnement de test accessible dès maintenant, sans attendre la signature (vérifié 2026-08-31)
- Inscription gratuite : **`https://signup.preprod.cawl-solutions.fr/`** — une simple adresse email suffit, ni SIRET ni contrat signé nécessaires
- Une fois le compte créé : portail de test (`https://portail.preprod.cawl-solutions.fr/`), explorateur d'API (`https://explorer.ecommerce.cawl-solutions.fr/`), documentation complète (`https://docs.ecommerce.cawl-solutions.fr/fr/`)
- **SDK Node.js confirmé disponible** côté serveur (cohérent avec la stack Next.js), ainsi que PHP/Java/.NET/Python/Ruby ; SDK client JS/Android/Swift/Flutter/React Native si besoin plus tard
- **Compte test créé par Julien** (peu après le 2026-08-31) — intégration technique démarrable

### ✅ Identifiants de test confirmés et fonctionnels dans `.env.local`
`CAWL_API_KEY_ID` et `CAWL_SECRET_API_KEY` récupérés par Julien dans le portail marchand (onglet Développeur → API de paiement). Le **PSPID (identifiant marchand) n'était affiché nulle part dans le portail** — deviné (`VIPBOX`) puis **confirmé par un vrai appel à l'API** (`services.testConnection`, sans effet de bord) : `VIPBOX`/`vipbox`/`Vipbox` répondent `200 {"result":"OK"}`, une variante avec tiret (`vip-box`) répond `403 ACCESS_TO_MERCHANT_NOT_ALLOWED` — donc pas un faux positif, l'API distingue vraiment. `CAWL_PSPID=VIPBOX` dans `.env.local`.

### Architecture technique CAWL confirmée (doc officielle + test réel, pas une supposition)
- **Package npm réel : `onlinepayments-sdk-nodejs`** — ⚠️ corrige une erreur précédente de ce fichier qui indiquait `@worldline-solutions/sdk-nodejs` (jamais vérifié, faux)
- Init du SDK : `sdk.init({ integrator, host, scheme: 'https', port: 443, apiKeyId, secretApiKey })` → `client.hostedCheckout`, `client.services`, etc.
  - `host` preprod : `payment.preprod.cawl-solutions.fr` — prod : `payment.cawl-solutions.fr`
- Flux Hosted Checkout Page :
  1. `POST /v2/{merchantId}/hostedcheckouts` (`merchantId` = `CAWL_PSPID`) avec `order.amountOfMoney.{currencyCode,amount}` (montant en **centimes**), `hostedCheckoutSpecificInput.{returnUrl,locale,sessionTimeout,allowedNumberOfPaymentAttempts}`
  2. Réponse : `hostedCheckoutId` + `redirectUrl` (valable 3h) → rediriger le client dessus
  3. Retour client sur `returnUrl` ; statut interrogeable via `GET /v2/{merchantId}/hostedcheckouts/{hostedCheckoutId}` (`statusOutput.statusCode`)
  4. Webhook en complément (le client peut fermer l'onglet avant le retour)
  5. `client.services.testConnection(merchantId)` (`GET /v2/{merchantId}/services/testconnection`) : vérif légère sans effet de bord, pratique pour tester la config sans créer de vraie session
- Doc consultée : `docs.ecommerce.cawl-solutions.fr/fr/integration/basic-integration-methods/hosted-checkout-page` et `.../server-sdks/nodejs`
- Variables d'env confirmées dans `.env.local` : `CAWL_API_KEY_ID`, `CAWL_SECRET_API_KEY`, `CAWL_PSPID`, `CAWL_HOST`

### ✅ Intégration codée et testée en conditions réelles (préprod) — 2026-09
Package `onlinepayments-sdk-nodejs` installé (dépendance réelle du projet). Flux complet créé, testé de bout en bout côté serveur (création de session réelle contre l'API CAWL, `redirectUrl` obtenue, `stripe_payment_intent_id` bien enregistré, page de retour vérifiée en état "pending" avant paiement) :
- `lib/cawl.ts` : `createCawlCheckout()` / `getCawlCheckoutResult()` — wrapper SDK
- `app/api/cawl/create-checkout/route.ts` : crée la session (montant repris de la ligne Supabase déjà validée à la création de la réservation, jamais du client), stocke `hostedCheckoutId` dans `reservations.stripe_payment_intent_id` (**champ réutilisé tel quel** — pas de migration de schéma, nom trompeur mais volontaire pour rester dans le périmètre demandé)
- `components/reservation/Paiement.tsx` : vrai bouton, crée la session puis redirige
- `app/reservation/paiement/retour/page.tsx` : page de retour CAWL — confirmation **principale** (vérifie le statut réel auprès de CAWL avec nos identifiants serveur, pas besoin de signature webhook pour ce chemin) ; appelle `handleSuccessfulPayment()` si payé, affiche "en cours"/"échoué" sinon avec repli
- `lib/payment-handler.ts` : garde-fou d'idempotence ajouté (`if (r.status === "payé") return;`) — nécessaire car webhook + page de retour peuvent tous les deux appeler `handleSuccessfulPayment()` pour la même réservation
- `app/api/webhooks/payment/route.ts` : implémentation réelle (parsing événement CAWL, retrouve la réservation via `hostedCheckoutId`, appelle `handleSuccessfulPayment()`) — **filet de sécurité, pas le chemin principal**. Vérification de signature via `sdk.webhooks` (SDK officiel) — **fail closed** tant que `CAWL_WEBHOOK_KEY_ID`/`CAWL_WEBHOOK_SECRET_KEY` ne sont pas renseignés (absents de `.env.local` au 2026-09, à récupérer par Julien dans le portail marchand → Développeur → Webhooks) : la route rejette (503) plutôt que de faire confiance à un événement non vérifié
- ⚠️ Mapping `paymentStatusCategory` (`SUCCESSFUL`/`REJECTED`/etc.) basé sur les conventions Worldline standard, **seul l'état "avant tout paiement" (`IN_PROGRESS`) a été vérifié empiriquement** — à confirmer avec un vrai paiement de test avant la mise en prod définitive
- **Cartes de test CAWL** (préprod uniquement) : Visa `4330264936344675`, Mastercard `5137009801943438`, Amex `371449635311004` — date d'expiration future quelconque, CVV 3-4 chiffres quelconques ; pour simuler un refus, utiliser un montant de 13,02 € avec l'une de ces cartes. **Confirmée fonctionnelle en vrai paiement navigateur le 2026-09-03** : la carte Visa `4330264936344675` a d'abord été rejetée par la page CAWL lors d'un premier essai (cause non identifiée avec certitude — probablement saisie/date d'expiration), puis **acceptée sans problème lors du paiement réel réussi qui a suivi** — le numéro lui-même est donc bon, pas la peine d'en chercher un autre.
- **Bug montant 390€/440€ (prix saisonnier périmé) — diagnostiqué et corrigé à la racine le 2026-09-03.** Symptôme initial : `Paiement.tsx` affichait 390 € alors que CAWL demandait 440 € pour le même paiement — et Julien a fait remarquer que le 390 € était en fait déjà affiché dès le Récapitulatif (avant Paiement). 440 € est le prix objectivement correct pour une date de septembre (haute saison, voir `lib/models.ts`). Cause racine : le lien "Modifier" du Récapitulatif renvoie vers `/reservation/date` sans passer par `resetFrom()` (qui n'est déclenché que par la navigation `StepIndicator`) ; `setEventDate()` dans `lib/store.ts` ne recalculait pas le prix du modèle déjà sélectionné, qui restait donc figé sur le prix de l'ancienne date. **Fix** (`lib/store.ts` uniquement) : `setEventDate()` recalcule désormais `model.price` via `getModelPrice(model.slug, date)` à chaque changement de date si un modèle est déjà choisi — corrige l'affichage à toutes les étapes (Modèle, Récap, Paiement) d'un seul coup, en gardant `Paiement.tsx` sur le même calcul client simple que `Recapitulatif.tsx` (pas de round-trip serveur ajouté : une piste explorée puis abandonnée comme inutilement complexe une fois la vraie cause corrigée).
- **Bug montant 300€/350€ (code promo réutilisé) — diagnostiqué et corrigé le 2026-09-03, même jour.** Nouveau test de Julien après le fix ci-dessus : Récap et Paiement affichaient 300 €, mais la page CAWL demandait 350 €. Cause : contrairement au bug précédent, ce n'était pas un problème de fraîcheur du store — le code promo `TEST1A` (remise 50 €, `max_uses_per_user: 1`) avait déjà été utilisé par cette même adresse e-mail lors de tests antérieurs. `validatePromoCode()` (`lib/promo.ts`) ne peut vérifier ce quota par e-mail qu'une fois l'e-mail connu (`if (customerEmail && pc.max_uses_per_user > 0) ...`) — or l'étape Code promo (où le code est saisi et affiché comme valide) précède l'étape Coordonnées (où l'e-mail est collecté) dans le tunnel. Le code s'affichait donc comme valide partout jusqu'au Récapitulatif inclus, puis était silencieusement rejeté à la création de la réservation (`POST /api/reservations`, commentaire déjà présent dans le code : *"Code invalide/expiré entre l'affichage et la soumission → ignoré silencieusement"*) — total serveur recalculé sans la remise (350 €), sans que le client n'en soit informé, d'où l'écart avec le Récap/Paiement restés à 300 €. **Fix** : `POST /api/reservations` renvoie désormais aussi `promoCodeApplied`/`promoDiscountApplied`/`totalAmount` dans sa réponse ; `CoordonneesForm.tsx` compare `promoCodeApplied` au code envoyé et, s'il diffère (= rejeté), corrige immédiatement le store (`applyPromoCode(promoCode, null)`, sans recréer de réservation) et affiche un écran explicite ("Le code promo n'a pas pu être appliqué — nouveau total : X €") avant de laisser continuer vers Paiement, plutôt que de laisser le client découvrir un montant différent à l'étape suivante. Réutilise le même `id` déjà créé, pas de double insertion.
- Le montant réellement facturé par CAWL a, dans les deux bugs ci-dessus, **toujours été correct** (recalculé côté serveur dans `/api/reservations` POST, jamais depuis le client) — seul l'affichage pouvait être trompeur avant ces deux fix.
- **Ajustements de politique suite au bug ci-dessus (décidés avec Julien, 2026-09-03)** :
  1. `max_uses_per_user` sur les codes promo passe d'un défaut de 1 (valeur pré-remplie du formulaire admin, jamais un choix métier délibéré) à **illimité par défaut** (`null`), même convention que `max_uses` — reste réglable au cas par cas. Touche `lib/promo.ts`, `types/index.ts`, `NewPromoForm.tsx`, `app/api/admin/codes-promo/route.ts`. ⚠️ **Nécessite une migration manuelle en base, pas encore exécutée au moment de l'écriture** — colonne encore `not null default 1` tant que Julien n'a pas lancé dans l'éditeur SQL Supabase : `alter table promo_codes alter column max_uses_per_user drop not null, alter column max_uses_per_user drop default;` (voir aussi `supabase/schema.sql`, mis à jour en conséquence). Codes existants (`TEST1A`/`TEST1B`) laissés inchangés (valeur explicite 1), seul le défaut pour les *nouveaux* codes change.
  2. Limite anti-spam sur `POST /api/reservations` : 3 → **10 réservations / e-mail / 24h** (`app/api/reservations/route.ts`) — 3 bloquait trop vite un usage légitime répété (et gênait les tests de Julien).

### Variables d'env Stripe (si retenu)
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

### État du code
- Étape 8 (Paiement) : ✅ codée (CAWL), **premier paiement réel de bout en bout réussi le 2026-09-03** (redirection CAWL → carte de test → retour → page de confirmation), bugs de montant corrigés (voir ci-dessus)
- `lib/payment-handler.ts` : orchestrateur post-paiement (`handleSuccessfulPayment()` — update Supabase, création/liaison compte mon-espace, envoi des 2 emails) — **déclenché en conditions réelles pour la première fois** via la page de retour paiement le 2026-09-03 : statut bien passé à "payé" en base, mais **les 2 emails de confirmation n'ont pas été reçus par Julien**. Diagnostic : rejoué manuellement en local (script `tsx` ponctuel, supprimé après usage) exactement le même appel (`findOrCreateMonEspaceAccount` + les 2 envois Brevo) pour cette réservation réelle → **tout fonctionne en local sans erreur** (compte mon-espace retrouvé, 2 emails `fulfilled`, réellement envoyés). **Confirmé par Julien : les 2 emails (client + admin) ont bien été reçus** (déclenchés par ce test de diagnostic, pas par le paiement original) et la réservation est apparue dans `/admin/reservations` une fois le bug de cache ci-dessous corrigé. Cause du non-envoi original toujours non confirmée avec certitude (probablement `BREVO_API_KEY` pas encore dupliquée sur Vercel au moment de ce tout premier paiement réel — même défaut déjà rencontré pour `CRM_API_*` et les 4 `CAWL_*`) — **à surveiller sur le prochain vrai paiement** : si l'email ne part toujours pas tout seul, vérifier Vercel → Environment Variables → `BREVO_API_KEY`.
- ✅ **Bug de cache trouvé ET corrigé le 2026-09-03 : `/admin/reservations` (et `/admin/codes-promo`, même défaut) pouvait afficher des données périmées jusqu'au prochain déploiement.** Cause : ces pages sont des Server Components qui font un simple `supabaseAdmin.from(...).select(...)` sans lire aucune donnée dépendant de la requête (pas de `cookies()`/`searchParams`) — Next.js les traite alors comme statiques et les fige au moment du build/déploiement (le `Cache-Control: no-store` du middleware admin ne change rien, il ne concerne que la mise en cache navigateur, pas le rendu serveur). Symptôme observé : une réservation payée avec succès n'apparaissait pas dans `/admin/reservations` juste après un déploiement, alors qu'une réservation plus ancienne (créée avant ce déploiement) y était bien visible. Fix : `export const dynamic = "force-dynamic";` ajouté sur ces deux pages — même correctif déjà en place sur `/admin/disponibilites` depuis le 2026-07-16 (voir section "Blocage des disponibilités"), qui n'avait pas été répliqué sur les autres pages admin à l'époque. `/admin/emails` n'est pas concerné (Client Component, fetch au chargement, toujours à jour). **Vérifié après coup directement en base (Supabase) que la réservation existait bel et bien** (pas seulement dans l'affichage admin) — confirmation demandée par Julien après ce bug de cache, légitime vu le symptôme.
- Double écriture CRM (`postToCrm()` dans `lib/crm.ts`, mapping complet et testé) : **toujours pas câblée** dans `payment-handler.ts` — exclue du périmètre à la demande explicite de Julien (2026-09), à faire dans un second temps

### ⬜ Reste à faire (état au 2026-09-03)

**Peut être fait dès maintenant, sans attendre la banque :**
- Récupérer la clé webhook CAWL (`CAWL_WEBHOOK_KEY_ID`/`CAWL_WEBHOOK_SECRET_KEY`) dans le portail marchand *test* (déjà accessible) → Développeur → Webhooks. Pas bloquant pour un paiement (la page de retour est le chemin principal de confirmation), mais tant que ce n'est pas fait le webhook reste fail-closed (503) — aucun filet de sécurité si un client ferme l'onglet juste après avoir payé. **Julien : prévu semaine du 2026-09-08.**
- Vérifier que `BREVO_API_KEY` est bien dans Vercel → Environment Variables (Production). Nuance à ne pas perdre : Julien a bien reçu les 2 emails du paiement réel du 2026-09-03, **mais ils ont été envoyés par un script de diagnostic lancé en local** (même code, mêmes identifiants `.env.local` — pas forcément ceux de Vercel), pas par le déclenchement automatique en prod (webhook/page de retour tournant sur Vercel). Donc toujours **pas de preuve que l'envoi automatique fonctionne tout seul sur le site réel** — à vérifier au prochain vrai paiement bouclé jusqu'au bout sur `reservation.vip-box.fr` (pas juste testé jusqu'à la page banque).
- Activer les vraies clés Turnstile pour le tunnel (`reservation.vip-box.fr`) : présentes en commentaire dans `.env.local` (créées mais jamais activées), le tunnel tourne encore avec les clés de test officielles Cloudflare (`1x0000...`/`1x0000...AA`, toujours "réussite" — donc anti-bot inactif en pratique). Décommenter + dupliquer dans Vercel avant la vraie mise en prod. **Julien : à ne pas oublier.**
- **Câbler `postToCrm()` dans `payment-handler.ts` — jugé essentiel par Julien, prévu semaine du 2026-09-08 (même semaine que la clé webhook).** Confirmé avec Julien (2026-09-03) : les commandes tunnel ne remontent aujourd'hui dans le CRM d'aucune façon (`crm_prestation_id` reste `null` sur toutes les réservations, `postToCrm()` n'est appelé nulle part) — invisible pour le CRM/logistique utilisé par le reste de l'entreprise (vipboxbooking.com, photoshaker.com) tant que ce n'est pas fait. **Diagnostic déjà fait, la partie dure est déjà écrite** — reste un câblage ciblé, pas un gros chantier :
  1. Résoudre chef de projet / programmateur du PR concerné : `getCrmPickupPoints()` (`lib/crm.ts`) donne déjà `commercial_id`/`programmateur_vipbox` par PR CRM — **à vérifier une fois** que ces deux champs correspondent bien aux rôles attendus par `postToCrm()` (`chefProjetId`/`programmateurId`), en comparant à une vraie prestation existante d'un autre canal avant de faire confiance à ce mapping.
  2. Lien PR WordPress → PR CRM déjà résolu ailleurs (`id_base`, voir "Blocage des disponibilités") — même lookup à réutiliser ici (par `pickup_point_slug` de la réservation), jamais faire confiance à un ID envoyé par le client.
  3. Appeler `postToCrm(...)` dans `handleSuccessfulPayment()` (`lib/payment-handler.ts`, déjà commenté à l'endroit prévu) avec les champs déjà présents sur la ligne Supabase (`model_slug`, `option_ids`, `total_amount`, coordonnées client, `promo_code`) — dans un `try/catch` qui ne bloque jamais les emails si le CRM est indisponible (même principe que la création du compte mon-espace juste au-dessus dans le même fichier).
  4. **Tester d'abord contre `prestations_test`** (table de test qui existe déjà côté CRM, second paramètre de `postToCrm()`) avant de brancher sur la vraie table `prestations` — pour ne pas risquer une mauvaise écriture en vraie donnée CRM au premier essai.

**Zone grise, à trancher** : le paiement en 2x (mentionné dans le parcours original — CB complète *ou* 2x via Alma) n'a jamais été implémenté côté CAWL ; seul le paiement carte complet (Hosted Checkout Page) est codé aujourd'hui. À statuer : CAWL propose-t-il un 2x natif, ou faut-il un partenaire externe (Alma) comme ça aurait été le cas avec Stripe ?

**En attente du retour de la banque (rien à anticiper côté code) :**
- Signature du contrat CAWL définitif → bascule des identifiants preprod (`CAWL_HOST=payment.preprod.cawl-solutions.fr`, PSPID `VIPBOX` confirmé en préprod seulement) vers l'environnement de production, à reconfirmer à ce moment-là (même méthode de vérification empirique que pour le préprod).

## Emails transactionnels — ✅ implémenté et testé

### Infrastructure
- Envoi via **Brevo API v3** (confirmé, pas "vraisemblablement") — `BREVO_API_KEY` en `.env.local`, domaine `vip-box.fr` vérifié dans Brevo
- Expéditeur : `reservation@vip-box.fr` (nom affiché : VIPBOX)
- Déclenchement : page de retour CAWL (chemin principal) ou webhook (filet de sécurité) → `handleSuccessfulPayment()` (`lib/payment-handler.ts`) → 2 emails en `Promise.allSettled` — **actif et testé en conditions réelles depuis le 2026-09-03** (voir section Paiement)
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

### Routes de test — ✅ supprimées (2026-07-17)
`/api/test-crm`, `/api/test-email`, `/admin/test-email` (+ le lien "Test e-mails ⚠️" dans `app/admin/layout.tsx`) ont été supprimées, plus rien à faire ici. C'est via `/api/test-crm` (payload codé en dur, PR Sophia Antipolis) qu'avait été créée la prestation de test CRM signalée plus bas — supprimée en même temps.

## Interface admin `/admin/reservations` — ✅ (2026-07-17)
- La connexion admin (`/admin/login`) redirige vers cette page (plus vers `/admin/codes-promo`)
- Tableau des 200 dernières réservations, ligne dépliable — le détail affiche désormais l'**ID Supabase puis l'ID CRM** dans cet ordre (`ReservationTable.tsx`)
- `crm_prestation_id` est vide pour toutes les réservations actuelles, test ou réelles : l'écriture CRM est désactivée par un TODO dans `lib/payment-handler.ts` (`postToCrm()` appelé nulle part, `crmId` codé en dur à `null`) — se remplira automatiquement une fois le paiement + cette écriture branchés, rien à corriger ici
- Bouton "Exporter en CSV" à côté du titre (`ExportButton.tsx`, composant séparé de `ReservationTable.tsx` pour pouvoir l'aligner avec le `<h1>` dans `page.tsx` plutôt que de l'empiler au-dessus du tableau) — exporte les réservations affichées avec toutes les colonnes utiles, BOM UTF-8 en tête pour un affichage correct des accents à l'ouverture directe dans Excel

## Blocage des disponibilités — ✅ implémenté avec les vraies données CRM (2026-07-16/17)

### Principe — enjeu business critique (Julien, 2026-07-17)
Deux exigences, la seconde encore plus importante que la première : (1) un photobooth déjà réservé ne doit pas pouvoir être re-réservé (logistique) ; (2) **un photobooth réellement disponible doit impérativement rester réservable** — un faux "complet" coûte une vente, ce qui est jugé pire qu'un risque logistique. Toute évolution de ce mécanisme doit être vérifiée dans les deux sens, pas seulement "ça bloque bien", avant tout déploiement.

Vérifié à l'**étape Modèle** (premier moment où on connaît date + PR + modèle) : 3 états possibles — `hidden` (capacité CRM à 0, le modèle n'existe pas à ce PR, carte absente de la liste), `full` (capacité atteinte pour cette date précise, carte affichée grisée avec le badge "Non disponible à cette date", pas de texte en bas de carte), `available` (réservable, ou capacité inconnue — fail open).

**Cas particulier volontaire** : si tous les modèles visibles (non `hidden`) sont `full`, aucune carte n'est affichée (ni grisée ni autre) — seulement le message "Tous les photobooths de cette agence sont déjà réservés à cette date." + boutons "Changer de lieu"/"Changer de date" (`allUnavailable` dans `ModelSelector.tsx`, comportement d'origine conservé). Repéré comme surprenant par Julien le 2026-07-17 (il s'attendait peut-être à voir aussi les cartes grisées) — comportement confirmé volontaire, à reconsidérer seulement s'il le redemande explicitement.

### Mécanisme
- `lib/availability.ts` : `getModelCapacity()` lit la capacité sur la fiche CRM (`point_retrait.reservation_maximum_classic/_smart/_360`) via `pickupPoint.crmId` ; `checkModelsAvailability()` combine capacité + décompte réel
- `lib/crm.ts` : `getCrmBookingCount()` compte les prestations CRM déjà réservées pour ce PR+modèle, dont la fenêtre `date_retrait`→`date_retour` chevauche celle de la date demandée (même formule J-1/J+2 que `postToCrm()`) — **`prestations` est LA source de vérité pour "déjà réservé"** (tous canaux : vipboxbooking.com, photoshaker.com, tunnel), pas Supabase (qui ne couvre que ce tunnel, et reste quasi vide tant que le paiement n'est pas branché)
- `app/api/availability/route.ts` : route serveur appelée par `ModelSelector.tsx` au chargement de l'étape
- Philosophie "fail open" : capacité inconnue (PR non rapproché du CRM, fiche sans valeur) ou erreur CRM → traité comme disponible, ne bloque jamais un client réel (même principe que Turnstile/rate-limit)
- Cache CRM 1h pour la capacité (`getCrmPickupPointCapacity()`) ; le décompte des réservations (`getCrmBookingCount()`) n'est **jamais** mis en cache — donnée trop sensible pour risquer un sur-booking

### Règle métier : le jour de retour est lui-même réservable (Julien, 2026-07-17)
Une date de retour, réelle ou supposée (voir repli J-1/J+2 ci-dessous), n'est **pas** un jour encore occupé — c'est un jour où la machine redevient disponible pour un nouveau retrait. Le chevauchement de fenêtres (`getCrmBookingCount()`) compare donc les dates seules (sans l'heure) avec une inégalité **stricte** (`<`), pas `<=`/`>=` : un retour et un retrait tombant le même jour ne sont pas un conflit.
Repéré via un vrai cas de test : Bordeaux, Spinner 360, une prestation du 12 août avec retour non renseigné (repli au 14 août) grisait à tort le 15 août — alors que la machine y est en réalité disponible dès le 14.

### ⚠️ Dates `date_retrait`/`date_retour` non fiables dans le CRM — géré (2026-07-17)
Certaines prestations existantes ont `date_retrait` (parfois aussi `date_retour`) rempli avec une date sentinelle `"1999-01-01"` ou `null` au lieu d'une vraie valeur — donnée non renseignée, pas une vraie date. **Pas un cas isolé** : au moins 50 prestations 2026+ concernées, réparties sur des dizaines de PR différents. Une fenêtre construite naïvement à partir de ces valeurs peut chevaucher n'importe quelle date demandée (ex. trouvé en prod : 2 prestations Lille fin août comptées à tort contre le 1er août). `getCrmBookingCount()` traite toute date antérieure à l'an 2000 (`isPlausibleCrmDate()`) comme non renseignée et retombe sur la formule J-1/J+2 calculée depuis le champ `date` de la prestation (fiable, toujours rempli), au lieu de faire confiance à `date_retrait`/`date_retour` bruts.
Le décompte se fait en deux temps : requête CRM large sur `date` (±14 jours, champ fiable) puis chevauchement précis calculé en mémoire avec ce repli — `date_retrait`/`date_retour` ne sont donc jamais utilisés seuls comme filtre de requête.

### ⚠️ `type_animation_choisie` peut combiner plusieurs animations — géré (2026-07-17)
Une prestation peut avoir ce champ rempli avec plusieurs valeurs séparées par virgule (ex. `"360,Photobooth"`, `"360,Photobooth,Smart"`) quand un client a réservé plusieurs animations à la fois — 12 prestations 2026+ concernées. Un filtre d'égalité stricte (`eq`) les ignore totalement, les excluant du décompte de **tous** les modèles (sous-comptage, risque inverse du point précédent). `matchesModelType()` compare désormais aux valeurs individuelles après découpage par virgule — jamais en sous-chaîne, pour ne pas confondre `"Photobooth"` avec `"Photobooth Mini"` (produit différent).

### Audit du 2026-07-17 (suite à une demande explicite de Julien de vérifier plus largement)
Sur demande de Julien après la découverte du bug des dates sentinelles ("qu'est-ce qui pourrait causer d'autres faux complets ?"), vérifications complémentaires faites, sans suite nécessaire :
- Pas de troncature de pagination côté API CRM (33 540 prestations retournées sans paramètre `size`)
- Pas de `date_retour` aberrante dans le futur lointain (>2030)
- **4 prestations de test trouvées dans la vraie table `prestations`** (pas `prestations_test`) : 3 sur le PR CRM 155 ("Abonné", non relié à aucune page WP donc jamais exposé au tunnel, impact nul, laissées telles quelles) ; 1 sur Sophia Antipolis (`"TEST CLAUDE — À supprimer"`, id 40707, créée via l'ancienne route `/api/test-crm`) — **supprimée le 2026-07-17**

### Source de capacité — colonnes CRM réelles
Les 3 colonnes `reservation_maximum_classic`/`_smart`/`_360` ont été ajoutées par Joris sur `point_retrait` (type `integer`) et sont éditables dans `/admin/disponibilites`. Les champs CRM `stock_theorique`/`stock_maximum` restent explicitement écartés (ne représentent pas la capacité de réservation simultanée).

### Rapprochement WP ↔ CRM — via `id_base` (ACF), pas le code postal
Le rapprochement par code postal (`matchCrmPr`) s'est révélé peu fiable : plusieurs PR CRM peuvent légitimement partager un même code postal (partenariats Zodio, PR dupliqués type "Saint-Nazaire II"), et certaines fiches CRM ont des champs `code_postal`/`ville` vides ou inversés. Remplacé par un champ ACF `id_base` sur chaque PR WP, contenant directement `point_retrait.ID` côté CRM — lien explicite et fiable, exposé via l'API REST par le mu-plugin `vipbox-api.php` (`C:\Users\Julien\OneDrive\Bureau\Claude Code\mu-plugins\vipbox-api.php`, à redéployer manuellement sur le serveur WP en cas de modification). Résolu dans `getPickupPoints()` (`lib/wordpress.ts`).

### Interface admin `/admin/disponibilites`
- Tableau éditable (un PR par ligne, une colonne par modèle) sur les 3 capacités CRM — saisie directe dans le champ, enregistrement automatique en quittant le champ (pas de bouton "Enregistrer")
- Écrit directement dans le CRM via `updateCrmPickupPointCapacity()` (`lib/crm.ts`) — pas de duplication de données, l'interface CRM classique et cette page lisent/écrivent la même table, toujours synchro
- Bannière d'avertissement si des PR WP n'ont pas de correspondance CRM (`id_base` vide ou invalide) — filet de sécurité pour une future fiche PR pas encore rapprochée
- Page forcée en `dynamic = "force-dynamic"` + `middleware.ts` force `Cache-Control: no-store` sur tout `/admin/*` — nécessaire pour refléter immédiatement un changement fait côté CRM ; **en local (`next dev`) un simple F5 peut malgré tout afficher une valeur périmée** (Next.js écrase l'en-tête en dev quoi qu'on fasse, comportement propre au serveur de dev, pas au code — un rechargement forcé Ctrl+Maj+R fonctionne toujours ; en production le F5 normal suffit)

## Navigation entre étapes (StepIndicator) — ✅ implémenté (2026-07-17)
Les cercles d'étapes déjà terminées (en-tête du tunnel) sont cliquables et ramènent à cette étape ; les étapes pas encore atteintes restent non cliquables. `resetFrom(stepIndex)` (`lib/store.ts`) efface les champs possédés par les étapes suivantes, jamais ceux d'avant ni celui de l'étape ciblée.
**Piège rencontré** : appeler `resetFrom()` avant `router.push()` provoquait un atterrissage sur l'étape suivant celle cliquée. Cause : plusieurs pages du tunnel ont leur propre garde-fou (`useEffect` qui redirige si un champ requis devient `null`) ; effacer le store pendant qu'on est encore sur la page qu'on quitte déclenche ce garde-fou, qui gagne la course contre notre propre navigation. **Premier correctif insuffisant** : `setTimeout(fn, 0)` après `router.push()` — la transition de route peut prendre plus longtemps qu'un tick, le garde-fou gagnait encore parfois. **Correctif réel** : mémoriser l'étape ciblée dans une ref, et n'effacer le store que dans un `useEffect([pathname])` déclenché par la confirmation réelle que la navigation a eu lieu (le pathname a changé) — plus de délai arbitraire, on attend un fait constaté. À réappliquer si un futur mécanisme combine navigation + mutation du store dans le même geste.

Messages d'état courts (erreurs, "aucun modèle", confirmations) : toujours en `inline-block` (pas juste `block`), sinon le fond coloré s'étire à la largeur du conteneur au lieu de la largeur du texte — repéré et corrigé sur toutes les occurrences le 2026-07-17. Les cartes de contenu multi-lignes (détail d'un code promo appliqué) restent volontairement en pleine largeur, ce n'est pas le même usage.

## Base de données — CRM serveurdms.com

- API REST (php-crud-api) : `https://api.serveurdms.com/api.php`
- Doc : https://github.com/mevdschee/php-crud-api
- Credentials : `.env.local` uniquement (`CRM_API_URL`, `CRM_API_USER`, `CRM_API_PASSWORD`)
- Schéma complet consultable via `GET /api.php/openapi` (utile pour explorer les tables/colonnes sans avoir à demander)
- Table `prestations` (~34 000 lignes) : toutes les commandes historiques, tous canaux confondus (vipboxbooking.com, photoshaker.com, tunnel...)

### ⚠️ php-crud-api : PATCH ≠ update, PATCH = incrémentation
Contrairement à la convention REST habituelle, `PATCH /records/{table}/{id}` sur cette API **additionne** la valeur envoyée aux champs numériques existants au lieu de les remplacer. Le remplacement (mise à jour partielle classique, "set") se fait avec **PUT**. Bug rencontré et corrigé le 2026-07-16 (`crmPut()` dans `lib/crm.ts`, renommé depuis `crmPatch()`) — a corrompu silencieusement des valeurs de capacité saisies avant la correction (valeurs additionnées au lieu de remplacées). Toujours utiliser PUT pour écrire dans cette API, jamais PATCH.

### Champ `type_animation_choisie` — convention confirmée (2026-07-09)
Trouvée par inspection directe de vraies données existantes (pas par supposition) : `"Photobooth"` = Classic, `"Smart"` = Smart, `"360"` = Spinner 360°. Le code (`lib/crm.ts`, `getTypeAnimationChoisie()`) utilise désormais ces valeurs exactes — avant ce fix, Classic et Smart étaient tous deux écrits comme `"Photobooth"`, faussant les rapports internes distinguant les modèles.

### Table `point_retrait`
Champ `materiel` : liste (séparée par virgule) des modèles proposés par ce PR (`vipbox_classic`, `smart`, etc.). Champs `stock_theorique`/`stock_maximum` : existent mais ne représentent PAS la capacité de réservation simultanée (écartés pour le blocage des disponibilités, voir section dédiée). `commercial_b2b_id` : routage commercial B2B (539=Marie, 795=Emma).

### `lib/crm.ts` — état
- `postToCrm(input, table)` : mapping complet et testé (table `prestations` ou `prestations_test`), pas encore appelé depuis `payment-handler.ts`
- `commercial` hardcodé à 595 pour toutes les commandes tunnel (indépendant du routage 539/795/669 utilisé côté formulaire de contact WP)
- En cas d'échec écriture CRM : ne doit jamais bloquer le client (pas encore vérifié en conditions réelles puisque pas câblé)

## Formulaire de contact WP (vip-box.fr/contact) — projet séparé, ✅ terminé et en prod

Mu-plugin WordPress indépendant, hors du repo tunnel, remplace à terme l'ancien formulaire de Joris sur `/contact`. Détail complet dans la mémoire de session — résumé utile ici :
- ⚠️ **Dossier local à jour : `C:\Users\Julien\OneDrive\Bureau\Claude Code\mu-plugins\vipbox-contact\`** (pas l'ancien `vipbox-contact-mu-plugin\`, qui traîne encore sur le Bureau mais n'est plus la référence — contenu identique au 2026-07-24, mais à vérifier à l'avenir avant de repartir de l'un ou l'autre)
- Sécurité auditée et jugée solide (nonce CSRF, honeypot, Turnstile, rate-limit, échappement XSS, validation serveur) — rien à corriger côté code
- Turnstile actif (clés créées par Julien), bug d'espacement du widget invisible corrigé (`margin: -30px` sur `.vipbox-turnstile-wrap` pour compenser la non-fusion des marges causée par `overflow:hidden`)
- ✅ **`VIPBOX_CONTACT_TEST_MODE` passé à `false`, déployé sur le serveur** (restaure le vrai routage email équipe + rate-limiting + coupe les messages de debug)
- ✅ **Bascule vers la vraie page `/contact` faite le 2026-08-20** (confirmé par Julien) — le nouveau formulaire est en prod, l'ancien formulaire de Joris n'est plus en ligne
- ✅ **Bypass d'étape 1 par URL, pour Particulier ET Professionnel** (2026-07-24) : `?type=professionnel` ou `?type=particulier` sur l'URL de la page contact. Vocabulaire URL volontairement différent du vocabulaire interne du plugin (`'pro'`/`'particulier'`, utilisé partout dans `ajax.php`/`email.php`/`form.js`) — la traduction se fait uniquement dans `vipbox_contact_render_shortcode()` (`vipbox-contact.php`), rien d'autre à toucher. Le lien Pro existait déjà (`?type=pro` à l'origine) mais avec l'ancien vocabulaire — **`ProfileCards.tsx` mis à jour en conséquence** (`?type=professionnel`)
- Version du plugin : 1.5.0

## Photos modèles
- VIPBOX Classic : https://www.vip-box.fr/wp-content/uploads/2026/04/Classic-Oai-1-air.jpg
- Smart : https://www.vip-box.fr/wp-content/uploads/2026/04/Smart-Oai-1-air.jpg
- Spinner 360° : https://www.vip-box.fr/wp-content/uploads/2026/04/Spinner-Oai-1-air.jpg
