"use client";

import { useEffect } from "react";
import { useReservationStore } from "@/lib/store";

export function StoreResetter() {
  const reset = useReservationStore((s) => s.reset);
  useEffect(() => {
    reset();
  }, [reset]);
  return null;
}
