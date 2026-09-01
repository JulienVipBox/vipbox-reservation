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

## À refaire quand on y reviendra

1. Redemander le même comparatif de périodes avec les dates à jour.
2. Si on veut resegmenter, la table `Prospect` a aussi `code_postal`, `Lieu`,
   `commercial`, `equipe_proposer` — utile pour des coupes par secteur/commercial
   plus tard.
3. Une fois le nouveau tunnel de réservation Next.js en prod, ses demandes
   n'apparaîtront dans `Prospect` que si on ajoute une écriture CRM dédiée (à
   voir avec `lib/crm.ts` — `postToCrm()` écrit aujourd'hui dans `prestations`,
   pas `Prospect`).
