import React, { useState } from 'react';
import {
  Scale,
  TrendingUp,
  Activity,
  Droplet,
  Moon,
  Plus,
  Settings2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { DailyPropertyDefinition, DayEntry } from '../types';
import { formatDateLabel, getTodayString } from '../services/storage';

interface DailyPropertiesCardProps {
  currentDate: string;
  properties: DailyPropertyDefinition[];
  entry?: DayEntry;
  allEntries: Record<string, DayEntry>;
  onUpdateProperty: (dateStr: string, propertyId: string, value: number | string | boolean) => void;
  onOpenManageProperties: () => void;
  isCompact?: boolean;
}

export const DailyPropertiesCard: React.FC<DailyPropertiesCardProps> = ({
  currentDate,
  properties,
  entry,
  allEntries,
  onUpdateProperty,
  onOpenManageProperties,
  isCompact = false,
}) => {
  const currentValues = entry?.properties || {};

  // Compute previous value for delta calculation
  const getPreviousValue = (propId: string): { val: number | string | boolean; date: string } | null => {
    const priorDates = Object.keys(allEntries)
      .filter((d) => d < currentDate && allEntries[d]?.properties?.[propId] !== undefined)
      .sort()
      .reverse();

    if (priorDates.length > 0) {
      const prevDate = priorDates[0];
      return {
        val: allEntries[prevDate].properties![propId],
        date: prevDate,
      };
    }
    return null;
  };

  const getPropIcon = (name: string, icon?: string) => {
    const lower = name.toLowerCase();
    if (icon === 'scale' || lower.includes('weight')) return <Scale size={14} color="#818cf8" />;
    if (icon === 'trending-up' || lower.includes('invest') || lower.includes('money') || lower.includes('net worth'))
      return <TrendingUp size={14} color="#10b981" />;
    if (lower.includes('water')) return <Droplet size={14} color="#38bdf8" />;
    if (lower.includes('sleep')) return <Moon size={14} color="#c084fc" />;
    return <Activity size={14} color="#f59e0b" />;
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: isCompact ? '12px' : '16px 18px',
        backgroundColor: 'rgba(18, 22, 30, 0.75)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}
          >
            <Activity size={15} />
          </div>
          <div>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              Daily Tracked Properties & Metrics
            </span>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Log weight, investments, and custom daily properties
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenManageProperties}
          className="btn-secondary"
          style={{ fontSize: '0.725rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
          title="Add or configure tracked properties"
        >
          <Settings2 size={12} /> Manage Metrics
        </button>
      </div>

      {/* Properties Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '10px',
        }}
      >
        {properties.map((prop) => {
          const rawVal = currentValues[prop.id];
          const hasVal = rawVal !== undefined && rawVal !== '';
          const numVal = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal as string);

          const prev = getPreviousValue(prop.id);
          let delta: number | null = null;
          if (hasVal && !isNaN(numVal) && prev && typeof prev.val === 'number') {
            delta = Math.round((numVal - prev.val) * 100) / 100;
          }

          const isWeight = prop.name.toLowerCase().includes('weight');
          const isInvestment = prop.name.toLowerCase().includes('invest') || prop.unit === '$';

          return (
            <div
              key={prop.id}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {/* Top Row: Icon + Name + Delta Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getPropIcon(prop.name, prop.icon)}
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {prop.name}
                  </span>
                </div>

                {/* Delta Pill */}
                {delta !== null && delta !== 0 && (
                  <span
                    style={{
                      fontSize: '0.675rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      color:
                        isInvestment
                          ? delta > 0
                            ? '#34d399'
                            : '#f87171'
                          : isWeight
                          ? delta < 0
                            ? '#34d399'
                            : '#fbbf24'
                          : delta > 0
                          ? '#34d399'
                          : '#f87171',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      padding: '1px 5px',
                      borderRadius: '4px',
                    }}
                    title={`Compared to ${prev?.date}: ${delta > 0 ? '+' : ''}${delta} ${prop.unit || ''}`}
                  >
                    {delta > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>

              {/* Value Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {prop.type === 'boolean' ? (
                  <button
                    type="button"
                    onClick={() => onUpdateProperty(currentDate, prop.id, !rawVal)}
                    style={{
                      width: '100%',
                      padding: '6px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: rawVal ? '1px solid #10b981' : '1px solid var(--border-medium)',
                      backgroundColor: rawVal ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                      color: rawVal ? '#34d399' : 'var(--text-muted)',
                    }}
                  >
                    {rawVal ? 'Active / Yes' : 'No / Inactive'}
                  </button>
                ) : (
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      type={prop.type === 'number' ? 'number' : 'text'}
                      step="any"
                      placeholder={`Enter ${prop.name.toLowerCase()}...`}
                      value={rawVal !== undefined ? rawVal.toString() : ''}
                      onChange={(e) => {
                        const val =
                          prop.type === 'number'
                            ? e.target.value === ''
                              ? ''
                              : parseFloat(e.target.value)
                            : e.target.value;
                        onUpdateProperty(currentDate, prop.id, val as any);
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        padding: prop.unit ? '6px 36px 6px 8px' : '6px 8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: prop.type === 'number' ? 'var(--font-mono)' : 'inherit',
                      }}
                    />
                    {prop.unit && (
                      <span
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.725rem',
                          color: 'var(--text-muted)',
                          pointerEvents: 'none',
                          fontWeight: 600,
                        }}
                      >
                        {prop.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {properties.length === 0 && (
          <div
            style={{
              padding: '12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.775rem',
              gridColumn: '1 / -1',
            }}
          >
            No properties tracked yet. Click "Manage Metrics" to add Weight, Investments, etc.
          </div>
        )}
      </div>
    </div>
  );
};
