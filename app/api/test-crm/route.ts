// Route de test — à supprimer avant la mise en ligne
// Crée un enregistrement TEST dans la table prestations du CRM
// Accessible via GET http://localhost:3000/api/test-crm

import { NextResponse } from "next/server";
import { postToCrm } from "@/lib/crm";

export async function GET() {
  try {
    const crmId = await postToCrm(
      {
        eventDate: "2026-08-15",
        crmPickupPointId: 16, // Sophia Antipolis
        chefProjetId: 669,    // Mike Wolff
        programmateurId: 193, // Florent Dizien
        modelSlug: "vipbox-classic",
        selectedOptionIds: ["classic-gif", "classic-boomerang"],
        total: 370,
        firstName: "TEST",
        lastName: "CLAUDE — À supprimer",
        email: "julien@vip-box.fr",
        phone: "0600000000",
        address: "1 rue de la Paix",
        city: "Paris",
        postalCode: "75001",
        promoCode: null,
        paymentMethod: "Carte bancaire",
      },
      "prestations",
    );

    return NextResponse.json({
      success: true,
      crmId,
      message: `Enregistrement créé dans prestations avec l'ID ${crmId}`,
      lien: "https://base.serveurdms.com/prestationslist.php",
    });
  } catch (err) {
    console.error("[test-crm] Erreur:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    );
  }
}
