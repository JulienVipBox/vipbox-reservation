export default function ProPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24">
      <div className="max-w-md w-full text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Demande de devis</h1>
          <p className="text-gray-600">
            Le formulaire de demande de devis pour les professionnels sera
            disponible très prochainement.
          </p>
        </div>

        <div className="mt-8">
          <a
            href="https://www.vip-box.fr/contact"
            className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
          >
            Nous contacter via vip-box.fr →
          </a>
        </div>
      </div>
    </main>
  );
}
