import type { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-brand border-b border-brand/20 px-6 py-4 flex items-center justify-between">
        <span className="text-gold font-bold tracking-wide text-sm uppercase">
          VIPBOX Admin
        </span>
        <LogoutButton />
      </header>
      <main className="max-w-5xl mx-auto px-4 py-10">{children}</main>
    </div>
  );
}
