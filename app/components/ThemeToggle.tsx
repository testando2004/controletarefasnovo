"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@/app/context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        aria-label="Alternar tema"
        className="p-3 rounded-xl bg-gray-100 dark:bg-[var(--muted)] hover:bg-gray-200 dark:hover:bg-[#4b5563] transition-colors flex items-center justify-center"
      >
        <span className="w-5 h-5" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      onClick={toggleTheme}
      className="p-3 rounded-xl bg-gray-100 dark:bg-[var(--muted)] hover:bg-gray-200 dark:hover:bg-[#4b5563] transition-colors flex items-center justify-center"
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-300">
          <path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.48 0l1.79-1.8 1.41 1.41-1.8 1.79-1.4-1.4zM12 4V1h-0v3h0zm0 19v-3h0v3h0zM4 12H1v0h3v0zm19 0h-3v0h3v0zM6.76 19.16l-1.42 1.42-1.79-1.8 1.41-1.41 1.8 1.79zM19.16 17.24l1.41 1.41-1.79 1.8-1.42-1.42 1.8-1.79zM12 8a4 4 0 100 8 4 4 0 000-8z"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-sky-600">
          <path d="M21.64 13a9 9 0 11-10.63-10.6 7 7 0 1010.63 10.6z"/>
        </svg>
      )}
    </button>
  );
}
