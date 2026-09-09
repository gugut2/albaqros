import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pill,
  Activity,
  Check,
  Clock,
  Sparkles,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  DailyPropertyDefinition,
  DailyPropertyType,
  DailyReminder,
  RecurrenceRule,
  RecurrenceType,
  ReminderCategory,
} from '../types';
import { getRecurrenceDescription } from '../services/recurrence';

interface DailyPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: DailyPropertyDefinition[];
  reminders: DailyReminder[];
  onSaveProperty: (prop: DailyPropertyDefinition) => void;
  onDeleteProperty: (propId: string) => void;
  onSaveReminder: (reminderData: Omit<DailyReminder, 'id' | 'createdAt'>, existingId?: string) => void;
  onDeleteReminder: (reminderId: string) => void;
  onAddSubproperty?: (propertyId: string, name: string, unit?: string) => void;
  onDeleteSubproperty?: (propertyId: string, subpropertyId: string) => void;
  initialTab?: 'properties' | 'reminders';
}

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

export const DailyPropertiesModal: React.FC<DailyPropertiesModalProps> = ({
  isOpen,
  onClose,
  properties,
  reminders,
  onSaveProperty,
  onDeleteProperty,
  onSaveReminder,
  onDeleteReminder,
  onAddSubproperty,
  onDeleteSubproperty,
  initialTab = 'reminders',
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'reminders'>(initialTab);
  const [addingSubpropForPropId, setAddingSubpropForPropId] = useState<string | null>(null);
  const [newSubpropName, setNewSubpropName] = useState('');
  const [newSubpropUnit, setNewSubpropUnit] = useState('');

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // New Property Form State
  const [newPropName, setNewPropName] = useState('');
  const [newPropUnit, setNewPropUnit] = useState('');
  const [newPropType, setNewPropType] = useState<DailyPropertyType>('number');

  // New Reminder Form State
  const [newRemTitle, setNewRemTitle] = useState('');
  const [newRemCategory, setNewRemCategory] = useState<ReminderCategory>('medication');
  const [newRemDosage, setNewRemDosage] = useState('');
  const [newRemRecurrenceType, setNewRemRecurrenceType] = useState<RecurrenceType>('daily');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([6]); // default Saturday
  const [intervalDays, setIntervalDays] = useState<number>(3);
  const [activeDays, setActiveDays] = useState<number>(3);
  const [skipDays, setSkipDays] = useState<number>(1);

  if (!isOpen) return null;

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropName.trim()) return;

    const id = `prop-${Date.now()}`;
    onSaveProperty({
      id,
      name: newPropName.trim(),
      unit: newPropUnit.trim() || undefined,
      type: newPropType,
    });

    setNewPropName('');
    setNewPropUnit('');
    setNewPropType('number');
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemTitle.trim()) return;

    const recurrence: RecurrenceRule = {
      isRecurring: true,
      type: newRemRecurrenceType,
      daysOfWeek: newRemRecurrenceType === 'weekly_days' ? selectedDaysOfWeek : undefined,
      intervalDays: newRemRecurrenceType === 'interval_days' ? intervalDays : undefined,
      activeDays: newRemRecurrenceType === 'cycle' ? activeDays : undefined,
      skipDays: newRemRecurrenceType === 'cycle' ? skipDays : undefined,
    };

    onSaveReminder({
      title: newRemTitle.trim(),
      category: newRemCategory,
      dosage: newRemDosage.trim() || undefined,
      recurrence,
    });

    setNewRemTitle('');
    setNewRemDosage('');
  };

  const toggleDayOfWeek = (day: number) => {
    if (selectedDaysOfWeek.includes(day)) {
      if (selectedDaysOfWeek.length > 1) {
        setSelectedDaysOfWeek(selectedDaysOfWeek.filter((d) => d !== day));
      }
    } else {
      setSelectedDaysOfWeek([...selectedDaysOfWeek, day]);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          backgroundColor: '#12161f',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.85)',
          borderRadius: 'var(--radius-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              {activeTab === 'reminders' ? <Pill size={18} /> : <Activity size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Routines, Meds & Daily Properties
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Manage recurring non-task reminders, medication schedules, and daily metrics
              </span>
            </div>
          </div>

          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '3px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '18px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('reminders')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'reminders' ? 700 : 500,
              backgroundColor: activeTab === 'reminders' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: activeTab === 'reminders' ? '#ffffff' : 'var(--text-secondary)',
              border: activeTab === 'reminders' ? '1px solid var(--accent-indigo)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Pill size={14} color="#34d399" />
            <span>Medications & Routine Reminders ({reminders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'properties' ? 700 : 500,
              backgroundColor: activeTab === 'properties' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: activeTab === 'properties' ? '#ffffff' : 'var(--text-secondary)',
              border: activeTab === 'properties' ? '1px solid var(--accent-indigo)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Activity size={14} color="#818cf8" />
            <span>Tracked Properties & Metrics ({properties.length})</span>
          </button>
        </div>

        {/* TAB 1: MEDICATIONS & ROUTINE REMINDERS */}
        {activeTab === 'reminders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* List of existing reminders */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                ACTIVE MEDICATION & ROUTINE SCHEDULES
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {reminders.map((rem) => (
                  <div
                    key={rem.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Pill size={15} color="#34d399" />
                      <div>
                        <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {rem.title}
                        </div>
                        {rem.dosage && (
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            {rem.dosage}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: '#818cf8',
                          backgroundColor: 'rgba(99, 102, 241, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {getRecurrenceDescription(rem.recurrence)}
                      </span>

                      <button
                        type="button"
                        onClick={() => onDeleteReminder(rem.id)}
                        className="btn-icon"
                        style={{ color: '#f87171', padding: '4px' }}
                        title="Delete reminder"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}

                {reminders.length === 0 && (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    No recurring meds or reminders created yet. Use the form below to add one!
                  </div>
                )}
              </div>
            </div>

            {/* Create New Reminder Form */}
            <form
              onSubmit={handleAddReminder}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={14} color="#818cf8" /> Add Medication or Routine Reminder
              </div>

              {/* Title & Dosage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    REMINDER / MED NAME
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vitamin D, Saturday Meds, Creatine..."
                    value={newRemTitle}
                    onChange={(e) => setNewRemTitle(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      fontSize: '0.825rem',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    DOSAGE / NOTES (OPTIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1 capsule with meal, 5g..."
                    value={newRemDosage}
                    onChange={(e) => setNewRemDosage(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      fontSize: '0.825rem',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              </div>

              {/* Recurrence Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  CADENCE / WHEN DOES THIS HAPPEN?
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { type: 'daily', label: 'Day in, day out (Daily)' },
                    { type: 'weekly_days', label: 'Specific Days (e.g. Every Saturday)' },
                    { type: 'interval_days', label: 'Every X Days' },
                    { type: 'cycle', label: 'X Days On, Y Days Off' },
                  ].map((item) => {
                    const isSelected = newRemRecurrenceType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setNewRemRecurrenceType(item.type as RecurrenceType)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.725rem',
                          fontWeight: isSelected ? 600 : 400,
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-inputs for chosen recurrence */}
              {newRemRecurrenceType === 'weekly_days' && (
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Select which day(s) this reminder happens:
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {DAYS_OF_WEEK.map((item) => {
                      const isSelected = selectedDaysOfWeek.includes(item.day);
                      return (
                        <button
                          key={item.day}
                          type="button"
                          onClick={() => toggleDayOfWeek(item.day)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            fontWeight: isSelected ? 700 : 400,
                            backgroundColor: isSelected ? 'var(--accent-indigo)' : 'var(--bg-input)',
                            color: isSelected ? '#ffffff' : 'var(--text-muted)',
                            border: '1px solid var(--border-medium)',
                            cursor: 'pointer',
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {newRemRecurrenceType === 'interval_days' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Remind me every</span>
                  <input
                    type="number"
                    min="1"
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(parseInt(e.target.value, 10) || 1)}
                    style={{
                      width: '60px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 8px',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>days</span>
                </div>
              )}

              {newRemRecurrenceType === 'cycle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active for</span>
                  <input
                    type="number"
                    min="1"
                    value={activeDays}
                    onChange={(e) => setActiveDays(parseInt(e.target.value, 10) || 1)}
                    style={{
                      width: '50px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 6px',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>days, then skip</span>
                  <input
                    type="number"
                    min="1"
                    value={skipDays}
                    onChange={(e) => setSkipDays(parseInt(e.target.value, 10) || 1)}
                    style={{
                      width: '50px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 6px',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>day(s)</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="submit"
                  disabled={!newRemTitle.trim()}
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '6px 14px' }}
                >
                  <Plus size={13} /> Add Reminder
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: DAILY TRACKED PROPERTIES & METRICS */}
        {activeTab === 'properties' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* List of existing properties */}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                TRACKED METRICS & PROPERTIES
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {properties.map((prop) => {
                  const hasSubprops = Boolean(prop.subproperties && prop.subproperties.length > 0);
                  const isAddingSub = addingSubpropForPropId === prop.id;

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
                        gap: '8px',
                      }}
                    >
                      {/* Property Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Activity size={15} color="#818cf8" />
                          <div>
                            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {prop.name}
                            </span>
                            {prop.unit && (
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                ({prop.unit})
                              </span>
                            )}
                            {hasSubprops && (
                              <span
                                style={{
                                  fontSize: '0.675rem',
                                  color: '#34d399',
                                  backgroundColor: 'rgba(52, 211, 153, 0.12)',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  marginLeft: '8px',
                                  fontWeight: 600,
                                }}
                              >
                                ∑ Auto-Summed ({prop.subproperties!.length})
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.675rem',
                              color: 'var(--text-muted)',
                              backgroundColor: 'rgba(255, 255, 255, 0.04)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {prop.type}
                          </span>

                          <button
                            type="button"
                            onClick={() => onDeleteProperty(prop.id)}
                            className="btn-icon"
                            style={{ color: '#f87171', padding: '4px' }}
                            title="Delete property"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Subproperties List */}
                      {hasSubprops && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            paddingLeft: '22px',
                            borderLeft: '2px solid rgba(99, 102, 241, 0.2)',
                            marginLeft: '4px',
                          }}
                        >
                          {prop.subproperties!.map((sub) => (
                            <div
                              key={sub.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                fontSize: '0.725rem',
                              }}
                            >
                              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{sub.name}</span>
                              {sub.unit && <span style={{ color: 'var(--text-muted)', fontSize: '0.675rem' }}>({sub.unit})</span>}
                              {onDeleteSubproperty && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteSubproperty(prop.id, sub.id)}
                                  className="btn-icon"
                                  style={{ color: 'var(--text-muted)', padding: '1px', marginLeft: '2px' }}
                                  title={`Remove ${sub.name}`}
                                >
                                  <X size={11} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Sub-metric inline toggle/form */}
                      {prop.type === 'number' && onAddSubproperty && (
                        <div style={{ paddingLeft: '22px' }}>
                          {isAddingSub ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Sub-metric name (e.g. Stocks, Crypto)"
                                value={newSubpropName}
                                onChange={(e) => setNewSubpropName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newSubpropName.trim()) {
                                    e.preventDefault();
                                    onAddSubproperty(prop.id, newSubpropName.trim(), newSubpropUnit.trim() || prop.unit);
                                    setNewSubpropName('');
                                    setNewSubpropUnit('');
                                    setAddingSubpropForPropId(null);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  backgroundColor: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: '3px',
                                  padding: '3px 6px',
                                  fontSize: '0.725rem',
                                  color: 'var(--text-primary)',
                                }}
                              />
                              <input
                                type="text"
                                placeholder={prop.unit || 'unit'}
                                value={newSubpropUnit}
                                onChange={(e) => setNewSubpropUnit(e.target.value)}
                                style={{
                                  width: '45px',
                                  backgroundColor: 'var(--bg-input)',
                                  border: '1px solid var(--border-subtle)',
                                  borderRadius: '3px',
                                  padding: '3px 4px',
                                  fontSize: '0.725rem',
                                  color: 'var(--text-primary)',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!newSubpropName.trim()) return;
                                  onAddSubproperty(prop.id, newSubpropName.trim(), newSubpropUnit.trim() || prop.unit);
                                  setNewSubpropName('');
                                  setNewSubpropUnit('');
                                  setAddingSubpropForPropId(null);
                                }}
                                className="btn-primary"
                                style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingSubpropForPropId(null);
                                  setNewSubpropName('');
                                  setNewSubpropUnit('');
                                }}
                                className="btn-icon"
                                style={{ padding: '2px' }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAddingSubpropForPropId(prop.id);
                                setNewSubpropName('');
                                setNewSubpropUnit(prop.unit || '');
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'none',
                                border: 'none',
                                color: '#818cf8',
                                fontSize: '0.725rem',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                borderRadius: '3px',
                              }}
                            >
                              <Plus size={12} />
                              <span>{hasSubprops ? 'Add another sub-metric' : 'Add sub-metrics (auto-summed)'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add New Property Form */}
            <form
              onSubmit={handleAddProperty}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={14} color="#818cf8" /> Track New Property / Metric
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    METRIC NAME
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weight, Investments, Sleep..."
                    value={newPropName}
                    onChange={(e) => setNewPropName(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      fontSize: '0.825rem',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    UNIT
                  </label>
                  <input
                    type="text"
                    placeholder="kg, $, hrs"
                    value={newPropUnit}
                    onChange={(e) => setNewPropUnit(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      fontSize: '0.825rem',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    TYPE
                  </label>
                  <select
                    value={newPropType}
                    onChange={(e) => setNewPropType(e.target.value as DailyPropertyType)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="number">Number</option>
                    <option value="text">Text</option>
                    <option value="boolean">Yes / No</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  type="submit"
                  disabled={!newPropName.trim()}
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '6px 14px' }}
                >
                  <Plus size={13} /> Add Metric
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
