"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDarkMode = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextState = !isDark;
    setIsDark(nextState);

    if (nextState) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  if (isDark === null) {
    return <div className="w-9 h-9" />;
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label="Toggle theme"
      className="p-2 rounded-xl bg-black/5 dark:bg-white/[0.04] border border-black/5 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 active:scale-95 transition"
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}