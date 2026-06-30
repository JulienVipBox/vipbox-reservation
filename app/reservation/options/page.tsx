import { OptionsSelector } from "@/components/reservation/OptionsSelector";

export default function OptionsPage() {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Options</h1>
        <p className="text-gray-600">
          Personnalisez votre location avec des options supplémentaires.
        </p>
      </div>

      <OptionsSelector />
    </div>
  );
}
