import { supabaseAdmin } from "@/lib/supabase-admin";
import { StoreResetter } from "./StoreResetter";

type ParsedOption = { name: string; price: string; isFree: boolean };

function parseOptions(optionsStr: string | null): ParsedOption[] {
  if (!optionsStr) return [];
  return optionsStr.split(", ").map((item) => {
    if (item.endsWith(" (Offert)")) {
      return { name: item.slice(0, -" (Offert)".length), price: "0 €", isFree: true };
    }
    const match = item.match(/^(.*?)\s*\((\d+)\s*€\)$/);
    if (match) return { name: match[1], price: `${match[2]} €`, isFree: false };
    return { name: item, price: "", isFree: false };
  });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  if (!id) return <NotFound />;

  const { data: r } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .eq("id", id)
    .single();

  if (!r) return <NotFound />;

  const options = parseOptions(r.options);

  return (
    <>
      <StoreResetter />

      <div className="max-w-xl mx-auto space-y-5">

        {/* Signal de succès */}
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">C'est confirmé !</h1>
          <p className="mt-1 text-gray-500">
            Merci {r.customer_first_name}, votre réservation est bien enregistrée.
          </p>
        </div>

        {/* Et maintenant ? */}
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5 space-y-3">
          <h2 className="font-semibold text-gold text-center">Et maintenant&nbsp;?</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Un e-mail de confirmation vient de vous être envoyé à{" "}
            <span className="font-medium text-gray-900">{r.customer_email}</span>.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Vous y trouverez également les{" "}
            <strong className="font-semibold text-gray-900">identifiants</strong>{" "}
            qui vous permettront de préparer votre événement (personnalisation de vos
            tirages photos, etc.) sur votre{" "}
            <strong className="font-semibold text-gray-900">espace client</strong> sécurisé.
          </p>
        </div>

        {/* Récapitulatif */}
        <h2 className="text-sm font-semibold text-gray-500 text-center">Récapitulatif de votre commande</h2>
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">

          <div className="px-5 py-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Date
            </p>
            <p className="font-medium text-gray-900">{formatDate(r.event_date)}</p>
          </div>

          <div className="px-5 py-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Point de retrait
            </p>
            <p className="font-medium text-gray-900">{r.pickup_point_name}</p>
            {r.pickup_point_full_address && (
              <p className="text-sm text-gray-500 mt-0.5">{r.pickup_point_full_address}</p>
            )}
            {r.pickup_point_horaires && (
              <p className="text-sm text-gray-500 mt-2 whitespace-pre-line leading-relaxed">
                {r.pickup_point_horaires}
              </p>
            )}
          </div>

          <div className="px-5 py-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Modèle
            </p>
            <div className="flex justify-between items-baseline">
              <p className="font-medium text-gray-900">{r.model_name}</p>
              <p className="text-sm text-gray-600">{r.model_price} €</p>
            </div>
          </div>

          {options.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Options
              </p>
              <ul className="space-y-1.5">
                {options.map((o, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={o.isFree ? "text-green-700" : "text-gray-700"}>
                      {o.name}
                      {o.isFree && (
                        <span className="ml-1.5 text-green-600">(Offert)</span>
                      )}
                    </span>
                    <span className={["shrink-0", o.isFree ? "text-green-600" : "text-gray-600"].join(" ")}>
                      {o.price}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="px-5 py-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Total payé</span>
              <span className="font-bold text-lg text-gray-900">{r.total_amount} €</span>
            </div>
            {r.promo_code && (
              <p className="text-xs text-green-600 mt-1">
                Code promo <span className="font-medium">{r.promo_code}</span> appliqué
              </p>
            )}
          </div>

        </div>

        {/* Contact */}
        <p className="text-center text-sm text-gray-400 pb-4">
          Des questions ?{" "}
          <a href="tel:0952455217" className="text-gray-600 hover:underline font-medium">
            09&nbsp;52&nbsp;45&nbsp;52&nbsp;17
          </a>
        </p>

      </div>
    </>
  );
}

function NotFound() {
  return (
    <div className="text-center py-20 text-sm text-gray-400">
      Réservation introuvable.
    </div>
  );
}
