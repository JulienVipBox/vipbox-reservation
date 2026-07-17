import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  title: { template: "VIPBOX — %s", default: "VIPBOX Admin" },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand border-b border-brand/20 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-gold font-bold tracking-wide text-sm uppercase">
            VIPBOX Admin
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/admin/disponibilites"
              className="text-white/70 hover:text-white text-xs transition-colors"
            >
              Disponibilités
            </Link>
            <Link
              href="/admin/codes-promo"
              className="text-white/70 hover:text-white text-xs transition-colors"
            >
              Codes promo
            </Link>
            <Link
              href="/admin/reservations"
              className="text-white/70 hover:text-white text-xs transition-colors"
            >
              Réservations
            </Link>
            <Link
              href="/admin/emails"
              className="text-white/70 hover:text-white text-xs transition-colors"
            >
              E-mails
            </Link>
          </nav>
        </div>
        <LogoutButton />
      </header>
      <main className="max-w-5xl mx-auto px-4 py-10">{children}</main>
    </div>
  );
}
