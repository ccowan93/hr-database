import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type Accent = 'sage' | 'indigo' | 'rust' | 'slate' | 'plum';
export type Density = 'compact' | 'default' | 'comfortable';
export type SidebarMode = 'labels' | 'icons';

interface ThemeContextType {
  theme: Theme;
  accent: Accent;
  density: Density;
  sidebar: SidebarMode;
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
  setDensity: (d: Density) => void;
  setSidebar: (s: SidebarMode) => void;
  toggleTheme: () => void;
}

const KEY = 'hr-tweaks';

const defaults = {
  theme: 'light' as Theme,
  accent: 'sage' as Accent,
  density: 'default' as Density,
  sidebar: 'labels' as SidebarMode,
};

function loadTweaks() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
    const legacy = localStorage.getItem('hr-theme') as Theme | null;
    if (legacy) return { ...defaults, theme: legacy };
  } catch {}
  return defaults;
}

const ThemeContext = createContext<ThemeContextType>({
  ...defaults,
  setTheme: () => {},
  setAccent: () => {},
  setDensity: () => {},
  setSidebar: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initial = loadTweaks();
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [accent, setAccent] = useState<Accent>(initial.accent);
  const [density, setDensity] = useState<Density>(initial.density);
  const [sidebar, setSidebar] = useState<SidebarMode>(initial.sidebar);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);
    root.setAttribute('data-density', density);
    root.setAttribute('data-sidebar', sidebar);
    // keep Tailwind dark variant working for any legacy `dark:` classes
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try { localStorage.setItem(KEY, JSON.stringify({ theme, accent, density, sidebar })); } catch {}
  }, [theme, accent, density, sidebar]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, accent, density, sidebar, setTheme, setAccent, setDensity, setSidebar, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
