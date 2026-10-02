import type { Metadata } from "next";

const LOCAL_ICON_192 = "/admin92/contabilidad/app-icon/192?v=contabilidad-v1";
const LOCAL_ICON_512 = "/admin92/contabilidad/app-icon/512?v=contabilidad-v1";

export const metadata: Metadata = {
  manifest: "/manifest-contabilidad.webmanifest",
  appleWebApp: { title: "glomun" },
  icons: {
    icon: [{ url: LOCAL_ICON_192, type: "image/png" }],
    apple: [{ url: LOCAL_ICON_192, type: "image/png" }],
    shortcut: [{ url: LOCAL_ICON_192, type: "image/png" }],
    other: [{ rel: "mask-icon", url: LOCAL_ICON_512 }],
  },
};

export default function ContabilidadLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
