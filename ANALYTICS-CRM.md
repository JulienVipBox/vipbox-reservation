# Analyses CRM — demandes & conversions

> Doc de référence unique pour toute analyse de la base CRM `serveurdms.com` :
> demandes entrantes (table `Prospect`), conversions en prestations (table
> `prestations`), taux de conversion. À réutiliser tel quel pour les prochaines
> demandes de stats — compléter au fil de l'eau plutôt que créer un nouveau doc.

## Où sont les données

- API : `php-crud-api` sur `https://api.serveurdms.com/api.php` (Basic Auth,
  credentials dans `.env.local` : `CRM_API_URL`, `CRM_API_USER`, `CRM_API_PASSWORD`)
- Spec complète des tables/colonnes : `GET {CRM_API_URL}/openapi` (~1,7 Mo de JSON,
  `components.schemas.read-<Table>` liste les colonnes de chaque table).

## Point de départ des analyses : 1er novembre 2018

Le CRM a été mis en place à cette date. Les enregistrements antérieurs sont une
reprise de données incomplète et **déséquilibrée entre les deux tables** : les
prestations réservées y sont mieux représentées que les demandes
correspondantes, ce qui produit des taux de conversion incohérents (vus
jusqu'à >300% un mois donné avant filtrage). **Toujours démarrer une analyse
demandes/conversion au 1er novembre 2018**, jamais avant — ni sur `Prospect`
seul (où le volume 2016-2018 est simplement trop faible pour être
significatif), ni a fortiori sur un ratio demandes/prestations.

**Années = exercices comptables**, pas calendaires : du 1er novembre au 31
octobre, **nommés par leur année de clôture** (l'exercice du 1er nov. 2024 au
31 oct. 2025 s'appelle "2025"). Utiliser cette convention pour toute
agrégation annuelle sur cette base.

## Table `Prospect` — les demandes entrantes

⚠️ Singulier — pas `Prospects`. ~91 200 lignes au total, dont ~87 500 en
nature MARIAGE/PRO ; se limiter aux lignes à partir du 1er nov. 2018 (voir
ci-dessus).

| Champ | Rôle |
|---|---|
| `Date_1er_contact` | Date/heure de la demande. Horodatage à la seconde pour les entrées "formulaires de contact" → fiable comme proxy de la date de soumission. Format `YYYY-MM-DD HH:MM:SS`. Beaucoup de lignes ont `0000-00-00 00:00:00` (placeholder, à exclure) plutôt qu'un vrai `null`. |
| `nature_prestation` | `MARIAGE` (BtoC / Particulier), `PRO` (BtoB), ou `VENTE PHOTOSHAKER` (autre ligne de produit — vente de machines, à exclure des stats de "demandes" tunnel réservation, sauf demande explicite contraire). |
| `Provenance` | Source de la demande. Valeurs courantes : `formulaires de contact` (= le formulaire du site vip-box.fr, **hors** tunnel de réservation Next.js), `mariages.net`, `Téléphone`, `Salons`, `Mail direct`, `Divers`, `Instagram`. Champ multi-select historique : certaines lignes contiennent plusieurs valeurs séparées par des virgules (`"Salons,formulaires de contact"`, etc.) — environ 0,7% des lignes sur 10 ans. Table de correspondance : `ProvenanceClient` / `table_provenance_client`. |

**Rappel important** : le formulaire "contact/devis" de vip-box.fr (Provenance =
`formulaires de contact`) est un système **différent** du tunnel de réservation
Next.js sur lequel on travaille par ailleurs (celui-ci n'a pas encore de source
CRM dédiée tant qu'il n'est pas en prod).

## Table `prestations` — les demandes converties

~33 800 lignes. Champs clés :

| Champ | Rôle |
|---|---|
| `NatureDeLaPrestation` | `MARIAGE`, `PRO`, mais aussi `PARTENARIAT`, `VENTE PAPIER`, `PARAMETRAGE`, `ACCESSOIRES PHOTOBOOTHS`, `ME GROUP` — filtrer sur `in,MARIAGE,PRO` pour rester cohérent avec `Prospect`. |
| `annulation` | Booléen — dossier annulé après coup (~1% des cas). **Piège** : le filtre `annulation,eq,true`/`eq,false` ne fonctionne pas sur ce champ dans cette instance de php-crud-api (ignoré silencieusement, renvoie tout) — utiliser `annulation,eq,1` / `eq,0`. |
| `date_reservation` | Date à laquelle le dossier a été réservé/converti (le meilleur proxy pour la date de "conversion", à ne pas confondre avec `date` = date de l'évènement, qui peut être dans le futur). |
| `id_prospect` | FK vers `Prospect.ID`. **Rempli seulement sur ~40 à 60% des dossiers selon les années** (moins bien couvert sur les années récentes que sur 2018-2019) — permet un vrai suivi de cohorte (quelle demande a donné quelle prestation) mais seulement sur cet échantillon partiel. |

## Comment interroger (php-crud-api)

Pièges qui font échouer silencieusement un filtre (retourne tout le tableau
sans erreur, donc facile à ne pas remarquer) :

1. **Opérateurs** : ce n'est pas `gte`/`lte` mais **`ge`/`le`** (et `eq`, `gt`,
   `lt`, `in`, `is`/`nis` pour null, `cs` contains…). `ge`/`le` invalides sont
   simplement ignorés par l'API.
2. **Format de date obligatoire** : les champs date-heure exigent le pattern
   complet `YYYY-MM-DD HH:MM:SS` (pas juste `YYYY-MM-DD`), sinon le filtre est
   ignoré.
3. **Booléens** : filtrer avec `1`/`0`, pas `true`/`false` (voir `annulation`
   ci-dessus — même piège probable sur d'autres champs booléens de la base).
4. Pagination : `page=N,taille` — taille max testée 5000/page sans erreur.
   `results` dans la réponse = nombre total de lignes matchant le filtre (pas
   la taille de la page).

Exemple : compter les demandes Mariage venues du formulaire du site sur juin 2026 :

```
GET /records/Prospect
    ?filter=Date_1er_contact,ge,2026-06-01 00:00:00
    &filter=Date_1er_contact,le,2026-06-30 23:59:59
    &filter=Provenance,eq,formulaires de contact
    &filter=nature_prestation,eq,MARIAGE
    &include=ID
    &page=1,1
```
→ lire `results` dans la réponse JSON (le nombre de lignes, pas `records`).

Pour combiner Mariage + Pro en une requête : `filter=nature_prestation,in,MARIAGE,PRO`
(idem `NatureDeLaPrestation` sur `prestations`).

## Convention de découpage par défaut : mois calendaires (1er au 30/31)

Pour un export destiné à un usage interne (tableaux mensuels, présentations),
**utiliser des mois calendaires pleins par défaut**, pas des fenêtres glissantes
type "25 du mois au 24 du suivant". Appris le 2026-09-01 : une première demande
de Julien avait donné lieu à un découpage en 25→24 (calé sur la date du jour au
moment de la demande initiale) ; en redemandant un mois plus tard un "rejeu à
l'identique", Julien attendait en fait des mois calendaires classiques depuis
le début. Toujours clarifier ce point explicitement si la période n'est pas
donnée sous forme de dates exactes.

## Méthodologie de comparaison de périodes (demandes)

- Toujours comparer des **périodes de durée égale** (ex. 42 jours vs 42 jours),
  pas "depuis le 1er du mois" vs "le mois dernier entier".
- **Attention aux périodes qui chevauchent un évènement** (mise en prod, refonte,
  campagne). Une période "juste avant" qui inclut malgré tout quelques jours
  post-évènement n'est pas un vrai témoin — calculer aussi une période
  **strictement antérieure** à l'évènement pour un comparatif propre.
- Pour une comparaison YoY (année N vs année N-1), garder à l'esprit que ça
  mélange l'effet recherché (ex. refonte) avec la saisonnalité et la tendance de
  fond du marché — à interpréter avec prudence, pas comme preuve isolée.
- **Doublons** : de rares soumissions doublées (même personne, 2 à 9 secondes
  d'écart) créent 2 lignes CRM pour 1 seule demande réelle. Impact mesuré
  <2% sur un échantillon récent — négligeable pour des comparaisons, mais à
  garder en tête si un chiffre isolé semble anormalement haut.

## Méthode pour mesurer la conversion demandes → prestations

Deux approches complémentaires, utilisées ensemble dans le dashboard "Prestations
& conversion" :

1. **Ratio macro (volumes totaux, fiable en ordre de grandeur)** : nombre de
   prestations réservées (`date_reservation`) ÷ nombre de demandes reçues
   (`Date_1er_contact`) sur une même fenêtre. À calculer en **moyenne mobile
   12 mois** (somme des 12 derniers mois de chaque côté, pas un ratio mois par
   mois) pour lisser la saisonnalité et le décalage naturel entre la date d'une
   demande et sa conversion effective (qui peut prendre plusieurs semaines à
   plusieurs mois). Un ratio mois-par-mois brut est trompeur (numérateur et
   dénominateur ne portent pas sur la même cohorte).
2. **Conversion par canal (cohorte via `id_prospect`)** : ne fonctionne que sur le
   sous-ensemble de prestations liées à leur demande d'origine. Donne un **taux
   plancher** (sous-estimé d'environ 2× par rapport au ratio macro, cohérent avec
   le taux de couverture de `id_prospect`) mais reste **comparable entre canaux**
   tant qu'on ne compare pas sa valeur absolue au ratio macro. Toujours afficher le
   **N** (nombre de demandes de l'échantillon tracé) à côté de chaque taux — un
   canal à faible volume (ex. mariages.net côté Pro, N<15 historiquement) donne un
   taux non significatif et doit être replié dans "Autres" plutôt que comparé aux
   canaux à fort volume.
3. **Premier point affichable d'une courbe de taux (moyenne mobile 12 mois)** :
   c'est le premier mois dont toute la fenêtre glissante de 12 mois est postérieure
   au 1er nov. 2018 — soit **octobre 2019** avec ce point de départ. Ne jamais
   afficher un point dont la fenêtre mord sur la période de reprise de données.

## ✅ Historique `PARTICULIER` corrigé en base (25 août 2026)

Après discussion, Julien a préféré revenir à la convention `MARIAGE`/`PRO`
uniquement (plus satisfaisant intellectuellement de garder `PARTICULIER`,
mais moins pratique en interne). **Les 174 fiches `nature_prestation =
'PARTICULIER'` (24 juillet → 25 août 2026) ont été repassées à `'MARIAGE'`**
via l'API CRM (PUT un par un, vérifié : 174/174 OK, 0 restant). Le mu-plugin
(`includes/ajax.php` + `includes/email.php`, version → 1.5.1) a aussi été
corrigé pour écrire à nouveau `'MARIAGE'` — **à redéployer sur le serveur par
Julien**, sinon le mu-plugin recommencera à écrire `'PARTICULIER'` sur les
nouvelles soumissions.

**Donc, à partir du redéploiement de la 1.5.1 : plus besoin d'ajouter
`PARTICULIER` au filtre `nature_prestation` pour les analyses futures** — la
convention `MARIAGE`/`PRO` redevient valide sur toute la période. Seule la
fenêtre 24 juillet → 25 août 2026 a transitoirement existé sous
`PARTICULIER`, et est maintenant réunifiée sous `MARIAGE` dans les données.

## (Historique, conservé pour mémoire) Convention `nature_prestation` : `PARTICULIER` s'était ajouté à `MARIAGE`/`PRO`

Le nouveau mu-plugin de contact (`vipbox-contact`, mis en ligne sur la vraie
page `/contact` le **24 juillet 2026 vers 16h50** — remplace l'ancien
formulaire de Joris) écrit **`nature_prestation = 'PARTICULIER'`** pour les
leads Mariage au lieu de `'MARIAGE'`. **Ce n'est pas un bug** : renommage
explicitement décidé par Julien le **2026-07-08** (payload CRM `ajax.php` +
corps de l'e-mail admin `email.php`), qui n'avait simplement pas été répercuté
dans ce doc au moment où la convention `MARIAGE`/`PRO` a été figée plus haut.
`'PARTICULIER'` n'existe nulle part dans les 8 ans d'historique avant le 24
juillet 2026 — normal, c'est une valeur inédite issue de ce renommage, pas un
signe d'anomalie.

**Conséquence pour toute analyse** : une requête filtrant
`nature_prestation,in,MARIAGE,PRO` (l'ancienne convention documentée plus haut
dans ce doc) **exclut silencieusement** tous les leads Particulier soumis via
le nouveau formulaire depuis le 24 juillet 2026. Un premier passage d'analyse
(25 août 2026) a cru y voir un effondrement du canal site (~-70%) à cause de
ça — c'était un artefact de comptage, pas une vraie baisse : le volume réel
progresse en fait semaine après semaine (10 → 23 → 26 → 28 → 83 sur les 5
semaines suivant le lancement). **Toujours filtrer
`nature_prestation,in,MARIAGE,PRO,PARTICULIER`** pour toute analyse couvrant
une période à partir du 24 juillet 2026.

Vérifié sans impact opérationnel : les leads `PARTICULIER` sont bien suivis
par l'équipe (`confirmation` très majoritairement `en_cours`/`oui`, taux de
`non_traite` comparable à avant le changement) — le seul angle mort était
côté analyse/reporting, pas côté traitement commercial réel.

**Piège secondaire lié, désormais expliqué** : un second libellé `Provenance`
inédit, `Site VIP BOX - demande entrante`, apparaît à partir du **13 août**
(pas le 24 juillet — sans lien de date direct avec le bug ci-dessus). Ce ne
sont **pas** des soumissions automatiques du formulaire mais des fiches créées
à la main par l'équipe (Mike/Emma), résumant des échanges reçus par d'autres
canaux (`info@`/`reservation@vip-box.fr`, site partenaire `vip-box.lu`,
transferts internes) — repérable au style rédactionnel des
`descriptif_prestation` ("transférée par Emma", "à arbitrer par Mike"...),
pas à des champs structurés de formulaire. Un troisième libellé,
`Campagne pub last-minute 2026` (à partir du 18 août), correspond à une
campagne publicitaire distincte — à exclure des analyses de "demande
entrante organique du site".

**Pour comparer le canal "formulaire de contact / devis du site" dans le
temps (hors mariages.net, hors campagne payante)** : fusionner
`Provenance,in,formulaires de contact,Site VIP BOX - demande entrante` **et**
`nature_prestation,in,MARIAGE,PRO,PARTICULIER`.

## Constats déjà établis (juillet 2026)

- Refonte du site vip-box.fr mise en prod le **20 mai 2026**.
- **Impact refonte sur les demandes** : comparaison 1er juin–12 juillet 2026 vs
  période équivalente (42j) juste avant, vs 100% avant refonte (8 avril–19 mai),
  vs même période 2025 → **baisse du volume de demandes dans les trois cas**,
  cohérente avec une tendance de fond déjà connue (pic exercice 2022, déclin
  depuis) plutôt qu'un effet spécifique et mesurable de la refonte. Trop tôt /
  pas de signal positif détecté à ce stade.
- **Tendance longue (table `Prospect`, depuis nov. 2018)** : volume de demandes
  en pic à l'exercice 2022 (~13 700), en déclin depuis (exercice 2025 : ~9 850).
  Le poids de mariages.net dans le mix de sources a nettement augmenté pendant
  que le formulaire du site reculait en valeur absolue.
- **Activité prestations (table `prestations`, depuis nov. 2018)** : même
  tendance à la baisse, plus marquée. Total (Mariage+Pro) en pic à l'exercice
  2023 (~4 150), puis -12% (exercice 2024), -12% (exercice 2025) — deux baisses
  consécutives à deux chiffres, nettement visibles sur une vue par exercice
  (la courbe mensuelle seule, très saisonnière, masque cette tendance à l'oeil).
- **Conversion par canal (exercices 2022-2025, taux plancher)** : le formulaire
  du site convertit ~2,9× mieux que mariages.net en Mariage (~16% vs ~5,6%).
  Côté Pro, le mail direct convertit très bien (~44%), les salons très mal
  (~3%) ; mariages.net y est quasi absent (N=9 sur 4 exercices) et replié dans
  "Autres". La hausse du poids de mariages.net dans le mix de demandes tire donc
  mécaniquement le taux de conversion global vers le bas, indépendamment de tout
  effet refonte.
- **Composition de "Autres"** (résidu après Formulaire site / Mariages.net /
  Salons / Téléphone / Mail direct) : en Mariage, dominé par la valeur
  fourre-tout `Divers` saisie par les commerciaux (~83%) ; en Pro, dominé par les
  saisies à `Provenance` multi-valeurs (~66%). Volume faible dans les deux cas
  (quelques centaines de demandes sur 4 exercices) — taux à interpréter avec
  prudence.
- Dashboards complets (courbes mensuelles + vue par exercice) : demander à
  Claude de republier les artifacts "Demandes entrantes CRM" et "Prestations &
  conversion CRM" si les liens ne sont plus sous la main.

## Constats mis à jour (25 août 2026) — impact refonte avec 97 jours de recul

Refonte du 20 mai 2026 : 97 jours pleins de recul désormais (20 mai → 24 août
2026, dernier jour plein), contre ~42 jours lors de l'analyse de juillet.
Comparaison à durée égale (97j) : post-refonte vs pré-refonte strictement
antérieur (12 fév → 19 mai 2026) vs même fenêtre calendaire N-1 (20 mai → 24
août 2025). **Chiffres ci-dessous corrigés du bug `nature_prestation`
ci-dessus** (une première passe, avant correction, avait conclu à tort à un
effondrement du canal site — voir section dédiée).

- **Volume total demandes (Mariage+Pro+Particulier, tous canaux)** : 1518
  (post, avant correction) vs 2179 (pré, -30%) vs 2206 (N-1, -31%) — ce total
  agrégé reste correct tel quel car `mariages.net` (le gros du volume) n'est
  pas affecté par le bug ; seul le détail par canal était faussé.
- **Canal formulaire de contact / devis du site UNIQUEMENT, corrigé, hors
  mariages.net et hors campagne payante** (fusion `Provenance` formulaire +
  Site VIP BOX, fusion `nature_prestation` Mariage/Pro/Particulier) :
  - Post-refonte (97j) : **583** (6,01/j)
  - Pré-refonte équivalent (97j) : **675** (6,96/j) → **-13,6%**
  - Même fenêtre N-1 (97j) : **837** (8,63/j) → **-30,3%**
  - Série hebdomadaire (1er juin → 24 août) sans rupture ni creux : 37, 40,
    53, 41, 37, 41, 28, 51, 30, 34, 39, 81 (dernière semaine partielle,
    dopée par les fiches manuelles "Site VIP BOX" + la reprise du volume
    Particulier une fois le bug de tag identifié) — **aucun effondrement
    réel**, contrairement à ce qu'un premier comptage non corrigé suggérait.
- **Détail Mariage/Particulier vs Pro** (même canal site, mêmes fenêtres) :

  | | Post (97j) | Pré (97j) | post/pré | N-1 (97j) | post/N-1 |
  |---|---|---|---|---|---|
  | Mariage+Particulier | 434 (4,47/j) | 478 (4,93/j) | **-9,2%** | 606 (6,25/j) | **-28,4%** |
  | Pro | 149 (1,54/j) | 197 (2,03/j) | **-24,4%** | 231 (2,38/j) | **-35,5%** |

  Le Pro décline un peu plus vite que le Mariage dans les deux comparaisons.
  Pas de rupture nette sur la série hebdomadaire Pro (juin-août : 17, 16, 13,
  13, 11, 13, 6, 13, 7, 8, 8, 5) — déclin progressif, cohérent avec une
  activité B2B/évènementiel plus faible l'été (creux congés), pas un
  décrochage isolé imputable à la refonte.
- **Conclusion refonte** : le canal site décline **au même rythme** que le
  volume total tous canaux (-30% YoY vs -31% YoY tous canaux) — **aucun signe
  que la refonte pénalise spécifiquement ce canal**, Mariage comme Pro. La
  baisse sur la fenêtre 2026 seule (pré→post, -13,6% agrégé) est nettement
  plus modérée que le YoY, cohérente avec une tendance de fond de marché
  plutôt qu'un effet refonte. **Toujours pas de signal négatif spécifiquement
  imputable à la refonte**, cette fois sur une base de données fiable et avec
  Mariage/Particulier et Pro vérifiés séparément.

## Export mensuel BtoB/BtoC (25 août 2026)

Artifact publié : "Demandes BtoB / BtoC" — 6 périodes mensuelles glissantes
(25 du mois → 24 du mois suivant, calées sur le 25 août), 2026 vs mêmes
périodes 2025, canal formulaire du site uniquement (hors mariages.net, hors
campagne publicitaire). Chiffres bruts (nature_prestation) :

| Période | Mariage 2026 | Mariage 2025 | Pro 2026 | Pro 2025 |
|---|---|---|---|---|
| 25 fév-24 mars | 127 | 271 | 49 | 70 |
| 25 mars-24 avr | 155 | 247 | 58 | 88 |
| 25 avr-24 mai | 143 | 230 | 65 | 131 |
| 25 mai-24 juin | 121 | 217 | 66 | 86 |
| 25 juin-24 juil | 116 | 192 | 45 | 72 |
| 25 juil-24 août | 179 | 158 | 29 | 55 |

Point notable : la dernière période (25 juil-24 août) est la **première du
tableau où le BtoC 2026 dépasse 2025** (+13,3% YoY, après 5 mois consécutifs
entre -37% et -53%) — cohérence avec l'impression de reprise de Julien. Le
BtoB, lui, reste en baisse continue sur toute la fenêtre, sans rapport
apparent avec la refonte (20 mai 2026). À confirmer sur le mois suivant avant
d'y voir une vraie inflexion structurelle plutôt qu'un rebond ponctuel (une
partie du sursaut BtoC vient des fiches manuelles "Site VIP BOX" apparues à
partir du 13 août, cf. section dédiée — hors ces fiches, l'écart YoY resterait
positif mais plus modeste).

## Réservations en ligne (vipboxbooking.com / WooCommerce) — champ `cel` (1er septembre 2026)

**Table `prestations`, champ `cel` (booléen) + `numero_cel`** = marqueur fiable
des réservations passées en ligne sur `vipboxbooking.com` (site WooCommerce,
synchronisé quotidiennement vers le CRM). Confirmé en croisant `numero_cel`
avec les `order_number` d'un export WooCommerce réel — correspondance exacte.
**Ne pas utiliser `provenance_client` pour ça** : la valeur `2 = site de
location en ligne` n'existe quasi pas dans la table (42 lignes sur tout
l'historique) — champ saisi à la main par les commerciaux, non alimenté par la
synchro automatique.

Sur les 12 derniers mois (`date_reservation` du 2025-09-01 au 2026-09-01) :
**1454 lignes `cel=1`** (1443 hors annulations), quasi exclusivement `MARIAGE`
(1443) — cohérent avec "seuls les particuliers réservent en ligne". Montant
CRM (`montant_prestation_int`) total non annulé : **552 221 €**.

### ⚠️ Piège : `montant_prestation_int` ≠ somme des `order_total` WooCommerce

En comparant au véritable export WooCommerce (12 mois, 1449 commandes
contenant un modèle de box) : la somme brute des `order_total` WooCommerce ne
donne que **429 604 €**, soit 23 % de moins que le total CRM. **Ce n'est pas
une anomalie de synchro** — c'est parce que `order_total` reflète seulement ce
qui a été facturé *dans cette commande précise*, alors que `montant_prestation_int`
reflète la valeur totale contractée de la prestation :

- Commande au statut **`En cours`** (paiement carte complet) : `order_total`
  WooCommerce = montant total réel. Ex. commande 79707, 340 € des deux côtés.
- Commande au statut **`Réglé partiellement`** (paiement Alma / 2x, acompte
  ~50 %) : `order_total` WooCommerce ne montre que **l'acompte**, alors que
  `montant_prestation_int` en CRM enregistre le **montant total** (≈ 2×
  l'acompte). Ex. commande 79711 : `order_total` 185 €, CRM 370 €.

Sur cette fenêtre, 670 des 1449 commandes (46 %) sont `Réglé partiellement`.
En doublant leur `order_total` (approximation acompte 50 %) : 560 674 € —
cohérent à 1,5 % près avec les 552 221 € du CRM. **Conclusion : le CRM est la
source fiable pour le montant total** ; ne jamais sommer naïvement les
`order_total` d'un export WooCommerce brut sans corriger les commandes
`Réglé partiellement`, sous peine de sous-estimer le CA réel d'environ un quart.

**Non résolu** : Julien avait en tête ~300 000 €/808 commandes sur 12 mois —
inférieur aux deux sources (WooCommerce brut 430k, CRM 552k). Origine de ce
chiffre à clarifier (fenêtre différente ? uniquement les commandes déjà
soldées en totalité ? approximation de mémoire ?) — pas d'explication trouvée
à ce jour, ni dans le CRM ni dans l'export WooCommerce.

## Accès Google Search Console (1er septembre 2026)

Aucun connecteur officiel Anthropic/Google pour GSC à ce jour. Des connecteurs
MCP tiers existent (services SaaS faisant le pont OAuth) : Porter, Supermetrics,
Windsor.ai, Composio, Data Bloo, Adzviser, et
[mcpsearchconsole.com](https://mcpsearchconsole.com/) — vérifié : gratuit sans
carte bancaire, OAuth Google géré (pas de clé API à gérer), hébergé (URL
`https://mcpsearchconsole.com/mcp` à ajouter comme serveur MCP), lecture seule
(`webmasters.readonly`). Expose clics/impressions/CTR/position par requête,
page, pays, appareil ; inspection d'URL ; plusieurs propriétés ; comparaison de
périodes ; sitemaps et santé technique.

Recommandation : l'ajouter comme connecteur MCP **à ce projet Claude Code**
plutôt qu'à l'app claude.ai seule — permet de croiser directement le SEO avec
le CRM/les PR/le code du tunnel dans la même conversation, sans copier-coller
entre deux outils.

**Faisabilité du croisement géographique par PR** : confirmée — chaque PR a
une URL publique dédiée type `vip-box.fr/location-photobooth-perigueux-sud/`
(slug identique à celui déjà utilisé côté CRM/tunnel pour `id_base`), donc le
croisement trafic/position SEO par PR vs demandes/réservations sur ce même PR
est possible en joignant sur ce slug.

Méthode recommandée : démarrer au niveau global (GSC clics + impressions +
position moyenne, mensuel, tout le site, mis en regard des courbes de
demandes déjà produites) avant de descendre au niveau PR — et seulement sur un
échantillon de 5-10 PR à fort volume avant de généraliser aux ~140, le volume
par PR individuel risquant d'être trop faible pour être significatif mois par
mois (même problème que le "N trop faible" déjà rencontré sur la conversion
par canal).

### ✅ Accès GSC opérationnel (1er septembre 2026)

Compte de service impossible (règle d'organisation Google Workspace
`iam.managed.disableServiceAccountKeyCreation`) → contourné avec un client
OAuth **"Application de bureau"** (projet Cloud `vipbox-tools`). Deux scripts,
sans dépendance npm ajoutée (mêmes conventions que `weekly-pr-check.js`) :

- `scripts/gsc-auth.js` — autorisation initiale, **une seule fois** (ouvre un
  lien, Julien clique "Autoriser", le script capture le callback en local et
  écrit `GSC_REFRESH_TOKEN` dans `.env.local`). Déjà fait, pas à refaire sauf
  si le jeton est révoqué.
- `scripts/gsc-query.js` — requêtes Search Analytics réutilisables, aucune
  interaction requise ensuite (rafraîchit le token tout seul). Lancé seul :
  imprime clics/impressions/CTR/position moyenne par mois calendaire, 16
  derniers mois (limite de rétention GSC). Exporte aussi `getAccessToken` /
  `searchAnalyticsQuery` pour être réutilisé avec d'autres dimensions
  (`page`, `query`, `country`...) une fois qu'on affine par PR.

Propriété confirmée : **`sc-domain:vip-box.fr`** (propriété de domaine — pas
une propriété par URL). Ça couvre automatiquement tous les sous-domaines et
protocoles, donc `reservation.vip-box.fr` (le tunnel) sera déjà inclus dedans
une fois en prod, sans reconfiguration GSC nécessaire.

Premier pull réel effectué (2025-05 à 2026-08, mensuel, tout le site) — table
brute non reproduite ici : elle contenait un pic d'impressions inexpliqué en
septembre 2025 et un spam ponctuel en juin 2026, tous deux identifiés et
retirés depuis. **La table de référence à jour, nettoyée, est dans "Vue
mensuelle (16 mois) + artifact" plus bas.**

### ⚠️ Piratage SEO confirmé et résolu — 13 juin 2026, à toujours exclure des analyses GSC

En creusant la composition des requêtes hors-marque, des mots-clés typiques du
spam SEO de jeux d'argent en ligne indonésien (`situs delman567`, `prima77`,
`mpo212`, etc.) ressortaient en position 1-3 sur de vraies pages existantes du
site (`/references/`, `/assistance-telephonique/`,
`/location-photobooth-montpellier/`) — signe d'un piratage avec contenu caché
injecté (visible par Googlebot, pas par un visiteur normal). **Confirmé par
Julien : incident connu, déjà traité.** Vérification GSC (regex sur les
motifs habituels de ce type de spam, `date`×`query`, 16 mois) : épisode
**concentré sur une seule journée, le 13 juin 2026** (34 825 impressions /
2 152 clics ce jour-là), traces résiduelles négligeables jusqu'au 14 juillet,
**rien depuis** (vérifié jusqu'au 2 septembre 2026, dernière donnée
disponible). Sans impact sur les fenêtres pré-refonte (12 fév-19 mai) ni N-1
(2025) — seule la fenêtre post-refonte (20 mai-24 août) le contient.

**⚠️ Piège méthodologique important** : un filtre `excludingRegex` sur
`query` appliqué à toute une période de plusieurs mois d'affilée sous-compte
aussi des mois **sans rapport avec le spam** (ex. vérifié sur mai 2025 :
passe de 5586 à 3475 clics alors qu'il n'y a aucun spam ce mois-là) —
comportement connu de l'API GSC avec les requêtes rares/anonymisées, pas
fiable pour une exclusion large. **La bonne méthode, utilisée partout dans
ce document depuis** : lister les lignes exactes via `includingRegex` sur
`dimensions: ['date','query']`, vérifier qu'elles sont bien concentrées sur
la période suspecte, puis les **soustraire précisément** du total brut —
jamais appliquer l'exclusion en aveugle sur une longue période.

### ⚠️ Pic d'impressions de septembre 2025 expliqué : homonyme "VIPBox", site pirate de streaming sportif

Le pic (1,3M d'impressions, CTR 0,40%) vient à 94% de la requête exacte
`vipbox` (883k impressions, 1323 clics — CTR 0,15%) et de sa variante
`vip box` (246k impressions). **"VIPBox"/"VIPBoxTV" est aussi le nom d'un
site pirate de streaming sportif bien connu, sans aucun rapport avec
VIPBOX.** Position moyenne de vip-box.fr sur sa propre requête de marque :
**8-9, jamais en tête**, y compris en dehors du pic — signe que Google
mélange les deux entités sur cette requête, et que l'écrasante majorité des
chercheurs de "vipbox" veulent le site de streaming (CTR proche de 0 le
confirme).

Suivi mensuel de la requête exacte `vipbox` (impressions) : 104k (mai 25) →
197k (juin) → 64k (juil) → **419k (août) → 883k (sept, pic) → 358k (oct)**
→ 85k (nov) → retour à un niveau bas (30-90k) de déc. 25 à mars 26, avant un
second pic modéré en avril-mai 26 (185k/140k, cette fois avec un CTR bien
meilleur — 1,1 à 1,8%, donc probablement de vrais chercheurs de la marque
cette fois). **Chronologie compatible avec la reprise des saisons sportives
européennes (foot, NFL) fin août-septembre** — hypothèse la plus probable,
non vérifiable formellement depuis GSC seul.

**Conséquence pour toute comparaison d'impressions/clics dans le temps** :
exclure les requêtes de marque (regex `vip ?box|vio ?box|bipbox|cipbox|vipvox|vip ox`)
en plus du spam de juin, sous peine de comparer des périodes à des degrés de
contamination très différents. Le bruit de marque n'est pas ponctuel comme le
spam : il **s'étale d'août 2025 à février-mars 2026**, ce qui déborde
directement sur la fenêtre pré-refonte (12 fév-19 mai 2026) de la comparaison
ci-dessous — **69% des impressions de cette fenêtre sont des requêtes de
marque contaminées**, contre 40% pour la fenêtre post-refonte (déjà en net
reflux à cette date). Une comparaison brute pré/post confond donc en bonne
partie "la contamination homonyme qui s'éteint" avec un vrai changement de
performance SEO.

### Croisement refonte, version doublement nettoyée (spam + marque) — la plus fiable à ce jour

Mêmes 3 fenêtres de 97 jours, cette fois hors spam **et** hors requêtes de
marque contaminées (méthode : somme exacte des lignes `date`×`query`
matchant chaque regex, soustraite du total brut — jamais `excludingRegex`
en aveugle, voir piège documenté plus haut) :

| | Pré-refonte | Post-refonte | N-1 | Post vs Pré | Post vs N-1 |
|---|---|---|---|---|---|
| GSC clics | 6 870 | 6 234 | 8 646 | -9,3% | -27,9% |
| GSC impressions | 440 333 | 312 478 | 544 317 | -29,0% | -42,6% |
| GSC CTR | 1,56% | 2,00% | 1,59% | +0,44 pt | +0,41 pt |
| GSC position moy. | 15,9 | 14,9 | 21,4 | -1,0 (amélioration) | **-6,5 (nette amélioration)** |

**Historique de correction, pour mémoire** : une première version de ce
tableau (chiffres bruts, rien exclu) concluait à tort à une hausse des
clics de +14,9% en YoY — artefact entier du spam du 13 juin. Une version
intermédiaire a ensuite retiré le spam seul, ce qui semblait confirmer une
franche baisse des clics (-41,5%/-24,0%). **C'est cette double exclusion
(spam + marque) qui est la version fiable à retenir.** Une fois les deux
retirés, l'histoire change à nouveau, et cette fois plutôt dans le bon sens
par rapport à la version "spam seul" : clics quasi stables pré/post (-9,3%,
plus la petite baisse franche vue précédemment), position moyenne
**nettement meilleure qu'il y a un an** (21,4 → 14,9, -6,5 points), CTR
toujours meilleur. Le volume reste en
repli (impressions -29%/-43%), mais nettement moins sévère que les -70%
qu'affichait la vue brute. **Nuance à garder** : cette double exclusion est
une estimation raisonnable, pas une science exacte — une partie du trafic
"marque" exclu est sans doute de vrais internautes cherchant VIPBOX (le CTR
extrêmement bas suggère que c'est une petite minorité, mais pas zéro).

### Vue mensuelle fine (nettoyée) autour de la refonte — pas d'inflection nette au 20 mai

Demande de Julien (3 sept. 2026) : le bloc "97 jours" ci-dessus est trop
large pour un effet SEO forcément progressif — segmenter plus finement.
`scripts/gsc-monthly-clean.js` (nouveau) applique la même méthode de double
exclusion (spam + marque) mois calendaire par mois calendaire — chiffres
repris dans la colonne GSC de la vue mensuelle 16 mois plus bas (elle a été
recalculée avec cette même méthode doublement nettoyée sur toute la
fenêtre, pas seulement autour de la refonte).

**Constat important, qui nuance le tableau "pré/post" ci-dessus** : à ce
niveau de détail, **il n'y a pas de rupture nette au 20 mai**. La grosse
amélioration de position (21,2 → 14,1) et de CTR (1,09% → 1,61%) a lieu
entre **février et mars 2026 — près de trois mois avant la refonte**, donc
pas imputable à celle-ci. Le meilleur mois toutes métriques confondues est
juin (juste après la refonte), mais août revient quasiment au niveau
pré-refonte (position 18,1, proche des 21,2 de février). Les impressions,
elles, déclinent en continu de janvier à juillet, sans à-coup identifiable
au moment de la refonte — cohérent avec une contamination de marque encore
partiellement active en janvier-février (les régler complètement demande un
filtre plus permissif que celui utilisé ici, pas fait à ce stade) plutôt
qu'avec un effet refonte. **Conclusion : sur les données actuelles, aucun
effet spécifiquement imputable à la refonte n'est démontrable côté SEO** —
ni positif ni négatif — le signal qui existe (amélioration de position/CTR)
précède la refonte.

**Recherche d'anomalies GSC élargie** (à la demande de Julien) : scan
statistique des 488 jours de la fenêtre de 16 mois (repérage des jours à
plus de 3 écarts-types de la moyenne, clics et impressions). Résultat : rien
au-delà des deux épisodes déjà identifiés — un seul jour supplémentaire
détecté (30 mai 2026), qui n'est qu'un petit écho résiduel de l'homonyme de
marque, déjà couvert par le filtre ci-dessus. Pas de troisième contamination
cachée.

### Saisonnalité des demandes entrantes (table `Prospect`, 7 ans) — indispensable avant tout avant/après

Demande de Julien (3 sept. 2026) : avant d'interpréter un avant/après
refonte qui compare des mois calendaires différents (ex. avril vs juillet),
isoler la forme saisonnière du volume de demandes de la tendance de fond
(déjà documentée en déclin depuis l'exercice 2022). Calculé sur `Prospect`
uniquement (pas `prestations` : `date_reservation` est décalée de plusieurs
semaines à plusieurs mois par rapport à la demande réelle), toutes
provenances confondues (échantillon plus robuste), part de chaque mois
calendaire dans le total de son année, moyennée sur plusieurs années
(`scripts/prospect-seasonality.js`, nouveau).

(Indice 100 = part moyenne d'un mois si le volume était parfaitement plat
sur l'année, soit 8,33%.)

**⚠️ Correction du 3 sept. 2026 : 2020 et surtout 2021 sont Covid, pas un
"artefact CRM"** — hypothèse initiale erronée, corrigée après remarque de
Julien. Le détail mensuel montre un mécanisme précis, pas juste du bruit :

- **2020** : janvier normal (2088, pré-Covid, France pas encore confinée),
  puis effondrement mars-décembre (1er confinement 17 mars, 2e confinement
  30 oct-15 déc) — total annuel 8593, très inférieur aux autres années
  (~10 500-14 000). Mécaniquement, la part de janvier dans ce total rétréci
  explose (24,3%) **sans que janvier lui-même n'ait rien d'exceptionnel** —
  c'est le dénominateur (reste de l'année, écrasé par les confinements) qui
  fausse le ratio.
- **2021** : toujours très bas jusqu'en avril (3e confinement 3 avril-3 mai,
  couvre-feu une bonne partie du 1er semestre) — janv-avr entre 368 et 466,
  moitié d'une année normale — puis **rattrapage net** dès la levée des
  restrictions (mai-août 734-809) et **pic de septembre-octobre
  anormalement haut** (1261/1101, mariages reportés qui se re-bookent en
  masse à la rentrée 2021). 2021 est donc doublement faussé : creux
  artificiel en début d'année, sur-représentation en fin d'année — dans le
  mauvais sens pour une comparaison "quel mois est fort/faible" normale.

**Référence retenue : indice sur 2022-2025 (4 années post-Covid "propres"),
pas 2021-2025.** Impact concret d'avoir inclus 2021 par erreur au premier
passage : ça gonflait l'indice de septembre-octobre par la contamination du
rattrapage Covid, et sous-estimait le contraste saisonnier réel entre le
début et la fin du printemps.

| Mois | Indice 7 ans (2019-2025, brut, indicatif) | Indice 4 ans (2022-2025, retenu) |
|---|---|---|
| Janvier | 154 | 144 |
| Février | 108 | 115 |
| Mars | 96 | 107 |
| Avril | 90 | 101 |
| Mai | 94 | 105 |
| Juin | 96 | 95 |
| Juillet | 94 | 93 |
| Août | 85 | 83 |
| Septembre | 119 | 109 |
| Octobre | 108 | 103 |
| Novembre | 108 | 94 |
| Décembre | 48 | 51 |

**Lecture** : **janvier est de loin le mois le plus fort** ("engagement
season" post-Noël, confirmé aussi sur l'indice propre), suivi de
septembre-octobre. **Décembre est le mois le plus faible, de loin**. Le
printemps (mars-mai) est en réalité **plus proche de la moyenne, voire
légèrement au-dessus**, une fois 2021 retiré — contrairement à la première
lecture qui le donnait nettement sous la moyenne (biais introduit par le
creux artificiel de mars-mai 2021).

**⚠️ Limite à ne pas perdre de vue : N=4 années seulement, et c'est
instable.** Test de sensibilité (retirer une année à la fois parmi
2022-2025) sur l'écart saisonnier attendu entre la fenêtre pré-refonte (12
fév-19 mai) et post-refonte (20 mai-24 août) : **-9,6% à -18,5%** selon
l'année retirée (vs -12,7% avec les 4 années). C'est une fourchette large —
l'indice se stabilisera avec plus d'années post-Covid disponibles, pas
avant.

**Application à la comparaison refonte** (indice 4 ans, pondéré par nombre
de jours de chaque mois dans chaque fenêtre) : effet saisonnier attendu
post/pré **≈ -12,7%** (fourchette -9,6% à -18,5% selon la sensibilité
ci-dessus) — **beaucoup plus marqué que l'estimation précédente (-3,3%,
calculée par erreur avec 2021 inclus)**. Conséquence directe sur la lecture
des baisses brutes pré/post :

- **Demandes canal site (-13,6% brut)** → résiduel hors saisonnalité
  **entre +6% et -4%** selon l'année de référence retenue — **la baisse
  observée n'est plus distinguable d'une simple variation saisonnière
  normale.** C'est un changement de conclusion par rapport à la version
  précédente de ce document.
- **Réservations en ligne (-21,4% brut)** → résiduel hors saisonnalité
  **entre -3,6% et -13,1%** — reste négatif dans tous les cas testés, donc
  une vraie baisse subsiste probablement, mais son ampleur exacte est
  incertaine.

Les comparaisons **N-1** (même fenêtre calendaire, année précédente)
continuent de ne pas nécessiter cet ajustement — la saisonnalité s'annule
déjà par construction (mêmes mois des deux côtés).

**Non fait à ce stade** : appliquer cette même correction saisonnière à la
série mensuelle GSC (16 mois) et à la table mensuelle complète plus bas ; se
resynchroniser sur cet indice une fois 2026 devenu une année complète
utilisable (portera le N propre à 5).

### Vue mensuelle (16 mois, 2025-05 → 2026-08) + artifact

Mensualisation complète demandée par Julien plutôt que la seule vue "3
fenêtres" ci-dessus — permet de voir si l'effet refonte apparaît
progressivement plutôt que d'un coup. `scripts/crm-monthly.js` (nouveau,
mêmes conventions que les autres scripts) interroge `Prospect` et
`prestations` mois calendaire par mois calendaire, sur la même fenêtre que
le pull GSC :

| Mois | Demandes (canal site) | Résa. en ligne (`cel`) | Montant | Clics GSC* | Impr. GSC* | CTR* | Position* |
|---|---|---|---|---|---|---|---|
| 2025-05 | 338 | 126 | 52 510€ | 3393 | 198 604 | 1,71% | 19,9 |
| 2025-06 | 278 | 118 | 47 535€ | 3037 | 192 421 | 1,58% | 20,7 |
| 2025-07 | 294 | 122 | 48 020€ | 2790 | 159 681 | 1,75% | 22,0 |
| 2025-08 | 198 | 115 | 43 890€ | 2167 | 164 175 | 1,32% | 21,4 |
| 2025-09 | 244 | 107 | 40 155€ | 2612 | 161 015 | 1,62% | 18,4 |
| 2025-10 | 232 | 89 | 34 425€ | 2267 | 128 444 | 1,76% | 15,4 |
| 2025-11 | 178 | 121 | 44 755€ | 1602 | 119 268 | 1,34% | 17,8 |
| 2025-12 | 153 | 55 | 19 905€ | 1228 | 113 018 | 1,09% | 18,0 |
| 2026-01 | 296 | 154 | 59 060€ | 2175 | 186 313 | 1,17% | 22,3 |
| 2026-02 | 278 | 142 | 55 500€ | 1994 | 182 129 | 1,09% | 21,2 |
| 2026-03 | 198 | 153 | 60 883€ | 2184 | 135 260 | 1,61% | 14,1 |
| 2026-04 | 207 | 129 | 50 745€ | 2129 | 126 491 | 1,68% | 14,3 |
| 2026-05 | 193 | 149 | 55 893€ | 2284 | 118 869 | 1,92% | 13,9 |
| 2026-06 | 184 | 147 | 56 065€ | 2269 | 98 949 | 2,29% | 12,6 |
| 2026-07 | 165 | 97 | 37 515€ | 1730 | 90 353 | 1,91% | 14,6 |
| 2026-08 | 239 | 100 | 37 020€ | 2020 | 110 772 | 1,82% | 18,1 |

*Colonnes GSC doublement nettoyées (spam du 13 juin **et** requêtes de
marque contaminées par l'homonyme "VIPBox" — voir sections dédiées
ci-dessus), via `scripts/gsc-monthly-clean.js` : soustraction précise des
lignes `date`×`query` matchant chaque motif, jamais `excludingRegex` en
aveugle (piège documenté plus haut). Remplace une première version de ce
tableau qui ne retirait que le spam — le pic de septembre 2025 (1,3M
d'impressions brutes) disparaît quasi entièrement une fois la marque
retirée (161k, en fait inférieur à mai 2025), confirmant qu'il s'agissait
presque exclusivement de bruit de marque, pas d'un vrai signal SEO.

**Lecture** : aucun décrochage brutal identifiable au mois de la refonte
(mai 2026) sur aucune des séries — cohérent avec l'attente de Julien qu'un
effet, s'il existe, apparaîtrait progressivement plutôt qu'immédiatement.
Côté GSC (vue doublement nettoyée), le vrai mouvement est une **amélioration
de position/CTR amorcée en mars 2026, avant la refonte**, culminant en
juin, puis un retour en août proche du niveau de février — pas une rupture
au 20 mai (détail complet dans la section dédiée plus haut). Les
réservations en ligne suivent une saisonnalité propre (creux décembre à 55,
pic mars à 153) plus marquée que tout effet refonte visible à l'œil sur
cette fenêtre — voir aussi la section saisonnalité `Prospect` plus haut, qui
montre que la baisse pré/post des demandes elle-même n'est pas clairement
distinguable du bruit saisonnier normal une fois le Covid correctement
neutralisé dans l'indice de référence.

**Artifact publié : "Refonte VIPBOX"** — courbes interactives (indice base
100 demandes/résa/clics, impressions en échelle log, CTR+position, table
mensuelle complète), marqueur refonte sur chaque graphique, données
doublement nettoyées (spam + marque). Republier si besoin de mise à jour
(mêmes données que le tableau ci-dessus).

### YoY normalisé par mois (3 sept. 2026) — méthode plus rigoureuse que le pré/post simple

Demande de Julien : plutôt que comparer une seule paire pré/post-refonte
(qui ignore la saisonnalité) ou une seule paire N-1 (qui ignore la
tendance de fond, elle-même en déclin d'année en année), calculer le taux
de variation YoY **mois par mois** sur plusieurs années, et voir si
juin-août 2026 (post-refonte) s'écarte de la tendance YoY établie par les
années précédentes pour ces mêmes mois calendaires — pas juste s'il baisse.
`scripts/prospect-site-yoy.js` (nouveau), demandes canal site, 2019-2026.

Sur les 3 transitions post-Covid "propres" (2022→23, 23→24, 24→25) comme
référence :

| Mois | Tendance établie (moy. 2022-25) | 2025→2026 réel | Écart |
|---|---|---|---|
| Mai | -23% | -43% | pire (~-20pt) |
| Juin | -30% | -34% | dans la norme |
| Juillet | -22% | -44% | pire (~-22pt) |
| Août | -33% (très stable, -28 à -39% trois ans d'affilée) | **+21%** | **rupture nette (+54pt)** |

Août est statistiquement le vrai signal (écart-type historique ~4,5pt sur
3 ans très serrés — la rupture 2026 sort largement de cette bande), mais
**~60% de la hausse brute vient de l'étiquette `Provenance = "Site VIP BOX
- demande entrante"`**, apparue le 13 août 2026 et qui n'existe donc
mécaniquement pas dans la base 2025 de comparaison — **⚠️ précision
importante (pas le nouveau formulaire de contact du 24 juillet, sans
rapport)** : vérifié sur les 26 fiches concernées à ce jour, il s'agit
d'un lot **hétérogène**, pas d'un "canal" au sens propre — un mélange de
fiches vraiment reconstituées à la main depuis des mails directs
(info@/reservation@/mike@, transférées par Emma ou Mike), une commande
WooCommerce classée par erreur comme "demande", un lead du site partenaire
vip-box.lu, un lead d'une agence via paris-photobooth.com, **et 7 fiches
du 18 août qui sont bien de vraies soumissions du formulaire vip-box.fr**,
importées via un "récapitulatif" (digest mail) plutôt qu'en temps réel. En
isolant le seul `Provenance = "formulaires de contact"` (comparable tel
quel à 2025), août 2026 est à **+8,6% YoY** (198→215), toujours une
rupture de tendance mais bien plus modeste que le +21% brut — le reste de
l'écart est un artefact de périmètre de comptage (une étiquette qui
n'existait pas en 2025), pas une vraie accélération de la demande.
**Conclusion :**
mai et juillet se dégradent plus vite que la tendance établie, juin est
dans la norme, août casse la tendance (à moitié artefact de mesure) — pas
de signal cohérent sur juin-août pris ensemble, cohérent avec l'absence
d'effet refonte déjà constatée par ailleurs. Méthode à réutiliser pour les
prochaines analyses de ce type (plus rigoureuse que pré/post ou N-1 seuls).

### SEO local par PR (3 sept. 2026) — premier passage, 9 PR à fort volume

Enjeu identifié comme majeur par Julien. Croisement `scripts/pr-local-seo.js` :
GSC (dimension `page`, filtre `contains location-photobooth-<slug>`) ×
CRM (`Prospect.point_retrait`, très bien renseigné — 90014/90024 lignes
non nulles). Jointure via `id_base` (WP) = `point_retrait` (CRM), confirmée
fiable. Échantillon : les 9 PR au plus fort volume de demandes canal site
sur 24 mois (`point_retrait` 15/Paris, 118/Lyon-St-Priest, 7/Bordeaux,
6/Nantes, 67/Orléans, 16/Nice-Cannes, 93/Besançon, 20/Angers, 22/Quimper —
`point_retrait` 57, le plus gros volume historique, n'a pas de fiche WP
correspondante, probablement un PR fermé/renommé, exclu de l'échantillon
GSC pour cette raison).

| PR | Demandes pré→post | Clics GSC pré→post | Impr. GSC pré→post | Position pré→post |
|---|---|---|---|---|
| Paris | 51→43 | 48→39 | 8005→7202 | 26,0→24,1 |
| Lyon–Saint-Priest | 19→7 | 0→29 | 0→4414 | (aucune page)→16,5 |
| Bordeaux | 17→21 | 82→97 | 9249→8235 | 17,7→13,9 |
| Nantes | 21→13 | 65→57 | 8345→5471 | 13,2→14,4 |
| Orléans | 14→16 | 150→139 | 4743→4981 | 18,1→9,6 |
| Nice–Cannes | 18→8 | 0→56 | 0→7748 | (aucune page)→14,4 |
| Besançon | 11→6 | 75→41 | 2749→1925 | 15,7→12,1 |
| Angers | 10→3 | 64→46 | 4244→3250 | 14,3→12,3 |
| Quimper | 12→13 | 86→91 | 3568→2378 | 12,0→10,1 |

**⚠️ Correction du 3 sept. 2026, suite à la remarque de Julien** : la
lecture initiale ("Lyon–Saint-Priest et Nice–Cannes = pages neuves, effet
local positif") **était fausse**. Vérifié via la Wayback Machine
(`web.archive.org/cdx`) puis confirmé sur GSC : ce sont des **renommages
d'URL**, pas des pages neuves — `/location-photobooth-nice/` existait
(56 660 impressions / 230 clics sur les 12,5 mois précédents, position
21,4) et redirige en 301 vers `/location-photobooth-nice-cannes/` depuis
la refonte ; même chose pour `/location-photobooth-lyon/` (33 793 impr. /
200 clics, position 21,7) → 301 vers `/location-photobooth-lyon-saint-priest/`.
Les 301 sont bien en place (vérifié), donc pas d'erreur technique de
migration — mais **le volume post-refonte de ces deux PR (4414 et 7748
impressions sur 97 jours, ≈1400-2400/mois) reste en repli par rapport à
leur niveau pré-refonte (≈2700-4500/mois)** : la nouvelle URL n'a pas
encore totalement récupéré l'autorité de l'ancienne — un creux de
migration temporaire attendu, pas un gain, et pas franchement une perte
définitive non plus (trop tôt pour trancher).

**Piège méthodologique à retenir** : mon test initial ("aucune page
contenant le slug avant la refonte") ne cherchait que le *nouveau* slug
(`nice-cannes`, `lyon-saint-priest`) et quelques variantes géographiques
proches (sophia, antipolis, cannes, grasse, antibes, mougins) — pas
l'ancien slug plus générique (`nice`, `lyon`) qui aurait immédiatement
révélé le renommage. **Avant de conclure "page inexistante avant X" sur un
site qui vient d'être refait, toujours vérifier une éventuelle redirection
303/301 de l'URL courante plutôt que de s'arrêter à une recherche GSC sur
le slug actuel.** Les 7 autres PR de l'échantillon ont un slug inchangé
(vérifié : trafic pré-refonte présent sous leur slug actuel dans les 9
lignes du tableau ci-dessus), donc comparables tels quels — seuls
Lyon-Saint-Priest et Nice-Cannes nécessitaient cette vérification
supplémentaire, pas fait ailleurs sur les ~140 PR du site (à généraliser
si on étend l'échantillon).

**⚠️ Non fait : volet réservations en ligne (`cel`) par PR.** La table CRM
`prestations` renvoie une `PDOException` sur toute requête **filtrée**
depuis le 3 septembre 2026 en cours de session (`Prospect` répond
normalement, la lecture directe d'un enregistrement `prestations` par ID
fonctionne, seule la liste filtrée casse — testé sous plusieurs
combinaisons de filtres, y compris sans aucun filtre de date). Probable
souci serveur côté CRM, indépendant du code de ce projet — à vérifier côté
`serveurdms.com`, puis relancer `pr-local-seo.js` (colonne résa déjà
prévue dans le script, juste inopérante tant que la table ne répond pas).

### Semrush — inaccessible (3 sept. 2026)

Connecteur Semrush disponible côté MCP mais **units API épuisées** — toute
requête (`projects`, etc.) échoue avec un message dirigeant vers
https://www.semrush.com/mcp-access pour en ajouter. Rien d'exploitable tant
que ce n'est pas réglé côté compte Semrush de VIPBOX. Objectif prévu une
fois débloqué : historique des ajouts de mots-clés suivis (Position
Tracking), avec un tri pertinence à faire (beaucoup de volume attendu,
notamment sur les mots-clés locaux).

## À refaire quand on y reviendra

1. Redemander le même comparatif de périodes avec les dates à jour.
2. Si on veut resegmenter, la table `Prospect` a aussi `code_postal`, `Lieu`,
   `commercial`, `equipe_proposer` — utile pour des coupes par secteur/commercial
   plus tard.
3. Une fois le nouveau tunnel de réservation Next.js en prod, ses demandes
   n'apparaîtront dans `Prospect` que si on ajoute une écriture CRM dédiée (à
   voir avec `lib/crm.ts` — `postToCrm()` écrit aujourd'hui dans `prestations`,
   pas `Prospect`).
4. Clarifier avec Julien l'origine du chiffre "~300 000 €/808 commandes" pour
   les réservations en ligne (voir section dédiée ci-dessus) — ni le CRM
   (552k€/1443) ni l'export WooCommerce brut (430k€/1449) ne le confirment.
5. ✅ Fait le 3 septembre 2026 : accès GSC opérationnel (OAuth, pas de
   connecteur MCP tiers nécessaire), croisement SEO ↔ demandes/réservations
   mensualisé + artifact "Refonte VIPBOX".
6. Vérifier si la `PDOException` sur `prestations` (requêtes filtrées,
   apparue le 3 sept. 2026) est résolue côté CRM, puis relancer
   `scripts/pr-local-seo.js` pour compléter le volet réservations en ligne
   par PR (colonne déjà prévue dans le script).
7. Une fois Semrush débloqué (units API), reprendre l'historique des
   ajouts de mots-clés suivis (Position Tracking) — trier la pertinence,
   volume attendu important, notamment mots-clés locaux.
8. Étendre l'échantillon SEO local au-delà des 9 PR déjà croisés — voir
   en particulier si d'autres PR ont, comme Lyon-Saint-Priest et
   Nice-Cannes, une page apparue seulement après la refonte.
