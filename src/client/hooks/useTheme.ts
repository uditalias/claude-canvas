import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme") as ThemeMode) || "system";
  });
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(mode));

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem("theme", newMode);
  }, []);

  // Update resolved theme when mode changes or system preference changes
  useEffect(() => {
    setResolved(resolveTheme(mode));

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => setResolved(getSystemTheme());
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  // Apply class to document
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  return { mode, resolved, setThemeMode };
}

// Theme colors
export const THEME = {
  light: {
    canvasBg: "#FAFAF7",
    dotColor: "#d4d4d4",
    toolboxBg: "bg-white",
    toolboxBorder: "border-gray-200",
    toolBtnActive: "bg-blue-100 text-blue-700",
    toolBtnInactive: "bg-transparent text-gray-700 hover:bg-gray-100",
    separator: "bg-gray-200",
    text: "text-gray-700",
    textMuted: "text-gray-500",
    hudBg: "bg-white/80",
    hudBorder: "border-gray-200",
    menuBg: "bg-white",
    menuBorder: "border-gray-200",
    menuHover: "hover:bg-gray-100",
    controlsBg: "bg-white",
    controlsBorder: "border-gray-200",
  },
  dark: {
    canvasBg: "#1a1a1e",
    dotColor: "#333338",
    toolboxBg: "bg-[#232328]",
    toolboxBorder: "border-[#333338]",
    toolBtnActive: "bg-blue-900/50 text-blue-400",
    toolBtnInactive: "bg-transparent text-gray-300 hover:bg-[#333338]",
    separator: "bg-[#333338]",
    text: "text-gray-300",
    textMuted: "text-gray-500",
    hudBg: "bg-[#232328]/80",
    hudBorder: "border-[#333338]",
    menuBg: "bg-[#232328]",
    menuBorder: "border-[#333338]",
    menuHover: "hover:bg-[#333338]",
    controlsBg: "bg-[#232328]",
    controlsBorder: "border-[#333338]",
  },
} as const;
