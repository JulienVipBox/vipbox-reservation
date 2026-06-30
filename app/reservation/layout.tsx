import Image from "next/image";
import Link from "next/link";
import { StepIndicator } from "@/components/reservation/StepIndicator";

export default function ReservationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <Link href="/" className="shrink-0">
            <Image
              src="https://www.vip-box.fr/wp-content/uploads/2026/04/Logo_VIPBOX_ORx300clair.png"
              alt="VIPBOX"
              width={270}
              height={90}
              className="h-[4.5rem] w-auto"
              priority
              unoptimized
            />
          </Link>
          <StepIndicator />
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        {children}
      </main>
    </div>
  );
}
