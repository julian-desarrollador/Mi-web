import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./ei.css";

// Honest Greens usa fuentes propietarias (HonestGreens-ExtraBold + Basier Circle).
// Figtree es la alternativa libre más cercana: geométrica, redonda y con pesos 900 para los titulares.
const sans = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-ei-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Iván Sánchez — Chef",
  description:
    "Iván Sánchez, chef. Comida real, de temporada y sin atajos. Hoy, parte del equipo de Honest Greens.",
  openGraph: {
    title: "Iván Sánchez — Chef",
    description: "Comida real, de temporada y sin atajos.",
    images: [{ url: "/ei/ivan-sanchez.png", width: 639, height: 638, alt: "Iván Sánchez" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function EiLayout({ children }: { children: React.ReactNode }) {
  return <div className={sans.variable}>{children}</div>;
}
