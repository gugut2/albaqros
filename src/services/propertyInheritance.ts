import { DayEntry, DailyPropertyDefinition } from '../types';

/**
 * Resolves the effective value of a single daily property for a given date.
 * If the property was explicitly recorded on dateStr, returns that value.
 * Otherwise, carries over the most recent value recorded on any date < dateStr.
 */
export function getEffectivePropertyValue(
  allEntries: Record<string, DayEntry>,
  dateStr: string,
  propertyId: string,
  subproperties?: { id: string; name: string }[]
): number | string | boolean | undefined {
  // If property has defined subproperties, its value is strictly the sum of effective subproperties
  if (subproperties && subproperties.length > 0) {
    const effSubs = getEffectiveSubpropertyValues(allEntries, dateStr, propertyId, subproperties);
    let sum = 0;
    let hasAny = false;
    for (const sp of subproperties) {
      if (sp.id in effSubs) {
        const val = effSubs[sp.id];
        const num = typeof val === 'number' ? val : parseFloat(val as any);
        if (!isNaN(num)) {
          sum += num;
          hasAny = true;
        }
      }
    }
    if (hasAny) {
      return Math.round(sum * 100) / 100;
    }
  }

  // 1. Check if dateStr explicitly has subproperties or property value
  const currentDay = allEntries[dateStr];
  if (currentDay?.subpropertyValues?.[propertyId]) {
    const subs = currentDay.subpropertyValues[propertyId];
    const vals = Object.values(subs).map(Number).filter((v) => !isNaN(v));
    if (vals.length > 0) {
      return Math.round(vals.reduce((acc, v) => acc + v, 0) * 100) / 100;
    }
  }

  if (currentDay?.properties && propertyId in currentDay.properties) {
    const val = currentDay.properties[propertyId];
    if (val !== undefined && val !== null && val !== '') {
      return val;
    }
  }

  // 2. Look backwards in time (< dateStr) for the latest recorded non-empty value
  const priorDates = Object.keys(allEntries)
    .filter((d) => d < dateStr)
    .sort()
    .reverse();

  for (const pDate of priorDates) {
    const pEntry = allEntries[pDate];
    if (pEntry?.subpropertyValues?.[propertyId]) {
      const subs = pEntry.subpropertyValues[propertyId];
      const vals = Object.values(subs).map(Number).filter((v) => !isNaN(v));
      if (vals.length > 0) {
        return Math.round(vals.reduce((acc, v) => acc + v, 0) * 100) / 100;
      }
    }
    if (pEntry?.properties && propertyId in pEntry.properties) {
      const pVal = pEntry.properties[propertyId];
      if (pVal !== undefined && pVal !== null && pVal !== '') {
        return pVal;
      }
    }
  }

  return undefined;
}

/**
 * Resolves the effective subproperty dictionary for a compound property on a given date.
 * For each subproperty defined on the property:
 * - Uses the value recorded on dateStr if present.
 * - Otherwise carries over the most recent value from any date < dateStr.
 */
export function getEffectiveSubpropertyValues(
  allEntries: Record<string, DayEntry>,
  dateStr: string,
  propertyId: string,
  subproperties?: { id: string; name: string }[]
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!subproperties || subproperties.length === 0) return result;

  const currentDaySubs = allEntries[dateStr]?.subpropertyValues?.[propertyId] || {};

  // Prior dates sorted descending
  const priorDates = Object.keys(allEntries)
    .filter((d) => d < dateStr)
    .sort()
    .reverse();

  for (const sp of subproperties) {
    // Check if explicitly recorded on dateStr
    if (sp.id in currentDaySubs) {
      const raw = currentDaySubs[sp.id];
      const num = typeof raw === 'number' ? raw : parseFloat(raw as any);
      if (!isNaN(num)) {
        result[sp.id] = num;
        continue;
      }
    }

    // Look backwards in prior entries
    let found = false;
    for (const pDate of priorDates) {
      const pSubs = allEntries[pDate]?.subpropertyValues?.[propertyId];
      if (pSubs && sp.id in pSubs) {
        const raw = pSubs[sp.id];
        const num = typeof raw === 'number' ? raw : parseFloat(raw as any);
        if (!isNaN(num)) {
          result[sp.id] = num;
          found = true;
          break;
        }
      }
    }

    if (!found && sp.id in currentDaySubs) {
      const raw = currentDaySubs[sp.id];
      const num = typeof raw === 'number' ? raw : parseFloat(raw as any);
      if (!isNaN(num)) {
        result[sp.id] = num;
      }
    }
  }

  return result;
}

/**
 * Returns an enriched DayEntry for dateStr where all daily properties and subproperties
 * have their effective carried-over values merged in, unless manually changed on dateStr.
 */
export function getEffectiveDayEntry(
  allEntries: Record<string, DayEntry>,
  dateStr: string,
  propertyDefs: DailyPropertyDefinition[]
): DayEntry {
  const rawEntry = allEntries[dateStr];
  const baseEntry: DayEntry = rawEntry
    ? { ...rawEntry }
    : {
        date: dateStr,
        journal: '',
        energyLevel: 3,
        updatedAt: '',
      };

  const effectiveProperties: Record<string, number | string | boolean> = {
    ...(baseEntry.properties || {}),
  };
  const effectiveSubprops: Record<string, Record<string, number>> = {
    ...(baseEntry.subpropertyValues || {}),
  };

  for (const prop of propertyDefs) {
    const hasSubprops = Boolean(prop.subproperties && prop.subproperties.length > 0);

    if (hasSubprops) {
      const subs = getEffectiveSubpropertyValues(allEntries, dateStr, prop.id, prop.subproperties);
      effectiveSubprops[prop.id] = {
        ...(effectiveSubprops[prop.id] || {}),
        ...subs,
      };

      // Compute total sum from subproperties
      const totalSum = (prop.subproperties || []).reduce((acc, sp) => {
        const raw = effectiveSubprops[prop.id]?.[sp.id];
        const val = typeof raw === 'number' ? raw : parseFloat(raw as any);
        return acc + (!isNaN(val) ? val : 0);
      }, 0);

      // A compound property's total value is ALWAYS the sum of its subproperties
      effectiveProperties[prop.id] = Math.round(totalSum * 100) / 100;
    } else {
      if (!(baseEntry.properties && prop.id in baseEntry.properties)) {
        const effVal = getEffectivePropertyValue(allEntries, dateStr, prop.id);
        if (effVal !== undefined) {
          effectiveProperties[prop.id] = effVal;
        }
      }
    }
  }

  return {
    ...baseEntry,
    properties: effectiveProperties,
    subpropertyValues: effectiveSubprops,
  };
}

/**
 * Computes the previous recorded value of a property prior to dateStr
 * for delta calculation.
 */
export function getPreviousRecordedValue(
  allEntries: Record<string, DayEntry>,
  dateStr: string,
  property: DailyPropertyDefinition
): { val: number | string | boolean; date: string } | null {
  const priorDates = Object.keys(allEntries)
    .filter((d) => d < dateStr)
    .sort()
    .reverse();

  const hasSubprops = Boolean(property.subproperties && property.subproperties.length > 0);

  for (const pDate of priorDates) {
    const pEntry = allEntries[pDate];
    if (hasSubprops) {
      const effSubs = getEffectiveSubpropertyValues(allEntries, pDate, property.id, property.subproperties);
      let subSum = 0;
      let hasAny = false;
      for (const sp of property.subproperties || []) {
        if (sp.id in effSubs) {
          subSum += effSubs[sp.id];
          hasAny = true;
        }
      }
      if (hasAny) {
        return {
          val: Math.round(subSum * 100) / 100,
          date: pDate,
        };
      }
    }

    if (pEntry?.properties && property.id in pEntry.properties) {
      const v = pEntry.properties[property.id];
      if (v !== undefined && v !== null && v !== '') {
        const num = typeof v === 'number' ? v : parseFloat(v as any);
        return { val: isNaN(num) ? v : Math.round(num * 100) / 100, date: pDate };
      }
    }
  }

  return null;
}

/**
 * Computes the previous recorded subproperty value prior to dateStr
 * for individual subproperty delta calculation.
 */
export function getPreviousRecordedSubValue(
  allEntries: Record<string, DayEntry>,
  dateStr: string,
  propertyId: string,
  subpropertyId: string
): { val: number; date: string } | null {
  const priorDates = Object.keys(allEntries)
    .filter((d) => d < dateStr)
    .sort()
    .reverse();

  for (const pDate of priorDates) {
    const pSubs = allEntries[pDate]?.subpropertyValues?.[propertyId];
    if (pSubs && subpropertyId in pSubs) {
      const raw = pSubs[subpropertyId];
      const v = typeof raw === 'number' ? raw : parseFloat(raw as any);
      if (!isNaN(v)) {
        return { val: v, date: pDate };
      }
    }
  }

  return null;
}
