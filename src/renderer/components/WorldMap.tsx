import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Map common country names to ISO 3166 names used in the TopoJSON
const COUNTRY_ALIASES: Record<string, string> = {
  'USA': 'United States of America',
  'US': 'United States of America',
  'United States': 'United States of America',
  'UK': 'United Kingdom',
  'England': 'United Kingdom',
  'South Korea': 'Korea',
  'North Korea': "Dem. People's Rep. Korea",
  'Cambodia': 'Cambodia',
  'Vietnam': 'Vietnam',
  'Viet Nam': 'Vietnam',
  'China': 'China',
  'Mexico': 'Mexico',
  'Ethiopia': 'Ethiopia',
  'Eritrea': 'Eritrea',
  'Burma': 'Myanmar',
  'Myanmar': 'Myanmar',
  'Laos': 'Lao PDR',
  'Philippines': 'Philippines',
  'El Salvador': 'El Salvador',
  'Guatemala': 'Guatemala',
  'Honduras': 'Honduras',
  'Bangladesh': 'Bangladesh',
  'India': 'India',
  'Pakistan': 'Pakistan',
  'Somalia': 'Somalia',
  'Thailand': 'Thailand',
  'Dominican Republic': 'Dominican Rep.',
};

function normalizeCountry(name: string): string {
  const trimmed = name.trim();
  return COUNTRY_ALIASES[trimmed] || trimmed;
}

interface WorldMapProps {
  data: { country: string; count: number }[];
}

export default function WorldMap({ data }: WorldMapProps) {
  const navigate = useNavigate();
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  // Map from normalized (TopoJSON) name -> original DB country name
  const { countryMap, reverseMap } = useMemo(() => {
    const cMap = new Map<string, number>();
    const rMap = new Map<string, string>();
    for (const entry of data) {
      const normalized = normalizeCountry(entry.country);
      cMap.set(normalized, (cMap.get(normalized) || 0) + entry.count);
      if (!rMap.has(normalized)) {
        rMap.set(normalized, entry.country);
      }
    }
    return { countryMap: cMap, reverseMap: rMap };
  }, [data]);

  const maxCount = useMemo(() => Math.max(...Array.from(countryMap.values()), 1), [countryMap]);

  const getColor = (geoName: string): string => {
    const count = countryMap.get(geoName);
    if (!count) return 'var(--surface-2)';
    const intensity = Math.max(0.2, count / maxCount);
    return `oklch(from var(--accent) l c h / ${intensity})`;
  };

  const handleCountryClick = (geoName: string) => {
    const dbName = reverseMap.get(geoName);
    if (dbName) {
      navigate(`/employees?country=${encodeURIComponent(dbName)}`);
    }
  };

  if (data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '32px 0', color: 'var(--ink-3)' }}>
        <p style={{ fontSize: 13, margin: 0 }}>No country of origin data available.</p>
        <p style={{ fontSize: 12, marginTop: 4, color: 'var(--ink-4)' }}>Add country information to employee records to see the map.</p>
      </div>
    );
  }

  return (
    <div
      className="relative select-none"
      onWheel={e => e.preventDefault()}
      draggable={false}
    >
      <ComposableMap
        projectionConfig={{ scale: 155, center: [0, 10] }}
        width={800}
        height={380}
        style={{ width: '100%', height: 'auto', touchAction: 'none', userSelect: 'none' }}
      >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties.name;
                const count = countryMap.get(geoName) || 0;
                return (
                  <Geography
                    key={geo.rpiKey}
                    geography={geo}
                    fill={getColor(geoName)}
                    stroke="var(--line)"
                    strokeWidth={0.5}
                    onMouseEnter={(e) => {
                      if (count > 0) {
                        setTooltip({ name: geoName, count, x: e.clientX, y: e.clientY });
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => {
                      if (count > 0) handleCountryClick(geoName);
                    }}
                    style={{
                      default: { outline: 'none', pointerEvents: count > 0 ? 'auto' : 'none' },
                      hover: { fill: count > 0 ? 'var(--accent)' : 'var(--surface-2)', outline: 'none', cursor: count > 0 ? 'pointer' : 'default' },
                      pressed: { outline: 'none' },
                    }}
                  />
                );
              })
            }
          </Geographies>
      </ComposableMap>

      {tooltip && (
        <div
          style={{
            position: 'fixed',
            zIndex: 50,
            left: tooltip.x + 12,
            top: tooltip.y - 30,
            pointerEvents: 'none',
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-lg)',
            padding: '6px 10px',
            fontSize: 12,
            fontFamily: 'var(--sans)',
          }}
        >
          <span style={{ fontWeight: 600 }}>{tooltip.name}</span>
          <span style={{ color: 'var(--ink-2)' }}>: {tooltip.count} employee{tooltip.count !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {Array.from(countryMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([country, count]) => (
            <button
              key={country}
              onClick={() => handleCountryClick(country)}
              style={{
                fontSize: 12,
                color: 'var(--ink-2)',
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-2)')}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  marginRight: 4,
                  verticalAlign: 'middle',
                  background: `oklch(from var(--accent) l c h / ${Math.max(0.2, count / maxCount)})`,
                }}
              />
              {country}: {count}
            </button>
          ))}
      </div>
    </div>
  );
}
