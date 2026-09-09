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
  ChevronDown,
  ChevronUp,
  Layers,
  Trash2,
  PieChart,
} from 'lucide-react';
import { DailyPropertyDefinition, DayEntry } from '../types';
import { formatDateLabel, getTodayString } from '../services/storage';

interface DailyPropertiesCardProps {
  currentDate: string;
  properties: DailyPropertyDefinition[];
  entry?: DayEntry;
  allEntries: Record<string, DayEntry>;
  onUpdateProperty: (dateStr: string, propertyId: string, value: number | string | boolean) => void;
  onUpdateSubproperty?: (dateStr: string, propertyId: string, subpropertyId: string, value: number) => void;
  onAddSubproperty?: (propertyId: string, name: string, unit?: string) => void;
  onDeleteSubproperty?: (propertyId: string, subpropertyId: string) => void;
  onOpenManageProperties: () => void;
  isCompact?: boolean;
}

const SUBPROP_COLORS = ['#6366f1', '#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];

export const DailyPropertiesCard: React.FC<DailyPropertiesCardProps> = ({
  currentDate,
  properties,
  entry,
  allEntries,
  onUpdateProperty,
  onUpdateSubproperty,
  onAddSubproperty,
  onDeleteSubproperty,
  onOpenManageProperties,
  isCompact = false,
}) => {
  const currentValues = entry?.properties || {};
  const currentSubpropertyValues = entry?.subpropertyValues || {};

  // Track expanded state for properties with subproperties
  const [expandedProps, setExpandedProps] = useState<Record<string, boolean>>({
    'prop-investments': true,
  });

  // Track inline new subproperty input state per property
  const [inlineNewSubNames, setInlineNewSubNames] = useState<Record<string, string>>({});
  const [addingSubForProp, setAddingSubForProp] = useState<string | null>(null);

  const toggleExpanded = (propId: string) => {
    setExpandedProps((prev) => ({
      ...prev,
      [propId]: prev[propId] === undefined ? false : !prev[propId],
    }));
  };

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

  // Compute previous subproperty value for individual delta calculation
  const getPreviousSubValue = (propId: string, subId: string): { val: number; date: string } | null => {
    const priorDates = Object.keys(allEntries)
      .filter((d) => d < currentDate && allEntries[d]?.subpropertyValues?.[propId]?.[subId] !== undefined)
      .sort()
      .reverse();

    if (priorDates.length > 0) {
      const prevDate = priorDates[0];
      const val = allEntries[prevDate].subpropertyValues![propId][subId];
      if (typeof val === 'number') {
        return { val, date: prevDate };
      }
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

  const handleInlineAddSub = (propId: string, parentUnit?: string) => {
    const name = (inlineNewSubNames[propId] || '').trim();
    if (!name) return;
    if (onAddSubproperty) {
      onAddSubproperty(propId, name, parentUnit);
    }
    setInlineNewSubNames((prev) => ({ ...prev, [propId]: '' }));
    setAddingSubForProp(null);
    setExpandedProps((prev) => ({ ...prev, [propId]: true }));
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
          gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '12px',
        }}
      >
        {properties.map((prop) => {
          const rawVal = currentValues[prop.id];
          const hasSubprops = Boolean(prop.subproperties && prop.subproperties.length > 0);
          const subValues = currentSubpropertyValues[prop.id] || {};

          // If it has subproperties, calculate live total sum
          let computedSum = 0;
          let hasAnySubValue = false;
          if (hasSubprops) {
            prop.subproperties!.forEach((sp) => {
              const val = subValues[sp.id];
              if (typeof val === 'number' && !isNaN(val)) {
                computedSum += val;
                hasAnySubValue = true;
              }
            });
          }

          const subTotalNum: number = hasAnySubValue
            ? computedSum
            : typeof rawVal === 'number'
            ? rawVal
            : 0;

          const activeTotal = hasSubprops ? subTotalNum : rawVal;

          const numVal = typeof activeTotal === 'number' ? activeTotal : parseFloat(activeTotal as string);
          const hasVal = activeTotal !== undefined && activeTotal !== '';

          const prev = getPreviousValue(prop.id);
          let delta: number | null = null;
          if (hasVal && !isNaN(numVal) && prev && typeof prev.val === 'number') {
            delta = Math.round((numVal - prev.val) * 100) / 100;
          }

          const isWeight = prop.name.toLowerCase().includes('weight');
          const isInvestment = prop.name.toLowerCase().includes('invest') || prop.unit === '$';
          const isExpanded = expandedProps[prop.id] ?? true;

          return (
            <div
              key={prop.id}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: hasSubprops ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                gridColumn: hasSubprops && !isCompact ? 'span 2' : undefined,
              }}
            >
              {/* Top Row: Icon + Name + Subproperties Badge / Toggle + Delta Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getPropIcon(prop.name, prop.icon)}
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {prop.name}
                  </span>
                  {hasSubprops && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Layers size={9} />
                      {prop.subproperties!.length} sub-metrics
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                        padding: '1px 6px',
                        borderRadius: '4px',
                      }}
                      title={`Compared to ${prev?.date}: ${delta > 0 ? '+' : ''}${delta} ${prop.unit || ''}`}
                    >
                      {delta > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {delta > 0 ? `+${delta}` : delta} {prop.unit || ''}
                    </span>
                  )}

                  {hasSubprops && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(prop.id)}
                      className="btn-icon"
                      style={{ padding: '2px' }}
                      title={isExpanded ? 'Collapse breakdown' : 'Expand breakdown'}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
              </div>

              {/* CASE 1: PROPERTY HAS SUBPROPERTIES (E.G. INVESTMENTS -> STOCKS, ETF, CRYPTO) */}
              {hasSubprops ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Total Sum Display Banner */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Total {prop.name} (Sum)
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                        {prop.unit === '$' ? '$' : ''}
                        {subTotalNum.toLocaleString()}
                        {prop.unit && prop.unit !== '$' ? ` ${prop.unit}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setAddingSubForProp(addingSubForProp === prop.id ? null : prop.id)}
                        className="btn-secondary"
                        style={{ fontSize: '0.7rem', padding: '3px 8px', gap: '3px' }}
                        title="Add another sub-metric"
                      >
                        <Plus size={11} /> Add Sub-metric
                      </button>
                    </div>
                  </div>

                  {/* Segmented Distribution Bar */}
                  {subTotalNum > 0 && prop.subproperties!.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div
                        style={{
                          height: '6px',
                          borderRadius: '3px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          overflow: 'hidden',
                        }}
                      >
                        {prop.subproperties!.map((sp, idx) => {
                          const val = subValues[sp.id] || 0;
                          const pct = subTotalNum > 0 ? (val / subTotalNum) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={sp.id}
                              style={{
                                width: `${pct}%`,
                                backgroundColor: SUBPROP_COLORS[idx % SUBPROP_COLORS.length],
                                height: '100%',
                              }}
                              title={`${sp.name}: ${prop.unit === '$' ? '$' : ''}${val.toLocaleString ? val.toLocaleString() : val} (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Expandable Subproperties List */}
                  {isExpanded && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '8px',
                        marginTop: '2px',
                      }}
                    >
                      {prop.subproperties!.map((sp, idx) => {
                        const subVal = subValues[sp.id];
                        const prevSub = getPreviousSubValue(prop.id, sp.id);
                        let subDelta: number | null = null;
                        if (typeof subVal === 'number' && prevSub && typeof prevSub.val === 'number') {
                          subDelta = Math.round((subVal - prevSub.val) * 100) / 100;
                        }

                        const color = SUBPROP_COLORS[idx % SUBPROP_COLORS.length];
                        const pct = subTotalNum > 0 && typeof subVal === 'number' ? Math.round((subVal / subTotalNum) * 100) : 0;

                        return (
                          <div
                            key={sp.id}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: color,
                                    flexShrink: 0,
                                  }}
                                />
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  {sp.name}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {pct > 0 && (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                    {pct}%
                                  </span>
                                )}
                                {subDelta !== null && subDelta !== 0 && (
                                  <span
                                    style={{
                                      fontSize: '0.625rem',
                                      fontWeight: 600,
                                      color: subDelta > 0 ? '#34d399' : '#f87171',
                                      fontFamily: 'var(--font-mono)',
                                    }}
                                  >
                                    {subDelta > 0 ? `+${subDelta}` : subDelta}
                                  </span>
                                )}
                                {onDeleteSubproperty && prop.subproperties!.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteSubproperty(prop.id, sp.id)}
                                    className="btn-icon"
                                    style={{ padding: '2px', color: 'var(--text-muted)' }}
                                    title={`Delete sub-metric ${sp.name}`}
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={{ position: 'relative', width: '100%' }}>
                              <input
                                type="number"
                                step="any"
                                placeholder="0"
                                value={subVal !== undefined ? subVal.toString() : ''}
                                onChange={(e) => {
                                  const num = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  if (onUpdateSubproperty) {
                                    onUpdateSubproperty(currentDate, prop.id, sp.id, num);
                                  } else {
                                    onUpdateProperty(currentDate, prop.id, num);
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  backgroundColor: 'var(--bg-input)',
                                  border: '1px solid var(--border-medium)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '5px 28px 5px 8px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              />
                              {(sp.unit || prop.unit) && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    right: '6px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                    pointerEvents: 'none',
                                    fontWeight: 600,
                                  }}
                                >
                                  {sp.unit || prop.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Add Subproperty Form */}
                  {addingSubForProp === prop.id && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                        padding: '6px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'rgba(99, 102, 241, 0.05)',
                        border: '1px dashed rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Sub-metric name (e.g. Real Estate, Cash)..."
                        value={inlineNewSubNames[prop.id] || ''}
                        onChange={(e) =>
                          setInlineNewSubNames((prev) => ({ ...prev, [prop.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleInlineAddSub(prop.id, prop.unit);
                          }
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          color: 'var(--text-primary)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleInlineAddSub(prop.id, prop.unit)}
                        className="btn-primary"
                        style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingSubForProp(null)}
                        className="btn-icon"
                        style={{ padding: '2px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* CASE 2: STANDARD PROPERTY (NO SUBPROPERTIES) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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

                  {prop.type === 'number' && onAddSubproperty && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const defaultSubName = `${prop.name} Item 1`;
                          onAddSubproperty(prop.id, defaultSubName, prop.unit);
                          setExpandedProps((prev) => ({ ...prev, [prop.id]: true }));
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#818cf8',
                          fontSize: '0.675rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 4px',
                        }}
                        title="Add sub-metrics that sum to this property"
                      >
                        <Plus size={10} /> Add sub-metrics
                      </button>
                    </div>
                  )}
                </div>
              )}
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
