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
  stripe_payment_intent_id text
);

-- Sécurité : aucun accès public, seul le service_role peut lire/écrire
alter table reservations enable row level security;
-- Pas de policies = accès interdit pour les clés anon/authenticated
-- Le client admin (service_role) bypass automatiquement le RLS
