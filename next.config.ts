import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
  },
  // Permite abrir el dev server desde el celular en la red local (solo afecta a `next dev`)
  allowedDevOrigins: ["192.168.0.36"],
  async redirects() {
    const oldToSlug: Record<string, string> = {
      "dev-1": "kinesiologia-y-salud",
      "dev-2": "amo-mi-casa",
      "dev-3": "pedri",
      "dev-4": "salud-dental",
      "dev-5": "natalia-domecq",
      "dev-6": "nutricion-integral",
      "dev-andrea-cohen": "andrea-cohen",
      "dev-7": "estudio-juridico",
      "dev-tuturno": "tu-turno-barberia",
      "dev-8": "pablo-perez",
      "dev-peliculas": "tienda-peliculas",
      "dev-13": "aaci",
      "dev-9": "a-mar-salud",
      "dev-10": "eukinesia",
      "dev-11": "crs-informatica",
      "dev-12": "wanda-perrin",
      "dev-internet-retro": "internet-retro",
      "dev-14": "victoria-nazra",
    };
    return Object.entries(oldToSlug).map(([oldId, slug]) => ({
      source: `/projects/${oldId}`,
      destination: `/projects/${slug}`,
      permanent: true,
    }));
  },
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s44783.pcdn.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

// Bundle Analyzer - activar con ANALYZE=true npm run build
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
