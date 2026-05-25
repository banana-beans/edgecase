import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";

export const metadata: Metadata = {
  title: "edgecase — quant interview prep",
  description:
    "Zero-to-hero quant interview prep. Probability, pricing, stats, and HFT C++ — drilled daily.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "edgecase",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0d12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[var(--background)] text-[var(--foreground)] antialiased">
        <div className="min-h-dvh">
          {/* Mobile header */}
          <header
            className="sticky top-0 z-20 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-sm"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              height: "calc(3.5rem + env(safe-area-inset-top))",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--accent-blue)] flex items-center justify-center font-black text-white text-xs">
                E
              </div>
              <span className="font-bold text-[var(--foreground)] text-sm tracking-tight">
                edgecase
              </span>
            </div>
            <span className="text-[10px] tabular-nums text-[var(--text-muted)] uppercase tracking-wider">
              quant prep
            </span>
          </header>

          <main className="pb-nav-safe">{children}</main>
        </div>

        <BottomNav />
      </body>
    </html>
  );
}
