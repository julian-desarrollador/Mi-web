"use client";

import Image from "next/image";
import { AnimatePresence, MotionConfig, motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE, MARQUEE, NAV_LINKS, PERSON } from "./data";
import { ArrowNE, ArrowRight, Eyebrow, PillButton } from "./ui";
import { About, Contact, Footer, HonestGreens, Kitchen, Principles } from "./Sections";

export default function EiLanding() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="ei-root relative min-h-screen bg-white text-ei-ink antialiased">
        <ScrollProgress />
        <Nav />
        <main>
          <Hero />
          <Marquee />
          <About />
          <Kitchen />
          <Principles />
          <HonestGreens />
          <Contact />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}

/* ───────────────────────────── Progreso + Nav ───────────────────────────── */

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-ei-green"
      style={{ scaleX }}
      aria-hidden
    />
  );
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`text-[19px] font-semibold lowercase tracking-[-0.03em] sm:text-[21px] ${className}`}>
      {PERSON.first} {PERSON.last}
      <sup className="ml-px text-[0.5em] font-medium">°</sup>
    </span>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("ei-lock");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("ei-lock");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,padding] duration-300 ${
          open
            ? "bg-transparent py-4 text-white"
            : scrolled
              ? "bg-white py-3 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
              : "bg-transparent py-4 sm:py-6"
        }`}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 md:px-10">
          <a href="#top" aria-label="Inicio" className="relative z-[80]" onClick={() => setOpen(false)}>
            <Logo />
          </a>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
            {NAV_LINKS.slice(0, 3).map((l) => (
              <a key={l.href} href={l.href} className="text-[15px] font-medium transition-opacity hover:opacity-50">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#contacto"
              className="hidden items-center gap-1.5 text-[14px] font-bold uppercase tracking-[0.1em] transition-opacity hover:opacity-50 lg:inline-flex"
            >
              Contacto <ArrowNE className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="relative z-[80] -mr-2 flex h-12 w-12 flex-col items-center justify-center gap-[7px] lg:hidden"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
            >
              <span
                className={`h-[2px] w-6 bg-current transition-transform duration-300 ${open ? "translate-y-[4.5px] rotate-45" : ""}`}
              />
              <span
                className={`h-[2px] w-6 bg-current transition-transform duration-300 ${open ? "-translate-y-[4.5px] -rotate-45" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[55] flex flex-col justify-between overflow-y-auto bg-ei-ink px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-28 text-white lg:hidden"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          >
            <nav className="flex flex-col" aria-label="Menú móvil">
              {NAV_LINKS.map((l, i) => (
                <div key={l.href} className="overflow-hidden border-b border-white/15">
                  <motion.a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="ei-display flex items-center justify-between py-4 text-[clamp(2.4rem,12vw,4.5rem)]"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.2 + i * 0.06 }}
                  >
                    {l.label}.
                    <ArrowRight className="h-6 w-6 text-ei-green" />
                  </motion.a>
                </div>
              ))}
            </nav>
            <p className="mt-10 text-sm text-white/60">
              {PERSON.role} · {PERSON.company}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ───────────────────────────── Hero ───────────────────────────── */

function NameLine({ text, delay }: { text: string; delay: number }) {
  return (
    <span className="block overflow-hidden pb-[0.03em] pt-[0.12em]" aria-hidden>
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 1, ease: EASE, delay: delay + i * 0.04 }}
        >
          {ch === " " ? " " : ch}
        </motion.span>
      ))}
    </span>
  );
}

function Sticker() {
  const text = "COMIDA REAL · DE TEMPORADA · SIN ATAJOS · ";
  return (
    <div className="relative grid h-24 w-24 place-items-center rounded-full bg-ei-green text-ei-ink sm:h-32 sm:w-32">
      <svg viewBox="0 0 100 100" className="ei-spin absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <path id="ei-circle" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
        </defs>
        <text className="fill-current text-[8.6px] font-bold tracking-[0.12em]">
          <textPath href="#ei-circle">{text}</textPath>
        </text>
      </svg>
      <ArrowNE className="h-6 w-6 sm:h-8 sm:w-8" />
    </div>
  );
}

function Hero() {
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, ease: EASE, delay },
  });

  return (
    <section id="top" className="relative px-5 pb-14 pt-24 sm:pt-28 md:px-10 lg:flex lg:min-h-[100svh] lg:items-center lg:pb-16 lg:pt-28">
      <div className="mx-auto grid w-full max-w-[1440px] gap-x-12 gap-y-8 lg:grid-cols-12 lg:items-end">
        {/* Nombre */}
        <div className="lg:col-span-7 lg:row-start-1">
          <motion.div {...fade(0.05)}>
            <Eyebrow>
              {PERSON.role} · {PERSON.company}
            </Eyebrow>
          </motion.div>
          <h1
            aria-label={`${PERSON.first} ${PERSON.last}`}
            className="ei-display mt-3 text-[17.5vw] sm:text-[15vw] lg:text-[min(9.4vw,148px)]"
          >
            <NameLine text={PERSON.first} delay={0.1} />
            <NameLine text={`${PERSON.last}.`} delay={0.25} />
          </h1>
        </div>

        {/* Foto */}
        <motion.div
          className="relative lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1"
          initial={{ opacity: 0, clipPath: "inset(12% 12% 12% 12%)" }}
          animate={{ opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
        >
          <div className="relative aspect-square w-full overflow-hidden bg-ei-sand">
            <motion.div
              className="absolute inset-0"
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.8, ease: EASE, delay: 0.3 }}
            >
              <Image
                src={PERSON.photo}
                alt={`${PERSON.first} ${PERSON.last}`}
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </motion.div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px] font-medium uppercase tracking-[0.06em] text-ei-mute">
            <span>{PERSON.first}, fuera de la cocina</span>
            <span>01</span>
          </div>
          <motion.div
            className="absolute -left-3 -top-8 sm:-left-8 sm:-top-10"
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 1 }}
          >
            <a href="#cocina" aria-label="Ver su cocina">
              <Sticker />
            </a>
          </motion.div>
        </motion.div>

        {/* Bajada + CTAs */}
        <motion.div className="lg:col-span-6 lg:row-start-2" {...fade(0.6)}>
          <p className="max-w-xl text-[19px] font-medium leading-[1.35] tracking-[-0.01em] sm:text-[22px]">
            Cocina comida real para el día a día: producto de temporada, recetas honestas y sabor sin atajos.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <PillButton href="#contacto">Hablemos</PillButton>
            <a
              href="#cocina"
              className="group inline-flex min-h-12 items-center justify-center gap-2 text-[16px] font-semibold sm:justify-start"
            >
              Su cocina <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Marquee ───────────────────────────── */

function Marquee() {
  return (
    <section className="overflow-hidden bg-ei-ink py-6 text-white sm:py-9" aria-label={MARQUEE.join(" ")}>
      <div className="ei-marquee flex w-max">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center" aria-hidden>
            {MARQUEE.map((w) => (
              <span key={w} className="flex items-center">
                <span className="ei-display px-5 text-[clamp(2.2rem,7vw,6rem)] sm:px-8">{w}</span>
                <span className="h-3 w-3 shrink-0 rounded-full bg-ei-green sm:h-4 sm:w-4" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
