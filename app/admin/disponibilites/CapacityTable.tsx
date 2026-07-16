"use client";

import { useState } from "react";
import type { CapacityField } from "@/lib/crm";

export type CapacityRow = {
  crmId: number;
  name: string;
  postalCode: string;
  reservation_maximum_classic: number | null;
  reservation_maximum_smart: number | null;
  reservation_maximum_360: number | null;
};

const FIELDS: { key: CapacityField; label: string }[] = [
  { key: "reservation_maximum_classic", label: "Classic" },
  { key: "reservation_maximum_smart", label: "Smart" },
  { key: "reservation_maximum_360", label: "Spinner 360°" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

export function CapacityTable({ rows: initialRows }: { rows: CapacityRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});

  async function handleSave(crmId: number, field: CapacityField, rawValue: string) {
    const key = `${crmId}-${field}`;
    const value = rawValue.trim() === "" ? 0 : Number(rawValue);

    if (!Number.isInteger(value) || value < 0) {
      setSaveState((s) => ({ ...s, [key]: "error" }));
      return;
    }

    setRows((rs) => rs.map((r) => (r.crmId === crmId ? { ...r, [field]: value } : r)));
    setSaveState((s) => ({ ...s, [key]: "saving" }));

    try {
      const res = await fetch("/api/admin/disponibilites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmId, field, value }),
      });
      if (!res.ok) throw new Error();
      setSaveState((s) => ({ ...s, [key]: "saved" }));
      setTimeout(() => setSaveState((s) => ({ ...s, [key]: "idle" })), 1500);
    } catch {
      setSaveState((s) => ({ ...s, [key]: "error" }));
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-3 font-medium text-gray-500">Point de retrait</th>
            {FIELDS.map((f) => (
              <th key={f.key} className="text-center px-4 py-3 font-medium text-gray-500">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.crmId} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2 text-gray-700">
                {r.name} <span className="text-gray-400">({r.postalCode})</span>
              </td>
              {FIELDS.map((f) => {
                const key = `${r.crmId}-${f.key}`;
                const state = saveState[key] ?? "idle";
                return (
                  <td key={f.key} className="relative px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={r[f.key] ?? ""}
                      onBlur={(e) => handleSave(r.crmId, f.key, e.target.value)}
                      className={[
                        "mx-auto block w-16 rounded-lg border px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-brand/30",
                        state === "error" ? "border-red-400" : "border-gray-200",
                      ].join(" ")}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">
                      {state === "saving" && <span className="text-gray-400">…</span>}
                      {state === "saved" && <span className="text-green-600">✓</span>}
                      {state === "error" && <span className="text-red-600">!</span>}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
