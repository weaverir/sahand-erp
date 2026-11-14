
"use client";

import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "../providers/theme-provider";

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <button className="icon-button" aria-label="Theme">
        <Sun size={18} />
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      className="icon-button theme-toggle"
      onClick={toggleTheme}
      whileHover={{ scale: 1.08, rotate: 8 }}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.2 }}
      aria-label="تغییر حالت شب و روز"
      title="تغییر تم"
    >
      <motion.span
        key={theme}
        initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {theme === "dark" ? (
          <Sun size={19} />
        ) : (
          <Moon size={19} />
        )}
      </motion.span>
    </motion.button>
  );
}
