-- Table des réservations VIPBOX
-- À exécuter dans Supabase : SQL Editor → New query → Run

create table reservations (
  id                      uuid default gen_random_uuid() primary key,
  status                  text not null default 'en_attente',
  created_at              timestamptz default now() not null,
  event_date              date not null,
  pickup_point_name       text not null,
  model_name              text not null,
  model_price             integer not null,
  options                 text,
  promo_code              text,
  promo_discount          integer,
  total_amount            integer not null,
  customer_first_name     text not null,
  customer_last_name      text not null,
  customer_email          text not null,
  customer_phone          text not null,
  customer_address        text not null,
  customer_postal_code    text not null,
  customer_city           text not null,
  stripe_payment_intent_id text,
  -- Informations PR enrichies (pour les emails — stockées à la création)
  pickup_point_slug        text,
  pickup_point_horaires    text,
  pickup_point_phone       text,
  -- Référence CRM (renseignée après écriture dans serveurdms.com)
  crm_prestation_id        integer
);

-- Sécurité : aucun accès public, seul le service_role peut lire/écrire
alter table reservations enable row level security;
-- Pas de policies = accès interdit pour les clés anon/authenticated
-- Le client admin (service_role) bypass automatiquement le RLS

-- ─── Migration (2026-07-09) : model_slug + option_ids ────────────────────────
-- Table déjà en prod sans ces colonnes → ALTER plutôt que refaire le CREATE.
-- Nécessaires pour la double écriture CRM (postToCrm) ET pour le blocage des
-- disponibilités (compter les réservations par modèle exact, pas juste par
-- nom affiché). Déjà calculées par app/api/reservations/route.ts, il ne
-- manquait que les colonnes pour les persister.
alter table reservations add column if not exists model_slug text;
alter table reservations add column if not exists option_ids text[];

-- ─── Table des codes promo ───────────────────────────────────────────────────
-- À exécuter dans Supabase : SQL Editor → New query → Run

create table promo_codes (
  id                      uuid default gen_random_uuid() primary key,
  code                    text unique not null,

  -- Effet
  discount_amount         integer not null default 0,
  free_option_ids         text[] not null default '{}',

  -- Validité (null = pas de restriction)
  booking_valid_from      date,
  booking_valid_until     date,
  event_valid_from        date,
  event_valid_until       date,

  -- Ciblage géographique (null = partout)
  allowed_pr_slugs        text[],
  allowed_region_ids      integer[],

  -- Quotas
  max_uses                integer,
  uses_count              integer not null default 0,
  max_uses_per_user       integer not null default 1,

  -- Ciblage email (null = pas de ciblage)
  allowed_emails          text[],

  active                  boolean not null default true,
  created_at              timestamptz default now() not null
);

alter table promo_codes enable row level security;

-- ─── Rate limiting anti-spam (réservations) ──────────────────────────────────
-- À exécuter dans Supabase : SQL Editor → New query → Run
-- Compte les tentatives par "bucket" (ip_submit_xxx ou email_submit_xxx) sur une
-- fenêtre glissante ; lib/rate-limit.ts supprime les lignes expirées à chaque
-- vérification, pas besoin de tâche de nettoyage séparée.

create table rate_limit_hits (
  id          bigint generated always as identity primary key,
  bucket      text not null,
  created_at  timestamptz not null default now()
);

create index rate_limit_hits_bucket_created_idx on rate_limit_hits (bucket, created_at desc);

alter table rate_limit_hits enable row level security;
-- Pas de policies = accès interdit pour les clés anon/authenticated ; seul le
-- service_role (utilisé par l'API serveur) peut lire/écrire.
