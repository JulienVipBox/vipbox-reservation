import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PickupPoint, PhotoboothModel, Option, CustomerInfo } from "@/types";

export type PromoEffect = {
  discountAmount: number; // remise fixe en €
  freeOptionIds: string[]; // IDs des options offertes (affichées à 0€)
};

type ReservationStore = {
  clientType: "particulier" | "professionnel" | null;
  eventDate: string | null; // YYYY-MM-DD
  pickupPoint: PickupPoint | null;
  model: PhotoboothModel | null;
  promoCode: string | null;
  promoEffect: PromoEffect | null;
  promoAutoApplied: boolean; // true = appliqué via yield management, false = saisi manuellement
  options: Option[];
  customer: CustomerInfo | null;
  reservationId: string | null; // UUID Supabase, créé à l'arrivée sur la page Paiement

  setClientType: (type: "particulier" | "professionnel") => void;
  setEventDate: (date: string) => void;
  setPickupPoint: (pp: PickupPoint) => void;
  setModel: (model: PhotoboothModel) => void;
  applyPromoCode: (code: string, effect: PromoEffect | null, auto?: boolean) => void;
  clearPromoCode: () => void;
  toggleOption: (option: Option) => void;
  setCustomer: (customer: CustomerInfo) => void;
  setReservationId: (id: string) => void;
  reset: () => void;
  // Retour à une étape antérieure (clic sur l'en-tête d'étapes) : efface les
  // choix des étapes suivantes, jamais ceux des étapes précédentes ou de
  // l'étape ciblée elle-même. `stepIndex` = index de l'étape vers laquelle on
  // navigue (0 = Date, 1 = Lieu, 2 = Modèle, 3 = Promo, 4 = Options,
  // 5 = Récap, 6 = Contact, 7 = Paiement — voir STEPS dans StepIndicator.tsx).
  resetFrom: (stepIndex: number) => void;
};

const initialState = {
  clientType: null,
  eventDate: null,
  pickupPoint: null,
  model: null,
  promoCode: null,
  promoEffect: null,
  promoAutoApplied: false,
  options: [] as Option[],
  customer: null,
  reservationId: null,
} satisfies Partial<ReservationStore>;

export const useReservationStore = create<ReservationStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setClientType: (type) => set({ clientType: type }),

      setEventDate: (date) => set({ eventDate: date }),

      // Resetting model + promo + options when PR changes
      setPickupPoint: (pp) =>
        set({ pickupPoint: pp, model: null, promoCode: null, promoEffect: null, promoAutoApplied: false, options: [] }),

      // Resetting promo + options when model changes (free option IDs are model-specific)
      setModel: (model) =>
        set({ model, promoCode: null, promoEffect: null, promoAutoApplied: false, options: [] }),

      applyPromoCode: (code, effect, auto = false) =>
        set({ promoCode: code, promoEffect: effect, promoAutoApplied: auto }),

      clearPromoCode: () => set({ promoCode: null, promoEffect: null, promoAutoApplied: false }),

      toggleOption: (option) => {
        const { options, promoEffect } = get();
        // Free options can't be toggled off
        if (promoEffect?.freeOptionIds.includes(option.id)) return;
        const exists = options.some((o) => o.id === option.id);
        set({
          options: exists
            ? options.filter((o) => o.id !== option.id)
            : [...options, option],
        });
      },

      setCustomer: (customer) => set({ customer }),

      setReservationId: (id) => set({ reservationId: id }),

      reset: () => set(initialState),

      resetFrom: (stepIndex) => {
        const updates: Partial<ReservationStore> = {};
        if (stepIndex < 1) updates.pickupPoint = null;
        if (stepIndex < 2) updates.model = null;
        if (stepIndex < 3) {
          updates.promoCode = null;
          updates.promoEffect = null;
          updates.promoAutoApplied = false;
        }
        if (stepIndex < 4) updates.options = [];
        if (stepIndex < 6) updates.customer = null;
        if (stepIndex < 7) updates.reservationId = null;
        set(updates);
      },
    }),
    {
      name: "vipbox-reservation",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
