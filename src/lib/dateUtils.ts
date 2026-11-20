export interface EvergreenTarget {
  targetYear: number;
  targetDate: Date;
  isCelebrating: boolean;
  celebrationYear: number;
}

export interface RemainingTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  totalMs: number;
}

export const BD_OFFSET_HOURS = 6;
export const BD_OFFSET_MS = BD_OFFSET_HOURS * 60 * 60 * 1000;

/**
 * Returns the target information for the Evergreen New Year countdown based on Bangladesh time (UTC+6).
 * - During Jan 1 00:00:00 to Jan 3 00:00:00 BD time (the first 48 hours of the year): isCelebrating = true.
 * - From Jan 3 00:00:00 BD time onward: automatically targets Jan 1 of next year.
 */
export function getEvergreenTarget(now: Date = new Date()): EvergreenTarget {
  const nowMs = now.getTime();
  const bdNow = new Date(nowMs + BD_OFFSET_MS);
  const currentBdYear = bdNow.getUTCFullYear();

  // Jan 1 00:00:00 BD time in UTC milliseconds:
  const currentYearStartUtcMs = Date.UTC(currentBdYear, 0, 1, 0, 0, 0) - BD_OFFSET_MS;
  const celebrationEndUtcMs = currentYearStartUtcMs + 48 * 60 * 60 * 1000;

  // Check if now is within the first 48 hours of currentBdYear in Bangladesh time (Jan 1 & Jan 2)
  if (nowMs >= currentYearStartUtcMs && nowMs < celebrationEndUtcMs) {
    const nextYear = currentBdYear + 1;
    const nextTargetDate = new Date(Date.UTC(nextYear, 0, 1, 0, 0, 0) - BD_OFFSET_MS);

    return {
      targetYear: nextYear,
      targetDate: nextTargetDate,
      isCelebrating: true,
      celebrationYear: currentBdYear,
    };
  }

  // Otherwise, target upcoming Jan 1 00:00:00 BD time
  const targetYear = currentBdYear + 1;
  const targetDate = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0) - BD_OFFSET_MS);

  return {
    targetYear,
    targetDate,
    isCelebrating: false,
    celebrationYear: currentBdYear,
  };
}

/**
 * Calculates remaining days, hours, minutes, and seconds clamped at 0.
 */
export function getRemainingParts(
  targetDate: Date,
  now: Date = new Date()
): RemainingTime {
  const diff = Math.max(0, targetDate.getTime() - now.getTime());

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const milliseconds = Math.floor(diff % 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
    totalMs: diff,
  };
}
