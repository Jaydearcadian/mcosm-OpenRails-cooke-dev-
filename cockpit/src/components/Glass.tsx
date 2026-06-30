import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Staggered glass-reveal: fade + subtle y-translate on mount (0.6s easeOut). */
export const revealParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
export const revealChild = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export function Glass({
  children,
  className = "",
  soft = false,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  soft?: boolean;
  as?: "div" | "section";
}) {
  const Tag = (motion[as] as typeof motion.div);
  return (
    <Tag variants={revealChild} className={`${soft ? "glass-soft" : "glass"} ${className}`}>
      {children}
    </Tag>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export function DemoTag() {
  return <span className="demo-tag" title="Demo data — no live endpoint yet">demo data</span>;
}
