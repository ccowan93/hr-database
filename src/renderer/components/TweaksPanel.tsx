import React, { useEffect, useRef } from 'react';
import { useTheme, Accent, Density, SidebarMode, Theme } from '../context/ThemeContext';

const ACCENTS: { id: Accent; color: string }[] = [
  { id: 'sage',   color: 'oklch(0.55 0.08 150)' },
  { id: 'indigo', color: 'oklch(0.55 0.12 265)' },
  { id: 'rust',   color: 'oklch(0.58 0.14 40)'  },
  { id: 'slate',  color: 'oklch(0.45 0.04 235)' },
  { id: 'plum',   color: 'oklch(0.55 0.10 330)' },
];

export default function TweaksPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, accent, density, sidebar, setTheme, setAccent, setDensity, setSidebar } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // Defer so the opening click doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    document.addEventListener('keydown', onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="tweaks" role="dialog" aria-label="Tweaks">
      <h4><span className="spark" /> Tweaks</h4>

      <div className="tweak-row">
        <label>Theme</label>
        <div className="seg">
          {(['light', 'dark'] as Theme[]).map(t => (
            <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <label>Accent</label>
        <div className="swatches">
          {ACCENTS.map(a => (
            <button
              key={a.id}
              className="swatch"
              aria-pressed={accent === a.id}
              title={a.id}
              onClick={() => setAccent(a.id)}
              style={{ background: a.color }}
            />
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <label>Density</label>
        <div className="seg">
          {(['compact', 'default', 'comfortable'] as Density[]).map(d => (
            <button key={d} aria-pressed={density === d} onClick={() => setDensity(d)}>{d}</button>
          ))}
        </div>
      </div>

      <div className="tweak-row">
        <label>Sidebar</label>
        <div className="seg">
          {(['labels', 'icons'] as SidebarMode[]).map(s => (
            <button key={s} aria-pressed={sidebar === s} onClick={() => setSidebar(s)}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
