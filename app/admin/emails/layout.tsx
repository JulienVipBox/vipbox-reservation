import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "E-mails" };

export default function EmailsLayout({ children }: { children: ReactNode }) {
  return children;
}
