"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/admin/reservations");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erreur de connexion");
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-brand font-bold text-xl mb-8 tracking-wide uppercase">
          VIPBOX Admin
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-8 space-y-5 shadow-xl"
        >
          <h1 className="text-lg font-semibold text-gray-900">Connexion</h1>

          <div className="space-y-3">
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
