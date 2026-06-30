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
  options: Option[];
  customer: CustomerInfo | null;
  reservationId: string | null; // UUID Supabase, créé à l'arrivée sur la page Paiement

  setClientType: (type: "particulier" | "professionnel") => void;
  setEventDate: (date: string) => void;
  setPickupPoint: (pp: PickupPoint) => void;
  setModel: (model: PhotoboothModel) => void;
  applyPromoCode: (code: string, effect: PromoEffect | null) => void;
  clearPromoCode: () => void;
  toggleOption: (option: Option) => void;
  setCustomer: (customer: CustomerInfo) => void;
  setReservationId: (id: string) => void;
  reset: () => void;
};

const initialState = {
  clientType: null,
  eventDate: null,
  pickupPoint: null,
  model: null,
  promoCode: null,
  promoEffect: null,
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
        set({ pickupPoint: pp, model: null, promoCode: null, promoEffect: null, options: [] }),

      // Resetting promo + options when model changes (free option IDs are model-specific)
      setModel: (model) =>
        set({ model, promoCode: null, promoEffect: null, options: [] }),

      applyPromoCode: (code, effect) => set({ promoCode: code, promoEffect: effect }),

      clearPromoCode: () => set({ promoCode: null, promoEffect: null }),

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
    }),
    {
      name: "vipbox-reservation",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
