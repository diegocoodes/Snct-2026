import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Montserrat, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { readPublicSnctStore } from "@/lib/snct-store";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SNCT Paulista 2026",
  description: "Semana Nacional de Ciência e Tecnologia — Paulista 2026",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { settings } = await readPublicSnctStore();
  const paletteStyle = {
    "--palette-purple-deep": settings.palette.background,
    "--palette-purple-dark": settings.palette.surface,
    "--palette-purple-vibrant": settings.palette.primary,
    "--palette-magenta-neon": settings.palette.secondary,
    "--palette-cyan-electric": settings.palette.accent,
    "--palette-ice-white": settings.palette.text,
  } as CSSProperties;

  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} ${poppins.variable} h-full font-sans antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={paletteStyle}
        suppressHydrationWarning
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
