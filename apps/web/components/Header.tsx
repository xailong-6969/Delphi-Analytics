import AddressSearch from "@/components/AddressSearch";

export default function Header() {
  return (
    <header className="border-b border-neutral-800 bg-black">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between gap-8">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">
              Delphi Analytics
            </h1>
            <span className="rounded bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 border border-blue-500/20">
              Testnet
            </span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <AddressSearch />
          </div>
        </div>
      </div>
    </header>
  );
}
