"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = saved ? saved === "dark" : prefersDark;

    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  const toggleTheme = () => {
    const nextState = !isDark;
    setIsDark(nextState);
    document.documentElement.classList.toggle("dark", nextState);
    localStorage.setItem("theme", nextState ? "dark" : "light");
  };

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