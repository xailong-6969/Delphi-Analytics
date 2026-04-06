import "./globals.css";
import { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PageTransitionProvider from "@/components/PageTransitionProvider";
import LiveTicker from "@/components/LiveTicker";

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
      <body className="min-h-screen flex flex-col antialiased">
        <Header />
        <LiveTicker />
        <main className="flex-1">
          <PageTransitionProvider>{children}</PageTransitionProvider>
        </main>
        <Footer />
      </body>
    </html>
  );
}
