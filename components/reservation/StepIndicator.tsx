"use client";

import { usePathname } from "next/navigation";

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

  if (pathname === "/reservation/confirmation") return null;

  const currentIndex = STEPS.findIndex((s) => s.path === pathname);

  return (
    <nav aria-label="Étapes de réservation" className="overflow-x-auto">
      <ol className="flex items-start min-w-max px-3 py-1">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <li key={step.path} className="flex flex-col items-center w-16">
              <div
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                  isDone && "bg-gold text-white",
                  isCurrent &&
                    "bg-gold text-white ring-2 ring-gold ring-offset-2 ring-offset-[#03071e]",
                  !isDone && !isCurrent && "bg-white/10 text-white/40",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isDone ? "✓" : index + 1}
              </div>
              <span
                className={[
                  "text-[13px] leading-none mt-2 text-center",
                  isCurrent ? "text-white font-medium" : "text-white/50",
                ].join(" ")}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
