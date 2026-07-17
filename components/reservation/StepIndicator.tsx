"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";

const STEPS = [
  { label: "Date", path: "/reservation/date" },
  { label: "Lieu", path: "/reservation/lieu" },
  { label: "Modèle", path: "/reservation/modele" },
  { label: "Promo", path: "/reservation/code-promo" },
  { label: "Options", path: "/reservation/options" },
  { label: "Récap", path: "/reservation/recapitulatif" },
  { label: "Contact", path: "/reservation/coordonnees" },
  { label: "Paiement", path: "/reservation/paiement" },
];

export function StepIndicator() {
  const pathname = usePathname();
  const router = useRouter();
  const resetFrom = useReservationStore((s) => s.resetFrom);
  const activeRef = useRef<HTMLLIElement>(null);

  const currentIndex = STEPS.findIndex((s) => s.path === pathname);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentIndex]);

  // Seules les étapes déjà terminées sont cliquables (revenir en arrière) —
  // sauter à une étape jamais atteinte laisserait la page suivante sans les
  // données dont elle a besoin. Le retour efface les choix des étapes
  // suivantes (voir resetFrom() dans lib/store.ts), jamais ceux d'avant.
  const goToStep = (index: number, path: string) => {
    resetFrom(index);
    router.push(path);
  };

  if (pathname === "/reservation/confirmation")
    return (
      <a
        href="https://www.vip-box.fr"
        className="text-white/70 hover:text-white text-sm transition-colors"
      >
        Retour sur vip-box.fr
      </a>
    );

  return (
    <nav aria-label="Étapes de réservation" className="overflow-x-auto">
      <ol className="flex items-start min-w-max px-3 py-1">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li
              key={step.path}
              ref={isCurrent ? activeRef : null}
              className="flex flex-col items-center w-16"
            >
              {isDone ? (
                <button
                  type="button"
                  onClick={() => goToStep(index, step.path)}
                  aria-label={`Retourner à l'étape ${step.label}`}
                  className="group flex flex-col items-center cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors bg-gold text-white group-hover:ring-2 group-hover:ring-gold group-hover:ring-offset-2 group-hover:ring-offset-[#03071e]">
                    ✓
                  </span>
                  <span className="text-[13px] leading-none mt-2 text-center text-white/50 group-hover:text-white/80 transition-colors">
                    {step.label}
                  </span>
                </button>
              ) : (
                <>
                  <div
                    aria-current={isCurrent ? "step" : undefined}
                    className={[
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                      isCurrent &&
                        "bg-gold text-white ring-2 ring-gold ring-offset-2 ring-offset-[#03071e]",
                      !isCurrent && "bg-white/10 text-white/40",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={[
                      "text-[13px] leading-none mt-2 text-center",
                      isCurrent ? "text-white font-medium" : "text-white/50",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
