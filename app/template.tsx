
"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export default function Template({
  children,
}: {
  children: ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={
        shouldReduceMotion
          ? false
          : {
              opacity: 0,
              y: 12,
              filter: "blur(5px)",
            }
      }
      animate={{
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
      }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.38,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{ minHeight: "100%" }}
    >
      {children}
    </motion.div>
  );
}
