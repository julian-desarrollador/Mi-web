"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, type FormEvent } from "react";
import { ABOUT, CONTACT_REASONS, DISHES, EASE, HG, NAV_LINKS, PERSON, PRINCIPLES } from "./data";
import { ArrowNE, ArrowRight, DisplayTitle, Eyebrow, Reveal } from "./ui";

const PAD = "px-5 md:px-10";
const WRAP = "mx-auto w-full max-w-[1440px]";

/* ───────────────────────────── Sobre mí ───────────────────────────── */

export function About() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <section id="sobre-mi" className={`scroll-mt-16 bg-ei-cream py-20 sm:py-28 lg:py-36 ${PAD}`}>
      <div className={`${WRAP} grid gap-12 lg:grid-cols-12 lg:gap-16`}>
        <div ref={ref} className="order-2 lg:order-1 lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden bg-ei-sand">
            <motion.div className="absolute inset-[-8%_0]" style={{ y }}>
              <Image
                src={ABOUT.image}
                alt="Bowl de verduras de temporada"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-cover"
              />
            </motion.div>
          </div>
        </div>

        <div className="order-1 flex flex-col justify-center lg:order-2 lg:col-span-6 lg:col-start-7">
          <Eyebrow>Sobre {PERSON.first}</Eyebrow>
          <DisplayTitle lines={ABOUT.title} className="mt-4 text-[clamp(3.2rem,13vw,8.5rem)] lg:text-[min(8.6vw,8.5rem)]" />
          <div className="mt-8 space-y-5 sm:mt-10">
            {ABOUT.paragraphs.map((p, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <p className="max-w-xl text-[17px] leading-[1.55] sm:text-[19px]">{p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Mi cocina (carrusel) ───────────────────────────── */

export function Kitchen() {
  const scroller = useRef<HTMLDivElement>(null);

  const go = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 300) + 24), behavior: "smooth" });
  };

  return (
    <section id="cocina" className="scroll-mt-16 bg-white py-20 sm:py-28 lg:py-36">
      <div className={`${WRAP} ${PAD}`}>
        <Eyebrow>Explora su cocina</Eyebrow>
        <div className="mt-4 flex items-end justify-between gap-6">
          <DisplayTitle lines={["Lo que", "cocina."]} className="text-[clamp(3.2rem,13vw,8.5rem)] lg:text-[min(8.6vw,8.5rem)]" />
          <div className="hidden shrink-0 gap-2 pb-2 sm:flex">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Anterior"
              className="grid h-12 w-12 place-items-center rounded-full border-[1.5px] border-ei-ink transition-colors hover:bg-ei-ink hover:text-white"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Siguiente"
              className="grid h-12 w-12 place-items-center rounded-full bg-ei-ink text-white transition-colors hover:bg-ei-green hover:text-ei-ink"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scroller}
        className="ei-noscrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 sm:mt-14 sm:gap-6 md:scroll-px-10 md:px-10 xl:px-[max(2.5rem,calc((100vw-1440px)/2+2.5rem))]"
        aria-label="Platos"
      >
        {DISHES.map((d, i) => (
          <motion.a
            key={d.label}
            href="#contacto"
            data-card
            className="group w-[78vw] shrink-0 snap-start sm:w-[42vw] lg:w-[calc((min(100vw,1440px)-5rem-3rem)/3.4)]"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, ease: EASE, delay: Math.min(i, 3) * 0.08 }}
          >
            <div className="relative aspect-square overflow-hidden bg-ei-sand">
              <Image
                src={d.image}
                alt={d.label}
                fill
                sizes="(min-width: 1024px) 28vw, (min-width: 640px) 42vw, 78vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            </div>
            <p className="mt-4 flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em] sm:text-[28px]">
              {d.label}
              <ArrowRight className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
            </p>
          </motion.a>
        ))}
        <div className="w-px shrink-0" aria-hidden />
      </div>
      <p className={`${WRAP} ${PAD} mt-4 text-[13px] text-ei-mute sm:hidden`}>Desliza para ver más →</p>
    </section>
  );
}

/* ───────────────────────────── Principios (franjas verdes) ───────────────────────────── */

export function Principles() {
  return (
    <section aria-label="Sus principios" className="overflow-hidden">
      {PRINCIPLES.map((p, i) => (
        <motion.div
          key={p.word}
          className={`${p.bg} ${PAD}`}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
        >
          <div className={`${WRAP} grid items-center gap-x-8 gap-y-2 py-6 sm:py-8 lg:grid-cols-12 lg:py-6`}>
            <span className="hidden text-[13px] font-semibold uppercase lg:col-span-2 lg:block">0{i + 1}</span>
            <div className="overflow-hidden lg:col-span-7">
              <motion.p
                className="ei-display whitespace-nowrap text-[12vw] sm:text-[11vw] lg:text-center lg:text-[min(6.4vw,7.5rem)]"
                variants={{ hidden: { y: "100%" }, show: { y: "0%" } }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.05 }}
              >
                {p.word}
              </motion.p>
            </div>
            <p className="max-w-sm text-[16px] font-medium leading-snug sm:text-[17px] lg:col-span-3">{p.text}</p>
          </div>
        </motion.div>
      ))}
    </section>
  );
}

/* ───────────────────────────── Honest Greens ───────────────────────────── */

export function HonestGreens() {
  return (
    <section id="honest-greens" className={`scroll-mt-16 bg-ei-ink py-20 text-white sm:py-28 lg:py-36 ${PAD}`}>
      <div className={`${WRAP} grid gap-14 lg:grid-cols-12 lg:gap-16`}>
        <div className="lg:col-span-6">
          <Eyebrow className="text-ei-green">Hoy</Eyebrow>
          <DisplayTitle lines={["En Honest", "Greens."]} className="mt-4 text-[clamp(3.2rem,13vw,8.5rem)] lg:text-[min(8.6vw,8.5rem)]" />
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-lg text-[17px] leading-[1.55] text-white/80 sm:text-[19px]">
              {PERSON.first} forma parte de {PERSON.company}, la cadena que quiere que comer comida real sea fácil,
              apetecible y cotidiano. Una forma de cocinar que encaja con la suya: buen producto, origen ético y nada de
              ultraprocesados.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <dl className="mt-10 grid max-w-lg grid-cols-2 border-t border-white/20">
              <div className="border-r border-white/20 py-5 pr-4">
                <dt className="text-[12px] font-semibold uppercase text-white/50">Cargo</dt>
                <dd className="mt-1 text-[20px] font-semibold tracking-[-0.02em] sm:text-[24px]">{PERSON.role}</dd>
              </div>
              <div className="py-5 pl-4 sm:pl-6">
                <dt className="text-[12px] font-semibold uppercase text-white/50">Equipo</dt>
                <dd className="mt-1 text-[20px] font-semibold tracking-[-0.02em] sm:text-[24px]">{PERSON.company}</dd>
              </div>
            </dl>
            <a
              href={PERSON.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-[14px] font-bold uppercase tracking-[0.08em] text-ei-ink transition-colors hover:bg-ei-green"
            >
              honestgreens.com
              <ArrowNE className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </Reveal>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:col-span-6 lg:self-end">
          {HG.images.map((src, i) => (
            <Reveal key={src} delay={i * 0.12} y={60} className={i === 1 ? "mt-10 sm:mt-20" : ""}>
              <div className="relative aspect-[3/4] overflow-hidden bg-white/10">
                <Image src={src} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Contacto ───────────────────────────── */

export function Contact() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setName(String(data.get("nombre") ?? "").trim().split(" ")[0]);
    setSent(true);
  };

  return (
    <section id="contacto" className={`scroll-mt-16 bg-ei-sand py-20 sm:py-28 lg:py-36 ${PAD}`}>
      <div className={`${WRAP} grid gap-12 lg:grid-cols-12 lg:gap-16`}>
        <div className="lg:col-span-5">
          <Eyebrow>Contacto</Eyebrow>
          <DisplayTitle lines={["Hablemos."]} className="mt-4 text-[clamp(2.6rem,13vw,8.5rem)] lg:text-[min(6vw,6rem)]" />
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-md text-[17px] leading-[1.55] sm:text-[19px]">
              Colaboraciones, eventos, prensa o simplemente hablar de comida. Escríbele y te responde personalmente.
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <AnimatePresence mode="wait">
            {!sent ? (
              <motion.form
                key="form"
                onSubmit={onSubmit}
                className="grid gap-7"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <fieldset>
                  <legend className="text-[12px] font-semibold uppercase">Motivo</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CONTACT_REASONS.map((r, i) => (
                      <label
                        key={r}
                        className="cursor-pointer rounded-full border-[1.5px] border-ei-ink px-4 py-2.5 text-[15px] font-semibold transition-colors has-[:checked]:bg-ei-ink has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ei-green"
                      >
                        <input type="radio" name="motivo" value={r} defaultChecked={i === 0} className="sr-only" />
                        {r}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid gap-7 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[12px] font-semibold uppercase">Nombre</span>
                    <input name="nombre" required autoComplete="name" placeholder="Tu nombre" className="ei-input" />
                  </label>
                  <label className="block">
                    <span className="text-[12px] font-semibold uppercase">Email</span>
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      placeholder="tu@email.com"
                      className="ei-input"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[12px] font-semibold uppercase">Mensaje</span>
                  <textarea name="mensaje" required rows={3} placeholder="Cuéntale un poco" className="ei-input resize-none" />
                </label>

                <button
                  type="submit"
                  className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-ei-ink px-8 text-[15px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-ei-green hover:text-ei-ink sm:w-auto sm:justify-self-start"
                >
                  Enviar
                  <ArrowNE className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="ok"
                role="status"
                className="flex min-h-[340px] flex-col justify-center"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE }}
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-ei-green">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="square" />
                  </svg>
                </span>
                <p className="ei-display mt-6 text-[clamp(2.8rem,10vw,5rem)]">Gracias{name ? `, ${name}` : ""}.</p>
                <p className="mt-4 max-w-md text-[17px] leading-relaxed">Mensaje recibido. {PERSON.first} te responderá muy pronto.</p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-8 min-h-12 self-start text-[14px] font-bold uppercase tracking-[0.08em] underline underline-offset-4"
                >
                  Enviar otro mensaje
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── Footer ───────────────────────────── */

export function Footer() {
  return (
    <footer className={`overflow-hidden bg-ei-ink pt-16 text-white sm:pt-20 ${PAD}`}>
      <div className={`${WRAP} grid gap-10 sm:grid-cols-2 lg:grid-cols-4`}>
        <div className="sm:col-span-2">
          <p className="ei-display text-[clamp(2.4rem,8vw,4.5rem)]">
            Comida real<span className="text-ei-green">.</span>
          </p>
          <p className="mt-3 max-w-sm text-[15px] text-white/60">De temporada, honesta y sin atajos.</p>
        </div>
        <nav aria-label="Pie de página" className="grid content-start gap-1">
          <span className="mb-2 text-[12px] font-semibold uppercase text-white/50">Navegar</span>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="flex min-h-10 w-fit items-center text-[16px] font-medium hover:text-ei-green">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="grid content-start gap-1">
          <span className="mb-2 text-[12px] font-semibold uppercase text-white/50">Más</span>
          <a
            href={PERSON.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-10 w-fit items-center gap-1.5 text-[16px] font-medium hover:text-ei-green"
          >
            {PERSON.company} <ArrowNE className="h-3 w-3" />
          </a>
          <a href="#contacto" className="flex min-h-10 w-fit items-center text-[16px] font-medium hover:text-ei-green">
            Escribirle
          </a>
        </div>
      </div>

      <p
        className="ei-display pointer-events-none mt-14 select-none whitespace-nowrap text-center text-[30vw] leading-[0.78] text-white/[0.07]"
        aria-hidden
      >
        {PERSON.first}.
      </p>

      <div
        className={`${WRAP} flex flex-col gap-2 border-t border-white/15 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[12px] text-white/50 md:flex-row md:items-center md:justify-between`}
      >
        <span>
          © {new Date().getFullYear()} {PERSON.first} {PERSON.last}. Página personal — no es un sitio oficial de{" "}
          {PERSON.company}®.
        </span>
        <Link href="/" className="font-semibold uppercase tracking-[0.08em] hover:text-white">
          Web por Glomun
        </Link>
      </div>
    </footer>
  );
}
