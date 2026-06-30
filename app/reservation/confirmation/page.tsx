import Link from "next/link";

export default function ConfirmationPage() {
  return (
    <div className="space-y-8 text-center py-12">
      <div className="space-y-4">
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold">Réservation confirmée !</h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Un email de confirmation vous a été envoyé. Votre contrat de location
          sera disponible dans votre boîte mail sous 24h.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center text-gray-400">
        Détails de confirmation + numéro de réservation — à implémenter
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        ← Retour à l&apos;accueil
      </Link>
    </div>
  );
}
