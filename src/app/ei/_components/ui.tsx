"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE } from "./data";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[12px] font-semibold uppercase tracking-[-0.01em] sm:text-[13px] ${className}`}>{children}</p>
  );
}

export function Reveal({
  children,
  delay = 0,
  y = 32,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Titular gigante con revelado por líneas, estilo "EAT REAL." */
export function DisplayTitle({
  lines,
  className = "",
  as: Tag = "h2",
}: {
  lines: string[];
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <Tag className={`ei-display ${className}`} aria-label={lines.join(" ")}>
      {/* El observer va en el contenedor visible: un hijo totalmente recortado por overflow nunca "entra" en viewport */}
      <motion.span className="block" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}>
        {lines.map((line, i) => (
          <span key={i} className="block overflow-hidden pb-[0.04em] pt-[0.1em]" aria-hidden>
            <motion.span
              className="block"
              variants={{ hidden: { y: "105%" }, show: { y: "0%" } }}
              transition={{ duration: 1, ease: EASE, delay: i * 0.08 }}
            >
              {line}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}

export function ArrowNE({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12 12 4M5.5 4H12v6.5" strokeLinecap="square" />
    </svg>
  );
}

export function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="square" />
    </svg>
  );
}

export function PillButton({
  href,
  children,
  variant = "dark",
  className = "",
  onClick,
}: {
  href: string;
  children: ReactNode;
  variant?: "dark" | "light" | "outline";
  className?: string;
  onClick?: () => void;
}) {
  const styles = {
    dark: "bg-ei-ink text-white hover:bg-ei-green hover:text-ei-ink",
    light: "bg-white text-ei-ink hover:bg-ei-green",
    outline: "border-[1.5px] border-current hover:bg-ei-ink hover:text-white",
  }[variant];
  return (
    <a
      href={href}
      onClick={onClick}
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[14px] font-bold uppercase tracking-[0.08em] transition-colors duration-300 ${styles} ${className}`}
    >
      {children}
      <ArrowNE className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  );
}
