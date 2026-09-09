import React from 'react';
import {
  Pill,
  Bell,
  Zap,
  Bookmark,
  Check,
  Clock,
  Plus,
  Settings2,
  Calendar,
} from 'lucide-react';
import { DailyReminder, DayEntry, ReminderCategory } from '../types';
import { isReminderDueOnDate, getRecurrenceDescription } from '../services/recurrence';
import { formatDateLabel, getTodayString } from '../services/storage';

interface DailyRemindersCardProps {
  currentDate: string;
  reminders: DailyReminder[];
  entry?: DayEntry;
  onToggleReminder: (dateStr: string, reminderId: string) => void;
  onOpenManageReminders: () => void;
  isCompact?: boolean;
}

export const DailyRemindersCard: React.FC<DailyRemindersCardProps> = ({
  currentDate,
  reminders,
  entry,
  onToggleReminder,
  onOpenManageReminders,
  isCompact = false,
}) => {
  // Filter reminders due on currentDate
  const dueReminders = reminders.filter((rem) =>
    isReminderDueOnDate(rem.recurrence, currentDate)
  );

  const completedMap = entry?.remindersCompleted || {};
  const completedCount = dueReminders.filter((r) => completedMap[r.id]).length;
  const isToday = currentDate === getTodayString();

  const getCategoryIcon = (cat: ReminderCategory) => {
    switch (cat) {
      case 'medication':
        return <Pill size={14} color="#34d399" />;
      case 'routine':
        return <Bell size={14} color="#818cf8" />;
      case 'habit':
        return <Zap size={14} color="#f59e0b" />;
      default:
        return <Bookmark size={14} color="#38bdf8" />;
    }
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
        gap: '10px',
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
              backgroundColor: 'rgba(52, 211, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
            }}
          >
            <Pill size={15} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Daily Meds & Routine Reminders
              </span>
              {dueReminders.length > 0 && (
                <span
                  style={{
                    fontSize: '0.675rem',
                    fontWeight: 600,
                    color: completedCount === dueReminders.length ? '#10b981' : '#818cf8',
                    backgroundColor:
                      completedCount === dueReminders.length
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(99, 102, 241, 0.12)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                  }}
                >
                  {completedCount}/{dueReminders.length}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Non-task check-ins scheduled for {isToday ? 'today' : formatDateLabel(currentDate)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenManageReminders}
          className="btn-secondary"
          style={{ fontSize: '0.725rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
          title="Add or configure medications and reminder schedules"
        >
          <Plus size={12} /> Add / Manage
        </button>
      </div>

      {/* Due Reminders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {dueReminders.map((rem) => {
          const isDone = Boolean(completedMap[rem.id]);

          return (
            <div
              key={rem.id}
              onClick={() => onToggleReminder(currentDate, rem.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: isDone ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Left: Checkbox + Title & Dosage */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '5px',
                    backgroundColor: isDone ? '#10b981' : 'transparent',
                    border: isDone ? '1px solid #10b981' : '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {isDone && <Check size={13} strokeWidth={3} />}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getCategoryIcon(rem.category)}
                  <div>
                    <span
                      style={{
                        fontSize: '0.825rem',
                        fontWeight: isDone ? 500 : 600,
                        color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}
                    >
                      {rem.title}
                    </span>
                    {rem.dosage && (
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                        • {rem.dosage}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Recurrence Tag & Status Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.675rem',
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: isCompact ? 'none' : 'inline-block',
                  }}
                >
                  {getRecurrenceDescription(rem.recurrence)}
                </span>

                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: isDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    color: isDone ? '#34d399' : 'var(--text-muted)',
                  }}
                >
                  {isDone ? 'Taken ✓' : 'Pending'}
                </span>
              </div>
            </div>
          );
        })}

        {/* Empty state when no reminders scheduled for this day */}
        {dueReminders.length === 0 && (
          <div
            style={{
              padding: '12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.775rem',
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            {reminders.length === 0 ? (
              <span>
                No medications or recurring reminders set up yet.{' '}
                <button
                  type="button"
                  onClick={onOpenManageReminders}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Add your daily/weekly meds
                </button>
              </span>
            ) : (
              <span>No medications or reminders scheduled for this date.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
