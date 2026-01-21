import AddressSearch from "@/components/AddressSearch";
import TestnetBadge from "@/components/TestnetBadge";

export default function Header() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Delphi Pulse</h1>
        <TestnetBadge />
      </div>

      <div className="flex-1 flex justify-center">
        <AddressSearch />
      </div>

      <div className="w-[140px]" />
    </header>
  );
}

