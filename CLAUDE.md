@AGENTS.md

# VIPBOX — Tunnel de réservation

## Contexte
Tunnel de réservation pour VIPBOX (vip-box.fr), entreprise de location de photobooths en France.
- Site vitrine : vip-box.fr (WordPress + ACF Pro)
- Tunnel : reservation.vip-box.fr (ce projet Next.js, déployé sur Vercel)

## Parcours utilisateur

### Page d'accueil (hors tunnel)
- Sélection du profil : **Particulier** → tunnel ci-dessous / **Professionnel** → `/pro` (formulaire devis)
- La page d'accueil REMPLACE l'ancienne étape "Profil" ; il n'y a plus d'étape Profil dans le tunnel
- Particulier : "Réserver en ligne" / description "Mariage, anniversaire, fête privée…"
- Professionnel : "Demander un devis" / description "Salon, événement d'entreprise…"

### Tunnel Particulier (8 étapes)
1. **Date** — calendrier interactif FR
2. **Lieu** — recherche adresse → 3 PR les plus proches avec modèles disponibles
3. **Modèle** — filtré par PR choisi (3 modèles en v1)
4. **Code promo** — optionnel ; 3 types : remise €, option(s) offertes, ou les deux
5. **Options** — filtrées par modèle ; options offertes par code promo pré-cochées à 0 €
6. **Récapitulatif** — date, lieu (avec horaires), modèle, options, total ; liens Modifier
7. **Coordonnées** — nom, prénom, e-mail, téléphone, adresse postale
8. **Paiement** — Stripe (CB complète ou 2x, pas de 3x)
9. **Confirmation** — page de confirmation affichée + deux emails déclenchés (hors numérotation)

### Parcours Professionnel (/pro)
- Formulaire de demande de devis — À DÉVELOPPER (étape importante, rappeler régulièrement)
- Les demandes DOIVENT être enregistrées dans la base "Prospects" via une API dédiée (indépendante du site)
- Pour l'instant : placeholder avec lien vers vip-box.fr/contact
- Ce formulaire Pro servira ensuite de base pour refaire le formulaire contact de vip-box.fr
- ⚠️ RAPPEL IMPORTANT : formulaire Pro = étape clé à ne pas oublier

## API WordPress — Points de retrait
URL : https://www.vip-box.fr/wp-json/wp/v2/point_retrait
Pagination : ?per_page=100 (il y a 90+ PR)

Champs disponibles par PR :
- id, slug, title.rendered — identifiant et nom du PR
- adresse, code_postal, commune_reelle, adresse_complete
- latitude, longitude — coordonnées GPS (strings, à parser en float)
- horaires — HTML (contient balises <p>)
- telephone
- modeles_disponibles — tableau d'objets WP complets

Structure de modeles_disponibles :
[{ ID: 4818, post_name: "vipbox-classic", post_title: "La VIPBOX Classic" }, ...]

## Modèles réservables en v1
Filtrer modeles_disponibles sur ces slugs uniquement :
- vipbox-classic (ID: 4818) → VIPBOX Classic
- smart (ID: 4886) → Smart
- spinner-360 (ID: 4887) → Spinner 360°

Les autres modèles présents dans l'API (miroir-photo, glambot, robot-photo, draw-me-bot, mosaic-wall) sont à ignorer en v1.

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
- Option Forfait Confort (installation par opérateur) : +260€

## Options par modèle

### VIPBOX Classic & Miroir (mêmes options)
- Pack Full Options Numériques (GIF + Boomerang + Livre d'or numérique + Boîte à questions) : 100€
- Mode GIF : 30€
- Mode Boomerang : 30€
- Mode Vidéo : 40€
- Boîte à questions : 60€
- Livre d'or numérique : 30€
- Personnalisation écran de veille : 30€
- Mise en page supplémentaire : 30€
- 2 Mises en page supplémentaires : 60€
- 400 tirages supplémentaires : 80€
- 800 tirages supplémentaires : 160€
- Ré-impression de toutes les photos : 80€

### Smart
- Pack Full Options Numériques : 60€
- Mode Boomerang : 30€
- Mode GIF : 30€
- Mise en page supplémentaire : 30€
- 2 Mises en page supplémentaires : 60€
- 400 tirages supplémentaires : 80€

### Spinner 360°
- Forfait Confort (livraison + installation + opérateur sur place) : 260€

## Codes promo

### Fonctionnement dans le tunnel
- 3 types : remise fixe en € sur le total, option(s) offertes (prix = 0 €), ou les deux
- Validation dans `lib/promo.ts` — actuellement placeholder (retourne null = aucun code actif)
- État dans le store : `promoCode` (string), `promoEffect` ({ discountAmount, freeOptionIds[] })
- Changer de modèle remet le code promo à zéro (les options offertes sont model-specific)
- Options offertes : affichées en vert avec badge "Offert", non décochables

### Affichage automatique (yield management)
- Si un ou plusieurs codes promo s'appliquent à la date + lieu choisis par le client, les appliquer **automatiquement**, sans que le client ait à les connaître
- Le meilleur code applicable doit être sélectionné automatiquement (le plus avantageux pour le client)
- **Étape Modèle** : les prix affichés sur les cartes modèle doivent déjà intégrer la remise du meilleur code promo applicable — le client voit directement le prix réduit
- **Étape Code promo** : reste présente pour permettre la saisie manuelle d'un code supplémentaire ou différent ; si un code a déjà été appliqué automatiquement, l'afficher pré-rempli avec mention "Code appliqué automatiquement"
- Le code auto-appliqué est prioritaire sauf si le client saisit manuellement un code plus avantageux

### Critères d'un code promo
Lors de la création d'un code, on doit pouvoir définir :
- **Plage de dates de réservation** : applicable uniquement pour des événements entre date A et date B
- **Zones ou PR ciblés** : applicable uniquement pour certains points de retrait (liste de slugs ou zone géographique)
- **Durée de validité / date d'expiration** : date après laquelle le code n'est plus utilisable
- **Nombre max d'utilisations** : le code se désactive automatiquement une fois le quota atteint
- **Clients ciblés** : liste d'e-mails spécifiques pour lesquels le code est valable (codes nominatifs ou réservés à certains clients/groupes)

### Gestion des codes promo (usage quotidien par l'équipe)
- Stockage : table Supabase `promo_codes` (à créer lors de l'intégration Supabase)
- Colonnes prévues : `code`, `discount_amount`, `free_option_ids`, `valid_from`, `valid_until`, `max_uses`, `uses_count`, `allowed_pickup_point_slugs` (array), `allowed_emails` (array), `active`
- **Option A (court terme)** : Supabase Table Editor — interface tableur intégrée au dashboard Supabase, accessible sans code, suffisante pour créer/désactiver des codes au quotidien
- **Option B (moyen terme)** : page `/admin/codes-promo` dans l'app, protégée par mot de passe, avec formulaire de création et liste des codes actifs/expirés
- **Stats** : compteur d'utilisations et croisement avec les réservations — faisable en SQL depuis le dashboard Supabase (Option A) ou via une page dédiée (Option B)
- Recommandation : démarrer avec l'Option A, construire l'Option B si l'équipe trouve Supabase peu pratique ou si les besoins stats s'intensifient

## Paiement

### ⚠️ Choix du prestataire — en attente de validation interne
- Deux options à l'étude : **Stripe** (déjà utilisé par VIPBOX) ou **Crédit Agricole Up2Pay / CAWL** (banque de l'entreprise — ⚠️ pas "Monetico", qui est Crédit Mutuel/CIC)
- Décision en cours côté client : comparaison des coûts à effectuer avant de coder l'intégration
- Ne pas commencer l'intégration paiement avant validation de ce choix

### Option A : Stripe
- Déjà un compte existant chez VIPBOX
- Tarif standard : ~1,5 % + 0,25 € par transaction carte européenne (ex. sur 350 € : ~5,50 €)
- Intégration développeur : excellente (Payment Element, webhooks, docs complètes)
- **Paiement en 2x** : Stripe ne gère pas le 2x CB nativement en France — utiliser **Alma** (provider français) comme méthode de paiement additionnelle (1-2 lignes de config, transparent pour l'utilisateur)
- CGV à accepter à l'étape Paiement (pas au Récapitulatif)

### Option B : Crédit Agricole Up2Pay (CAWL)
- **Up2Pay** = TPE virtuel CA / **CAWL** = joint-venture Crédit Agricole + Worldline (depuis 2024) — ⚠️ "Monetico" = Crédit Mutuel/CIC, terme incorrect pour CA
- Banque de l'entreprise — potentiellement tarif négocié (~0,8–1,2 % + 0,20 € selon formule)
- Fonctionnement : paiement par redirection (le client quitte le tunnel, paye sur la page CA, revient sur confirmation) — expérience utilisateur moins fluide qu'un formulaire embarqué
- Intégration développeur : plus complexe (API moins moderne, moins de ressources disponibles), pas de Payment Element natif
- Le 2x serait à gérer différemment (probablement via un module CA ou contrat spécifique)
- Variables d'environnement à prévoir : à confirmer selon leur documentation Up2Pay/CAWL

### Variables d'environnement Stripe (si option A retenue)
- `STRIPE_SECRET_KEY` (côté serveur)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (côté client)
- `STRIPE_WEBHOOK_SECRET` (pour valider les webhooks)

## Emails transactionnels

Deux emails sont envoyés automatiquement après confirmation du paiement :

### 1. Email de confirmation client
- Destinataire : l'adresse saisie à l'étape Coordonnées
- Contenu : récapitulatif complet de la commande (date, PR avec horaires de retrait, modèle, options, montant payé, code promo le cas échéant)
- Ton : chaleureux, rassurant, à l'image de VIPBOX

### 2. Email de notification interne
- Destinataire(s) : adresse(s) interne(s) à définir (ex. julien@vip-box.fr + une adresse ops)
- Contenu : mêmes infos que le client + informations opérationnelles (téléphone, adresse postale, ID Supabase, ID CRM si disponible)
- Permet à l'équipe d'être alertée en temps réel de chaque nouvelle commande

### Service d'envoi
- **Brevo** (ex-Sendinblue) — vraisemblablement déjà utilisé par VIPBOX pour les emails transactionnels → à privilégier pour éviter d'ajouter un outil
- **Sarbacane** — utilisé pour les newsletters (pas pour le transactionnel)
- **Mailjet** — utilisé par VIPBOX pour un usage à préciser (à vérifier)
- ⚠️ À confirmer en interne : est-ce bien Brevo pour le transactionnel ? Si oui, récupérer la clé API Brevo
- Variable d'environnement nécessaire : `BREVO_API_KEY` (ou `MAILJET_API_KEY` selon ce qui est retenu)
- Les emails sont envoyés depuis une Route Handler Next.js déclenchée par le webhook paiement

## Base de données

### Stratégie : double enregistrement Supabase + CRM serveurdms.com
- Les commandes doivent s'écrire dans **deux bases** simultanément :
  1. **Supabase** (table `reservations`) — notre base native, avec nos noms de champs, pour les abandons, la relance, les stats, les codes promo
  2. **CRM serveurdms.com** (table `Prestations`) — la base historique de l'entreprise (10 ans de commandes depuis vipboxbooking.com), utilisée pour la logistique, la comptabilité, les scripts internes
- En cas d'échec de l'écriture CRM : ne pas bloquer le client, logger l'erreur, prévoir une relance (queue ou retry manuel)
- Les noms de champs sont différents entre les deux bases → une couche de mapping est nécessaire côté serveur

### Supabase — Réservations Particuliers
- Table `reservations` : enregistrement créé quand l'utilisateur valide l'étape Coordonnées (clic "Continuer"), AVANT d'arriver à l'étape Paiement — permet de capturer les abandons même sans paiement
- Statuts : `en_attente` (arrivé au paiement) → `payé` (webhook paiement OK) / `échoué` (webhook paiement KO)
- Les réservations `en_attente` sans mise à jour après X minutes = abandon → permet relance
- **Disponibilités** : blocage des dates déjà réservées par PR/modèle — prévu à terme mais PAS pour la v1 ; à implémenter dans une version ultérieure

### CRM serveurdms.com — Table Prestations
- Base existante hébergée sur serveurdms.com, 10 ans de commandes
- API REST (php-crud-api) : `https://api.serveurdms.com/api.php/records/prestations`
  - Exemple de requête : `?filter=id,eq,35559`
  - Doc filtres/jointures : https://github.com/mevdschee/php-crud-api
- Credentials API : en `.env.local` uniquement (JAMAIS dans le code ou CLAUDE.md)
  - Variable : `CRM_API_URL`, `CRM_API_USER`, `CRM_API_PASSWORD`
- Champs de la table Prestations : à documenter après analyse de l'export fourni par le client
  - Certains champs ont une valeur fixe pour toutes les commandes du tunnel
  - Certains ont une valeur par défaut mais sont modifiables manuellement en interne après commande (logistique, chef de projet selon PR, etc.)
  - Certains se déduisent d'autres champs (ex. chef de projet → dépend du PR)
  - Certains sont vides pour nous et ne nous concernent pas
  - ⚠️ À analyser sur export CSV avant de coder le mapping

### Professionnels
- Demandes de devis dans la base "Prospects" existante via API dédiée (indépendante du site)

### Tables Supabase à créer
- `reservations` — toutes les réservations particuliers avec leur statut paiement ✅ (créée)
- `promo_codes` — gestion des codes promo (voir section dédiée)
- `availability` — disponibilités par PR/modèle/date (version ultérieure, pas v1)

## Identité visuelle
- Couleurs : `#03071E` (brand, navy foncé) et `#AF8D4A` (gold)
- Logo header (version claire, fond sombre) : https://www.vip-box.fr/wp-content/uploads/2026/04/Logo_VIPBOX_ORx300clair.png
- Logo page d'accueil (version couleur) : https://www.vip-box.fr/wp-content/uploads/2026/02/Logo_VIPBOX_OR.png
- Favicon : https://www.vip-box.fr/wp-content/uploads/2026/06/cropped-Logo_VIPBOX_2026-06-09-7.png
- Photos modèles :
  - VIPBOX Classic : https://www.vip-box.fr/wp-content/uploads/2026/04/Classic-Oai-1-air.jpg
  - Smart : https://www.vip-box.fr/wp-content/uploads/2026/04/Smart-Oai-1-air.jpg
  - Spinner 360° : https://www.vip-box.fr/wp-content/uploads/2026/04/Spinner-Oai-1-air.jpg

## Stack technique
- Next.js (App Router, TypeScript, Tailwind)
- Zustand pour le state management entre étapes
- Vercel pour le déploiement
- Supabase pour la base de données (réservations, codes promo)
- Double écriture : Supabase + CRM serveurdms.com (php-crud-api)
- Paiement : Stripe + Alma (option A) ou Crédit Agricole Up2Pay/CAWL (option B) — choix en attente

## Notes importantes
- Les formules ne comprennent PAS d'impressions illimitées
- La personnalisation des tirages se fait APRÈS la réservation, dans l'espace client — pas dans le tunnel
- Le champ horaires est du HTML, le nettoyer avant affichage (stripHtml dans lib/wordpress.ts)
- Les latitude/longitude sont des strings dans l'API, les parser en parseFloat()
- L'API retourne 10 PR par défaut — toujours utiliser ?per_page=100
- Toujours écrire "VIPBOX" sans espace (pas "VIP BOX")
