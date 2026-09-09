import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Flame,
  CheckCircle2,
  Zap,
  Coffee,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Scale,
  Droplet,
  Moon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Layers,
  Calendar,
  Layers2,
  TableProperties,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { AppData, DailyPropertyDefinition } from '../types';
import {
  calculateAnalytics,
  calculatePropertyAnalytics,
  PropertyAnalytics,
  PropertyDataPoint,
} from '../services/analytics';

interface AnalyticsViewProps {
  data: AppData;
  initialPropertyId?: string;
  onOpenManageProperties?: () => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  data,
  initialPropertyId,
  onOpenManageProperties,
}) => {
  // Available numeric properties to graph
  const numericProperties = (data.dailyProperties || []).filter(
    (p) => p.type === 'number' || (p.subproperties && p.subproperties.length > 0)
  );

  // Active top-level section
  const [activeSection, setActiveSection] = useState<'metrics' | 'tasks' | 'combined'>('metrics');

  // Selected property
  const defaultPropId =
    initialPropertyId ||
    numericProperties.find((p) => p.id === 'prop-investments')?.id ||
    numericProperties[0]?.id ||
    '';
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(defaultPropId);

  // Property time range: 7, 14, 30, 90, 'all'
  const [propTimeRange, setPropTimeRange] = useState<7 | 14 | 30 | 90 | 'all'>(14);

  // Subproperty chart mode: 'stacked' | 'lines' | 'total' | 'distribution'
  const [subChartMode, setSubChartMode] = useState<'stacked' | 'lines' | 'total' | 'distribution'>('stacked');

  // Task velocity time range
  const [taskTimeRange, setTaskTimeRange] = useState<7 | 14 | 30>(14);

  // Compute analytics
  const analytics = calculateAnalytics(data, taskTimeRange);
  const velocityData = taskTimeRange === 30 ? analytics.monthlyVelocity : analytics.recentVelocity.slice(-taskTimeRange);

  // Compute selected property analytics
  const activePropertyDef = numericProperties.find((p) => p.id === selectedPropertyId);
  const propertyAnalytics: PropertyAnalytics | null = activePropertyDef
    ? calculatePropertyAnalytics(data, selectedPropertyId, propTimeRange)
    : null;

  // Format metric value helper
  const formatMetric = (val: number | null | undefined, unit?: string): string => {
    if (val === null || val === undefined) return '—';
    const isCurrency = unit === '$' || unit?.toLowerCase() === 'usd';
    if (isCurrency) {
      return `$${val.toLocaleString('en-US', {
        minimumFractionDigits: val % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })}`;
    }
    const formattedNum = val.toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
    return unit ? `${formattedNum} ${unit}` : formattedNum;
  };

  const getPropIcon = (name: string, iconKey?: string) => {
    const lower = name.toLowerCase();
    if (iconKey === 'scale' || lower.includes('weight')) return <Scale size={16} color="#818cf8" />;
    if (
      iconKey === 'trending-up' ||
      lower.includes('invest') ||
      lower.includes('money') ||
      lower.includes('net worth') ||
      lower.includes('wealth')
    )
      return <TrendingUp size={16} color="#10b981" />;
    if (lower.includes('water')) return <Droplet size={16} color="#38bdf8" />;
    if (lower.includes('sleep')) return <Moon size={16} color="#c084fc" />;
    return <Activity size={16} color="#f59e0b" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', padding: '4px' }}>
      {/* Top Header & View Mode Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Analytics & Historical Insights
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Track portfolio progression, health metrics, and task velocity over time.
          </p>
        </div>

        {/* Section Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '3px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            gap: '2px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveSection('metrics')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeSection === 'metrics' ? 'var(--accent-indigo)' : 'transparent',
              color: activeSection === 'metrics' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <TrendingUp size={14} />
            Properties & Metrics
            <span
              style={{
                fontSize: '0.675rem',
                padding: '1px 6px',
                borderRadius: '999px',
                backgroundColor: activeSection === 'metrics' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontWeight: 700,
              }}
            >
              {numericProperties.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tasks')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeSection === 'tasks' ? 'var(--accent-indigo)' : 'transparent',
              color: activeSection === 'tasks' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Zap size={14} />
            Tasks & Productivity
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('combined')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeSection === 'combined' ? 'var(--accent-indigo)' : 'transparent',
              color: activeSection === 'combined' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={14} />
            All-in-One
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: PROPERTIES & METRICS GRAPHS                                    */}
      {/* ========================================================================= */}
      {(activeSection === 'metrics' || activeSection === 'combined') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Property Selector Bar & Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Metric Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {numericProperties.map((prop) => {
                const isSelected = prop.id === selectedPropertyId;
                // Calculate quick latest value
                const entries = data.entries || {};
                const sortedDates = Object.keys(entries).sort().reverse();
                let latestVal: number | null = null;
                for (const d of sortedDates) {
                  if (entries[d]?.properties?.[prop.id] !== undefined) {
                    latestVal = Number(entries[d].properties![prop.id]);
                    break;
                  }
                }

                return (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() => setSelectedPropertyId(prop.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid rgba(99, 102, 241, 0.7)'
                        : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      boxShadow: isSelected ? '0 0 12px rgba(99, 102, 241, 0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {getPropIcon(prop.name, prop.icon)}
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{prop.name}</span>
                    {latestVal !== null && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                          color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        }}
                      >
                        {formatMetric(latestVal, prop.unit)}
                      </span>
                    )}
                    {prop.subproperties && prop.subproperties.length > 0 && (
                      <span
                        style={{
                          fontSize: '0.675rem',
                          color: '#38bdf8',
                          fontWeight: 700,
                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                        title={`${prop.subproperties.length} sub-metrics configured`}
                      >
                        {prop.subproperties.length} sub
                      </span>
                    )}
                  </button>
                );
              })}

              {onOpenManageProperties && (
                <button
                  type="button"
                  onClick={onOpenManageProperties}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    border: '1px dashed var(--border-subtle)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    fontSize: '0.775rem',
                  }}
                  title="Manage daily properties"
                >
                  <Settings2 size={13} />
                  Manage
                </button>
              )}
            </div>

            {/* Time Range Filter & Subproperty Mode Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Compound Mode Switcher (if selected property has subproperties) */}
              {activePropertyDef?.subproperties && activePropertyDef.subproperties.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    padding: '2px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    gap: '2px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSubChartMode('stacked')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: subChartMode === 'stacked' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                      color: subChartMode === 'stacked' ? '#a5b4fc' : 'var(--text-muted)',
                    }}
                    title="Stacked composition area chart"
                  >
                    Stacked
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubChartMode('lines')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: subChartMode === 'lines' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                      color: subChartMode === 'lines' ? '#a5b4fc' : 'var(--text-muted)',
                    }}
                    title="Multi-line breakdown chart"
                  >
                    Lines
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubChartMode('total')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: subChartMode === 'total' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                      color: subChartMode === 'total' ? '#a5b4fc' : 'var(--text-muted)',
                    }}
                    title="Total cumulative area chart"
                  >
                    Total
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubChartMode('distribution')}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: subChartMode === 'distribution' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                      color: subChartMode === 'distribution' ? '#a5b4fc' : 'var(--text-muted)',
                    }}
                    title="Asset allocation distribution donut"
                  >
                    Share %
                  </button>
                </div>
              )}

              {/* Range Selector */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  padding: '2px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  gap: '2px',
                }}
              >
                {([7, 14, 30, 90, 'all'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPropTimeRange(r)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: propTimeRange === r ? 'var(--accent-indigo)' : 'transparent',
                      color: propTimeRange === r ? '#ffffff' : 'var(--text-muted)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {r === 'all' ? 'All' : `${r}D`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metric KPI Cards */}
          {propertyAnalytics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {/* Card 1: Latest Recorded Value */}
              <div
                className="glass-panel"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  {getPropIcon(propertyAnalytics.property.name, propertyAnalytics.property.icon)}
                </div>
                <div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    LATEST RECORDED
                  </div>
                  <div
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {formatMetric(propertyAnalytics.currentValue, propertyAnalytics.property.unit)}
                  </div>
                  <div style={{ fontSize: '0.675rem', color: 'var(--text-secondary)' }}>
                    {propertyAnalytics.currentDate ? `as of ${propertyAnalytics.currentDate}` : 'No entries yet'}
                  </div>
                </div>
              </div>

              {/* Card 2: Period Net Change */}
              <div
                className="glass-panel"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border:
                    propertyAnalytics.delta > 0
                      ? '1px solid rgba(16, 185, 129, 0.25)'
                      : propertyAnalytics.delta < 0
                      ? '1px solid rgba(239, 68, 68, 0.25)'
                      : '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor:
                      propertyAnalytics.delta > 0
                        ? 'rgba(16, 185, 129, 0.15)'
                        : propertyAnalytics.delta < 0
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color:
                      propertyAnalytics.delta > 0
                        ? '#10b981'
                        : propertyAnalytics.delta < 0
                        ? '#ef4444'
                        : '#94a3b8',
                  }}
                >
                  {propertyAnalytics.delta > 0 ? (
                    <ArrowUpRight size={22} />
                  ) : propertyAnalytics.delta < 0 ? (
                    <ArrowDownRight size={22} />
                  ) : (
                    <Minus size={22} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    PERIOD NET CHANGE
                  </div>
                  <div
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 800,
                      color:
                        propertyAnalytics.delta > 0
                          ? '#34d399'
                          : propertyAnalytics.delta < 0
                          ? '#f87171'
                          : 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {propertyAnalytics.delta > 0 ? '+' : ''}
                    {formatMetric(propertyAnalytics.delta, propertyAnalytics.property.unit)}
                  </div>
                  <div
                    style={{
                      fontSize: '0.675rem',
                      color:
                        propertyAnalytics.deltaPercent > 0
                          ? '#34d399'
                          : propertyAnalytics.deltaPercent < 0
                          ? '#f87171'
                          : 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {propertyAnalytics.deltaPercent > 0 ? '+' : ''}
                    {propertyAnalytics.deltaPercent.toFixed(1)}% over selected period
                  </div>
                </div>
              </div>

              {/* Card 3: Period Range High & Low */}
              <div
                className="glass-panel"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                  }}
                >
                  <Activity size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    PERIOD HIGH & LOW
                  </div>
                  <div
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '6px',
                    }}
                  >
                    <span style={{ color: '#38bdf8' }}>
                      {formatMetric(propertyAnalytics.high, propertyAnalytics.property.unit)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                      {formatMetric(propertyAnalytics.low, propertyAnalytics.property.unit)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.675rem', color: 'var(--text-secondary)' }}>
                    Spread:{' '}
                    {propertyAnalytics.high !== null && propertyAnalytics.low !== null
                      ? formatMetric(propertyAnalytics.high - propertyAnalytics.low, propertyAnalytics.property.unit)
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Card 4: Average & Logged Entries */}
              <div
                className="glass-panel"
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                  }}
                >
                  <BarChart3 size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    AVERAGE VALUE
                  </div>
                  <div
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {formatMetric(propertyAnalytics.average, propertyAnalytics.property.unit)}
                  </div>
                  <div style={{ fontSize: '0.675rem', color: 'var(--text-secondary)' }}>
                    {propertyAnalytics.recordedCount}{' '}
                    {propertyAnalytics.recordedCount === 1 ? 'entry' : 'entries'} logged in period
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Chart Panel */}
          <div
            className="glass-panel"
            style={{
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Chart Title & Subtitle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getPropIcon(activePropertyDef?.name || '', activePropertyDef?.icon)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {activePropertyDef?.name} Progression & Historical Trajectory
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {activePropertyDef?.subproperties && activePropertyDef.subproperties.length > 0
                      ? `Sum of subproperties (${activePropertyDef.subproperties.map((s) => s.name).join(', ')})`
                      : `Daily logged measurements (${activePropertyDef?.unit || 'values'})`}
                  </div>
                </div>
              </div>

              {/* Chart Mode Legend Pill */}
              {activePropertyDef?.subproperties && activePropertyDef.subproperties.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem' }}>
                  {activePropertyDef.subproperties.map((sub) => {
                    const color = propertyAnalytics?.subproperties.find((s) => s.id === sub.id)?.color || '#818cf8';
                    return (
                      <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{sub.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chart Canvas */}
            <div style={{ height: '300px', width: '100%' }}>
              {propertyAnalytics && propertyAnalytics.dataPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {/* Mode: Asset Allocation Donut */}
                  {subChartMode === 'distribution' &&
                  activePropertyDef?.subproperties &&
                  activePropertyDef.subproperties.length > 0 ? (
                    <PieChart>
                      <Pie
                        data={propertyAnalytics.subproperties}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {propertyAnalytics.subproperties.map((entry) => (
                          <Cell key={`cell-${entry.id}`} fill={entry.color} stroke="#0e1117" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${formatMetric(Number(val), activePropertyDef.unit)} (${item.payload.percentage}%)`,
                          item.payload.name,
                        ]}
                        contentStyle={{
                          backgroundColor: '#161b24',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          color: '#f8fafc',
                        }}
                      />
                    </PieChart>
                  ) : subChartMode === 'lines' &&
                    activePropertyDef?.subproperties &&
                    activePropertyDef.subproperties.length > 0 ? (
                    /* Mode: Multi-Line Breakdown */
                    <LineChart data={propertyAnalytics.dataPoints} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                      <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(v) => formatMetric(v, activePropertyDef?.unit)}
                      />
                      <Tooltip
                        content={(props: any) => (
                          <CustomPropertyTooltip
                            {...props}
                            property={activePropertyDef}
                            subproperties={propertyAnalytics.subproperties}
                          />
                        )}
                      />
                      {/* Subproperty Lines */}
                      {propertyAnalytics.subproperties.map((sub) => (
                        <Line
                          key={sub.id}
                          type="monotone"
                          dataKey={sub.id}
                          name={sub.name}
                          stroke={sub.color}
                          strokeWidth={2}
                          dot={{ r: 3, fill: sub.color }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                      {/* Total Dashed Line */}
                      <Line
                        type="monotone"
                        dataKey="carriedValue"
                        name="Total"
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </LineChart>
                  ) : subChartMode === 'stacked' &&
                    activePropertyDef?.subproperties &&
                    activePropertyDef.subproperties.length > 0 ? (
                    /* Mode: Stacked Area Chart */
                    <AreaChart data={propertyAnalytics.dataPoints} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <defs>
                        {propertyAnalytics.subproperties.map((sub) => (
                          <linearGradient key={`grad-${sub.id}`} id={`grad-${sub.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={sub.color} stopOpacity={0.65} />
                            <stop offset="95%" stopColor={sub.color} stopOpacity={0.1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                      <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(v) => formatMetric(v, activePropertyDef?.unit)}
                      />
                      <Tooltip
                        content={(props: any) => (
                          <CustomPropertyTooltip
                            {...props}
                            property={activePropertyDef}
                            subproperties={propertyAnalytics.subproperties}
                          />
                        )}
                      />
                      {propertyAnalytics.subproperties.map((sub) => (
                        <Area
                          key={sub.id}
                          type="monotone"
                          dataKey={sub.id}
                          name={sub.name}
                          stackId="1"
                          stroke={sub.color}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill={`url(#grad-${sub.id})`}
                        />
                      ))}
                    </AreaChart>
                  ) : (
                    /* Mode: Single Metric or Total Area Chart */
                    <AreaChart data={propertyAnalytics.dataPoints} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                      <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(v) => formatMetric(v, activePropertyDef?.unit)}
                      />
                      <Tooltip
                        content={(props: any) => (
                          <CustomPropertyTooltip
                            {...props}
                            property={activePropertyDef!}
                            subproperties={propertyAnalytics.subproperties}
                          />
                        )}
                      />
                      <Area
                        type="monotone"
                        dataKey="carriedValue"
                        name={activePropertyDef?.name || 'Value'}
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#metricGrad)"
                        dot={(pointProps: any) => {
                          const { cx, cy, payload } = pointProps;
                          if (payload?.hasActualEntry) {
                            return (
                              <circle
                                key={`dot-${payload.date}`}
                                cx={cx}
                                cy={cy}
                                r={4}
                                fill="#818cf8"
                                stroke="#ffffff"
                                strokeWidth={2}
                              />
                            );
                          }
                          return <g key={`dot-${payload.date}`} />;
                        }}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    gap: '10px',
                  }}
                >
                  <Activity size={32} opacity={0.4} />
                  <div style={{ fontSize: '0.85rem' }}>No data points recorded yet for this metric.</div>
                </div>
              )}
            </div>

            {/* Subproperties Segmented Allocation Bar (if compound metric) */}
            {propertyAnalytics &&
              propertyAnalytics.subproperties.length > 0 &&
              propertyAnalytics.currentValue !== null &&
              propertyAnalytics.currentValue > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      CURRENT ASSET ALLOCATION BREAKDOWN
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Total: {formatMetric(propertyAnalytics.currentValue, activePropertyDef?.unit)}
                    </span>
                  </div>

                  {/* Multi-segment progress bar */}
                  <div
                    style={{
                      height: '10px',
                      borderRadius: '999px',
                      overflow: 'hidden',
                      display: 'flex',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    {propertyAnalytics.subproperties.map((sub) => (
                      <div
                        key={sub.id}
                        style={{
                          height: '100%',
                          width: `${sub.percentage}%`,
                          backgroundColor: sub.color,
                          transition: 'width 0.4s ease',
                        }}
                        title={`${sub.name}: ${formatMetric(sub.value, activePropertyDef?.unit)} (${sub.percentage}%)`}
                      />
                    ))}
                  </div>

                  {/* Allocation Subproperty Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '10px',
                      marginTop: '4px',
                    }}
                  >
                    {propertyAnalytics.subproperties.map((sub) => (
                      <div
                        key={sub.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sub.color }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {sub.name}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {sub.percentage}%
                          </span>
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {formatMetric(sub.value, activePropertyDef?.unit)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: TASKS & PRODUCTIVITY VELOCITY                                  */}
      {/* ========================================================================= */}
      {(activeSection === 'tasks' || activeSection === 'combined') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Stat Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {/* Streak */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f59e0b',
                }}
              >
                <Flame size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENT STREAK</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {analytics.currentStreak} {analytics.currentStreak === 1 ? 'day' : 'days'}
                </div>
              </div>
            </div>

            {/* Completion Rate */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMPLETION RATE</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {analytics.completionRate}%
                </div>
              </div>
            </div>

            {/* High Focus Tasks */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <Zap size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>HIGH FOCUS (⚡)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {analytics.highEnergyCount} completed
                </div>
              </div>
            </div>

            {/* Low Energy Chores */}
            <div
              className="glass-panel"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34d399',
                }}
              >
                <Coffee size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>LIGHT CHORES (☕)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {analytics.lowEnergyCount} completed
                </div>
              </div>
            </div>
          </div>

          {/* Main Velocity Chart */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} color="#818cf8" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Task Completion Velocity & Focus Rhythm
                </h3>
              </div>

              {/* Time Range Selector */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {([7, 14, 30] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setTaskTimeRange(r)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: taskTimeRange === r ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                      backgroundColor: taskTimeRange === r ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      color: taskTimeRange === r ? '#a5b4fc' : 'var(--text-muted)',
                    }}
                  >
                    {r} Days
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: '260px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161b24',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: '#f8fafc',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Tasks Completed"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#completedGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Grid: Theme Consistency & Energy Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Theme Consistency Breakdown */}
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Consistency by Life Facet
                </h4>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analytics.themeStats.map((stat) => (
                  <div key={stat.theme}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: stat.color }}>#{stat.theme}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {stat.completed}/{stat.total} ({stat.rate}%)
                      </span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${stat.rate}%`,
                          backgroundColor: stat.color,
                          borderRadius: '999px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Energy Balance Donut */}
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieIcon size={16} color="#34d399" />
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Energy Expenditure Balance
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', height: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.energyDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {analytics.energyDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161b24',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.75rem' }}>
                {analytics.energyDistribution.map((item) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// Custom Property Tooltip Component
// =========================================================================
interface CustomPropertyTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  property?: DailyPropertyDefinition;
  subproperties?: { id: string; name: string; color: string }[];
}

const CustomPropertyTooltip: React.FC<CustomPropertyTooltipProps> = ({
  active,
  payload,
  label,
  property,
  subproperties = [],
}) => {
  if (!active || !payload || payload.length === 0 || !property) return null;

  const dataPoint: PropertyDataPoint = payload[0]?.payload;
  const isCurrency = property.unit === '$' || property.unit?.toLowerCase() === 'usd';

  const formatVal = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '—';
    if (isCurrency) {
      return `$${val.toLocaleString('en-US', {
        minimumFractionDigits: val % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })}`;
    }
    return `${val.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${property.unit || ''}`;
  };

  const totalValue = dataPoint?.carriedValue ?? dataPoint?.value;

  return (
    <div
      style={{
        backgroundColor: '#161b24',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '10px',
        padding: '12px 14px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        minWidth: '180px',
        fontSize: '0.8rem',
        color: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, color: '#94a3b8' }}>{dataPoint?.date || label}</span>
        {dataPoint?.hasActualEntry ? (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
            }}
          >
            Check-in
          </span>
        ) : (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 500,
              color: '#64748b',
            }}
          >
            Carried
          </span>
        )}
      </div>

      {/* Main / Total Value */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          paddingBottom: subproperties.length > 0 ? '8px' : '0',
          borderBottom: subproperties.length > 0 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          marginBottom: subproperties.length > 0 ? '8px' : '0',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
          {property.name}:
        </span>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#818cf8' }}>
          {formatVal(totalValue)}
        </span>
      </div>

      {/* Subproperties breakdown */}
      {subproperties.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {subproperties.map((sub) => {
            const subVal = dataPoint?.[sub.id];
            return (
              <div
                key={sub.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  fontSize: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sub.color }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{sub.name}</span>
                </div>
                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{formatVal(subVal)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
