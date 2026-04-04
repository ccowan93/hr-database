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
    if (!count) return '#e2e8f0';
    const intensity = Math.max(0.2, count / maxCount);
    return `rgba(59, 130, 246, ${intensity})`;
  };

  const handleCountryClick = (geoName: string) => {
    const dbName = reverseMap.get(geoName);
    if (dbName) {
      navigate(`/employees?country=${encodeURIComponent(dbName)}`);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
        <p className="text-sm">No country of origin data available.</p>
        <p className="text-xs mt-1">Add country information to employee records to see the map.</p>
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
                    stroke="#cbd5e1"
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
                      hover: { fill: count > 0 ? '#2563eb' : '#e2e8f0', outline: 'none', cursor: count > 0 ? 'pointer' : 'default' },
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
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
        >
          <span className="font-semibold">{tooltip.name}</span>: {tooltip.count} employee{tooltip.count !== 1 ? 's' : ''}
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 justify-center">
        {Array.from(countryMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([country, count]) => (
            <button
              key={country}
              onClick={() => handleCountryClick(country)}
              className="text-xs text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <span
                className="inline-block w-3 h-3 rounded-sm mr-1 align-middle"
                style={{ backgroundColor: `rgba(59, 130, 246, ${Math.max(0.2, count / maxCount)})` }}
              />
              {country}: {count}
            </button>
          ))}
      </div>
    </div>
  );
}
