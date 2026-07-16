"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

/**
 * Widget Cloudflare Turnstile (anti-spam). Ne s'affiche que si
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY est défini dans .env.local — sinon ce
 * composant ne rend rien et n'a aucun effet.
 */
export function Turnstile({ onVerify }: { onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    // Le script Cloudflare ne se recharge qu'une fois par session navigateur :
    // en revenant sur cette page après une première visite, <Script onLoad>
    // ne se redéclenche pas puisqu'il est déjà chargé — sans ce check,
    // scriptLoaded restait bloqué à false et le widget ne se montait plus.
    if (window.turnstile) setScriptLoaded(true);
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !siteKey || !containerRef.current || rendered.current) return;
    rendered.current = true;

    const widgetId = window.turnstile!.render(containerRef.current, {
      sitekey: siteKey,
      appearance: "interaction-only",
      callback: onVerify,
      "expired-callback": () => onVerify(""),
      "error-callback": () => onVerify(""),
    });

    // Nécessaire en dev (React re-monte le composant deux fois en Strict Mode) :
    // sans ce nettoyage, l'ancien widget restait orphelin ("Cannot find Widget").
    return () => {
      window.turnstile?.remove(widgetId);
      rendered.current = false;
    };
  }, [scriptLoaded, siteKey, onVerify]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
