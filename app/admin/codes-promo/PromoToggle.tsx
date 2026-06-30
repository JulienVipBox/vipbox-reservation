"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PromoToggle({ id, active, code }: { id: string; active: boolean; code: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [current, setCurrent] = useState(active);

  const toggle = async () => {
    setPending(true);
    const res = await fetch("/api/admin/codes-promo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !current }),
    });
    if (res.ok) {
      setCurrent((v) => !v);
      router.refresh();
    }
    setPending(false);
  };

  const remove = async () => {
    if (!confirm(`Supprimer le code « ${code} » ? Cette action est irréversible.`)) return;
    setPending(true);
    const res = await fetch("/api/admin/codes-promo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) router.refresh();
    else setPending(false);
  };

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={toggle}
        disabled={pending}
        aria-label={current ? "Désactiver" : "Activer"}
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
          current ? "bg-green-500" : "bg-gray-300",
          pending ? "opacity-50" : "",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            current ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>

      <button
        onClick={remove}
        disabled={pending}
        aria-label="Supprimer"
        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30"
        title="Supprimer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
