// Contenido de la landing /ei — Iván Sánchez.
// Los textos están todos acá para poder editarlos sin tocar el diseño.

export const EASE = [0.16, 1, 0.3, 1] as const;

export const img = (id: string, w = 1400) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const PERSON = {
  first: "Iván",
  last: "Sánchez",
  photo: "/ei/ivan-sanchez.png",
  // TODO: reemplazar por el cargo exacto de Iván en Honest Greens.
  role: "Chef",
  company: "Honest Greens",
  companyUrl: "https://www.honestgreens.com/es/",
};

export const NAV_LINKS = [
  { href: "#sobre-mi", label: "Sobre mí" },
  { href: "#cocina", label: "Mi cocina" },
  { href: "#honest-greens", label: "Honest Greens" },
  { href: "#contacto", label: "Contacto" },
];

export const MARQUEE = ["Comida real.", "De temporada.", "Sin ultraprocesados.", "Hecho con intención.", "Para todos los días."];

export const ABOUT = {
  title: ["Cocina", "sin atajos."],
  paragraphs: [
    "Para Iván, comer bien no debería ser complicado, ni caro, ni algo reservado para un domingo. Debería ser lo normal.",
    "Su cocina parte del producto: verdura de temporada, proteína de origen responsable y recetas que se entienden al primer bocado. Sin trucos, sin ultraprocesados, sin conservantes.",
  ],
  image: img("1543339308-43e59d6b73a6", 1200),
};

export const DISHES = [
  { label: "Bowls de temporada", image: img("1546069901-ba9599a7e63c", 900) },
  { label: "Market plates", image: img("1547592180-85f173990554", 900) },
  { label: "Verde, mucho verde", image: img("1511690743698-d9d85f2fbf38", 900) },
  { label: "Para compartir", image: img("1490645935967-10de6ba17061", 900) },
  { label: "Del mercado", image: img("1498837167922-ddd27525d352", 900) },
  { label: "Café de especialidad", image: img("1495474472287-4d71bcdd2085", 900) },
];

// Franjas verdes, en la misma escala que usa Honest Greens
export const PRINCIPLES = [
  { word: "Real.", text: "Ingredientes que reconoces. Nada que no pondrías en tu cocina.", bg: "bg-ei-lime" },
  { word: "Temporada.", text: "El menú lo marca el calendario, no la costumbre.", bg: "bg-ei-sprout" },
  { word: "Honesto.", text: "Origen ético, procesos claros y precios justos.", bg: "bg-ei-mint" },
  { word: "Para todos.", text: "Comer bien tiene que ser fácil, rico y del día a día.", bg: "bg-ei-green" },
];

export const HG = {
  images: [img("1512621776951-a57141f2eefd", 1000), img("1540189549336-e6e99c3679fe", 1000)],
};

export const CONTACT_REASONS = ["Colaboración", "Evento", "Prensa", "Otro"];
