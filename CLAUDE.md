@AGENTS.md

# VIPBOX — Tunnel de réservation

> Détails complets dans CONTEXT.md — consulter pour tarifs, options, codes promo, BDD, emails.

## Contexte
- Site vitrine : vip-box.fr (WordPress + ACF Pro)
- Tunnel : reservation.vip-box.fr (Next.js, Vercel)
- Stack : Next.js App Router, TypeScript, Tailwind, Zustand, Supabase, Stripe+Alma ou CA Up2Pay (choix en attente)

## Parcours utilisateur

### Page d'accueil
- Particulier → tunnel / Professionnel → redirection externe vers `https://www.vip-box.fr/contact/?type=pro` (formulaire de devis du site vitrine, pas dans le tunnel)

### Tunnel Particulier (8 étapes)
1. **Date** — calendrier FR ✅
2. **Lieu** — 3 PR les plus proches + modèles disponibles ✅
3. **Modèle** — filtré par PR, prix avec remise promo intégrée ✅
4. **Code promo** — saisie manuelle ; code auto-appliqué si applicable
5. **Options** — filtrées par modèle ; options offertes pré-cochées à 0€
6. **Récapitulatif** — date, lieu+horaires, modèle, options, total, liens Modifier
7. **Coordonnées** — nom, prénom, email, téléphone, adresse (→ création enregistrement Supabase)
8. **Paiement** — Stripe CB complète ou 2x via Alma (intégration en attente choix prestataire)
9. **Confirmation** — page + 2 emails (client + interne)

## API WordPress
- URL : `https://www.vip-box.fr/wp-json/wp/v2/point_retrait?per_page=100`
- Champs : `id`, `slug`, `title.rendered`, `adresse`, `code_postal`, `commune_reelle`, `adresse_complete`, `latitude`, `longitude` (strings → parseFloat), `horaires` (HTML → stripHtml), `telephone`, `modeles_disponibles`, `id_base`
- `modeles_disponibles` : `[{ ID, post_name, post_title }]`
- `id_base` : ID de la fiche `point_retrait` correspondante côté CRM (lien explicite, remplace le rapprochement par code postal — voir CONTEXT.md, section Blocage des disponibilités)

## Modèles v1 (filtrer sur ces slugs uniquement)
- `vipbox-classic` (ID 4818) — tarif saisonnier
- `smart` (ID 4886) — tarif saisonnier
- `spinner-360` (ID 4887) — prix fixe 490€

## Base de données
- Supabase table `reservations` ✅ (créée) — statuts : `en_attente` → `payé`/`échoué`
- Double écriture : Supabase + CRM `serveurdms.com` (php-crud-api) — mapping à finaliser
- Credentials CRM : `.env.local` uniquement (`CRM_API_URL`, `CRM_API_USER`, `CRM_API_PASSWORD`)
- Table `promo_codes` à créer dans Supabase
- Table `availability` : version ultérieure, pas v1

## Identité visuelle
- Couleurs : `#03071E` (navy) / `#AF8D4A` (gold)
- Logo header : https://www.vip-box.fr/wp-content/uploads/2026/04/Logo_VIPBOX_ORx300clair.png
- Logo accueil : https://www.vip-box.fr/wp-content/uploads/2026/02/Logo_VIPBOX_OR.png
- Favicon : https://www.vip-box.fr/wp-content/uploads/2026/06/cropped-Logo_VIPBOX_2026-06-09-7.png

## Notes
- Écrire "VIPBOX" sans espace
- Formules sans impressions illimitées
- Personnalisation tirages = APRÈS réservation, dans espace client
- Toujours `?per_page=100` sur l'API WP
