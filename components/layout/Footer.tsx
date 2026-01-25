import Link from "next/link";
import { LINKS, DELPHI_PROXY } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span>Tracking</span>
            <a 
              href={LINKS.contract} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {DELPHI_PROXY.slice(0, 10)}...{DELPHI_PROXY.slice(-6)}
            </a>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <a 
              href={LINKS.delphi} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Delphi Markets
            </a>
            <a 
              href={LINKS.explorer} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Explorer
            </a>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">
              Built by <span className="text-purple-400">xailong_6969</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
