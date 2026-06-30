import Image from "next/image";
import { ProfileCards } from "@/components/reservation/ProfileCards";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full text-center space-y-8">
        <div className="space-y-3">
          <Image
            src="https://www.vip-box.fr/wp-content/uploads/2026/02/Logo_VIPBOX_OR.png"
            alt="VIPBOX"
            width={182}
            height={63}
            className="mx-auto w-[182px] h-auto"
            priority
            unoptimized
          />
          <p className="text-gray-600">
            Sélectionnez votre profil pour commencer la réservation.
          </p>
        </div>

        <ProfileCards />
      </div>
    </main>
  );
}
