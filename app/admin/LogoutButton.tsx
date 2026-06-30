"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <button
      onClick={logout}
      className="text-xs text-gray-400 hover:text-white transition-colors"
    >
      Déconnexion
    </button>
  );
}
