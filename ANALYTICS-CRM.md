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

## À refaire quand on y reviendra

1. Redemander le même comparatif de périodes avec les dates à jour.
2. Si on veut resegmenter, la table `Prospect` a aussi `code_postal`, `Lieu`,
   `commercial`, `equipe_proposer` — utile pour des coupes par secteur/commercial
   plus tard.
3. Une fois le nouveau tunnel de réservation Next.js en prod, ses demandes
   n'apparaîtront dans `Prospect` que si on ajoute une écriture CRM dédiée (à
   voir avec `lib/crm.ts` — `postToCrm()` écrit aujourd'hui dans `prestations`,
   pas `Prospect`).
