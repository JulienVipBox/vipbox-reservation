import { Calendar } from "@/components/reservation/Calendar";

export default function DatePage() {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Date de votre événement</h1>
        <p className="text-gray-600">
          Choisissez la date à laquelle vous souhaitez réserver votre
          photobooth.
        </p>
      </div>

      <div className="flex flex-col items-center">
        <Calendar />
      </div>
    </div>
  );
}
