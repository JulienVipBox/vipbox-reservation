"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReservationStore } from "@/lib/store";

const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Sunday (0) → 6, Monday (1) → 0, …, Saturday (6) → 5
function sundayToMonday(day: number): number {
  return day === 0 ? 6 : day - 1;
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatFr(iso: string): string {
  const date = new Date(iso + "T12:00:00");
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Calendar() {
  const router = useRouter();
  const { eventDate, setEventDate } = useReservationStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Initialise la vue sur le mois de la date déjà sélectionnée, sinon le mois courant
  const initDate = eventDate ? new Date(eventDate + "T12:00:00") : today;
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = sundayToMonday(
    new Date(viewYear, viewMonth, 1).getDay(),
  );

  const isPrevDisabled =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth());

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const clicked = new Date(viewYear, viewMonth, day);
    if (clicked < today) return;
    setEventDate(toIso(viewYear, viewMonth, day));
  };

  const handleContinue = () => {
    router.push("/reservation/lieu");
  };

  // Cellules : cases vides + jours du mois
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-6">
      <div className="inline-block rounded-2xl border border-gray-200 p-5 select-none">
        {/* Navigation mois */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goToPrevMonth}
            disabled={isPrevDisabled}
            aria-label="Mois précédent"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            ‹
          </button>

          <span className="text-sm font-semibold text-gray-900 w-40 text-center">
            {MONTHS_FR[viewMonth]} {viewYear}
          </span>

          <button
            onClick={goToNextMonth}
            aria-label="Mois suivant"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            ›
          </button>
        </div>

        {/* En-têtes jours */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS_FR.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-medium text-gray-400 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grille jours */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;

            const iso = toIso(viewYear, viewMonth, day);
            const date = new Date(viewYear, viewMonth, day);
            const isPast = date < today;
            const isToday = date.getTime() === today.getTime();
            const isSelected = iso === eventDate;

            return (
              <button
                key={iso}
                onClick={() => handleDayClick(day)}
                disabled={isPast}
                aria-label={formatFr(iso)}
                aria-pressed={isSelected}
                className={[
                  "mx-auto w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors",
                  isPast && "text-gray-200 cursor-not-allowed",
                  !isPast &&
                    !isSelected &&
                    "text-gray-900 hover:bg-gray-100 cursor-pointer",
                  isSelected && "bg-gray-900 text-white font-semibold",
                  isToday && !isSelected && "ring-1 ring-inset ring-gray-400",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date sélectionnée + CTA */}
      <div className="space-y-4">
        {eventDate ? (
          <p className="text-sm text-gray-600">
            Date choisie :{" "}
            <span className="font-semibold text-gray-900 capitalize">
              {formatFr(eventDate)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-gray-400">
            Cliquez sur une date pour la sélectionner.
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={!eventDate}
          className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continuer
          <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
