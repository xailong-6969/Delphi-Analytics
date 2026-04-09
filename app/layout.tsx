import "./globals.css";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PageTransitionProvider from "@/components/PageTransitionProvider";
import LiveTicker from "@/components/LiveTicker";
import ParticleBackground from "@/components/ParticleBackground";
import { SpiralAnimation } from "@/components/ui/spiral-animation";

export const metadata: Metadata = {
  title: "Delphi Analytics | Gensyn Testnet",
  description: "Track prediction markets, analyze trading patterns, and view P&L for Delphi on Gensyn Testnet.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/bat-logo.png", type: "image/png" },
    ],
    apple: "/bat-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen overflow-x-hidden antialiased">
        <div className="app-background" aria-hidden="true">
          <div className="app-background-aurora app-background-aurora-violet" />
          <div className="app-background-aurora app-background-aurora-cyan" />
          <div className="app-background-aurora app-background-aurora-emerald" />
          <div className="app-background-grid" />
          <div className="app-background-spiral">
            <SpiralAnimation
              particleColor="rgba(198, 166, 255, 0.98)"
              trailLength={60}
              starCount={1800}
            />
          </div>
          <div className="app-background-vignette" />
          <ParticleBackground />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col">
          <Header />
          <LiveTicker />
          <main className="relative z-10 flex-1">
            <PageTransitionProvider>{children}</PageTransitionProvider>
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
