export const OPEN_NOW_TIME_ZONE = "America/Sao_Paulo";
export const OPEN_NOW_CACHE_TTL_MS = 15 * 60 * 1000;
export const CLOSING_SOON_MINUTES = 60;

export type GoogleLocalDate = {
  year?: number;
  month?: number;
  day?: number;
};

export type GooglePeriodPoint = {
  day?: number;
  hour?: number;
  minute?: number;
  date?: GoogleLocalDate;
  truncated?: boolean;
};

export type GoogleOpeningPeriod = {
  open?: GooglePeriodPoint;
  close?: GooglePeriodPoint;
};

export type OpeningHoursSnapshot = {
  openNow?: boolean;
  periods?: GoogleOpeningPeriod[];
  weekdayDescriptions?: string[];
  specialDays?: Array<{
    date?: GoogleLocalDate;
    exceptionalHours?: boolean;
  }>;
};

export type OpenNowState =
  | "OPEN"
  | "CLOSING_SOON"
  | "OPEN_LATE"
  | "CLOSED"
  | "UNKNOWN";

export type OpenNowEvaluation = {
  state: OpenNowState;
  isOpen: boolean | null;
  source: "current" | "regular" | "unknown";
  is24Hours: boolean;
  closingAt: string | null;
  minutesUntilClose: number | null;
  evaluatedAt: string;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

const WEEKDAY = new Map([
  ["Sun", 0],
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
]);

function zonedParts(date: Date, timeZone = OPEN_NOW_TIME_ZONE): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: WEEKDAY.get(value("weekday")) ?? 0,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function civilDay(year: number, month: number, day: number) {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function nowMinuteIndex(date: Date) {
  const parts = zonedParts(date);
  return {
    parts,
    value:
      civilDay(parts.year, parts.month, parts.day) * 1440 +
      parts.hour * 60 +
      parts.minute,
  };
}

function pointMinuteOfDay(point: GooglePeriodPoint) {
  return Math.max(0, Math.min(1439, (point.hour ?? 0) * 60 + (point.minute ?? 0)));
}

function explicitDateIndex(point: GooglePeriodPoint) {
  const date = point.date;
  if (
    !date ||
    typeof date.year !== "number" ||
    typeof date.month !== "number" ||
    typeof date.day !== "number"
  ) {
    return null;
  }
  return civilDay(date.year, date.month, date.day);
}

function periodInstances(
  period: GoogleOpeningPeriod,
  now: Date,
): Array<{ start: number; end: number | null; crossesMidnight: boolean }> {
  if (!period.open) return [];
  const current = nowMinuteIndex(now);
  const openMinute = pointMinuteOfDay(period.open);
  const closeMinute = period.close ? pointMinuteOfDay(period.close) : null;
  const openExplicit = explicitDateIndex(period.open);
  const closeExplicit = period.close ? explicitDateIndex(period.close) : null;

  if (openExplicit !== null) {
    const start = openExplicit * 1440 + openMinute;
    if (!period.close) return [{ start, end: null, crossesMidnight: true }];

    let closeDay = closeExplicit;
    if (closeDay === null) {
      const openDay = period.open.day ?? current.parts.weekday;
      const closeDayOfWeek = period.close.day ?? openDay;
      let delta = (closeDayOfWeek - openDay + 7) % 7;
      if (delta === 0 && closeMinute !== null && closeMinute <= openMinute) delta = 1;
      closeDay = openExplicit + delta;
    }
    return [{
      start,
      end: closeDay * 1440 + (closeMinute ?? 0),
      crossesMidnight: closeDay > openExplicit,
    }];
  }

  const openDay = period.open.day;
  if (typeof openDay !== "number") return [];

  const forward = (openDay - current.parts.weekday + 7) % 7;
  const candidates = [forward, forward - 7];
  const instances: Array<{ start: number; end: number | null; crossesMidnight: boolean }> = [];

  for (const delta of candidates) {
    const startDay =
      civilDay(current.parts.year, current.parts.month, current.parts.day) + delta;
    const start = startDay * 1440 + openMinute;
    if (!period.close) {
      instances.push({ start, end: null, crossesMidnight: true });
      continue;
    }

    const closeDayOfWeek = period.close.day ?? openDay;
    let closeDelta = (closeDayOfWeek - openDay + 7) % 7;
    if (closeDelta === 0 && closeMinute !== null && closeMinute <= openMinute) {
      closeDelta = 1;
    }
    const end = (startDay + closeDelta) * 1440 + (closeMinute ?? 0);
    instances.push({
      start,
      end,
      crossesMidnight: closeDelta > 0,
    });
  }
  return instances;
}

function activePeriod(hours: OpeningHoursSnapshot, now: Date) {
  const nowIndex = nowMinuteIndex(now).value;
  for (const period of hours.periods ?? []) {
    for (const instance of periodInstances(period, now)) {
      if (instance.end === null) {
        if (nowIndex >= instance.start && nowIndex < instance.start + 7 * 1440) {
          return instance;
        }
      } else if (nowIndex >= instance.start && nowIndex < instance.end) {
        return instance;
      }
    }
  }
  return null;
}

function formatMinuteIndex(value: number) {
  const minute = ((value % 1440) + 1440) % 1440;
  const hour = Math.floor(minute / 60);
  const min = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function evaluateOpenHours(
  hours: OpeningHoursSnapshot,
  now: Date,
  source: "current" | "regular",
): OpenNowEvaluation | null {
  const current = nowMinuteIndex(now);
  const active = activePeriod(hours, now);

  if (typeof hours.openNow === "boolean") {
    if (!hours.openNow) {
      return {
        state: "CLOSED",
        isOpen: false,
        source,
        is24Hours: false,
        closingAt: null,
        minutesUntilClose: null,
        evaluatedAt: now.toISOString(),
      };
    }

    if (!active) {
      return {
        state: "OPEN",
        isOpen: true,
        source,
        is24Hours: false,
        closingAt: null,
        minutesUntilClose: null,
        evaluatedAt: now.toISOString(),
      };
    }
  } else if (!active) {
    if ((hours.periods ?? []).length > 0) {
      return {
        state: "CLOSED",
        isOpen: false,
        source,
        is24Hours: false,
        closingAt: null,
        minutesUntilClose: null,
        evaluatedAt: now.toISOString(),
      };
    }
    return null;
  }

  if (!active) return null;

  if (active.end === null || active.end - active.start >= 7 * 1440) {
    return {
      state: "OPEN",
      isOpen: true,
      source,
      is24Hours: true,
      closingAt: null,
      minutesUntilClose: null,
      evaluatedAt: now.toISOString(),
    };
  }

  const minutesUntilClose = Math.max(0, active.end - current.value);
  const closingAt = formatMinuteIndex(active.end);
  const closingCivilDay = Math.floor(active.end / 1440);
  const currentCivilDay = Math.floor(current.value / 1440);
  const closesNextDay = closingCivilDay > currentCivilDay;

  return {
    state:
      minutesUntilClose <= CLOSING_SOON_MINUTES
        ? "CLOSING_SOON"
        : closesNextDay || closingAt >= "23:00"
          ? "OPEN_LATE"
          : "OPEN",
    isOpen: true,
    source,
    is24Hours: false,
    closingAt,
    minutesUntilClose,
    evaluatedAt: now.toISOString(),
  };
}

export function evaluateOpenNow(
  currentOpeningHours: OpeningHoursSnapshot | null | undefined,
  regularOpeningHours: OpeningHoursSnapshot | null | undefined,
  now = new Date(),
): OpenNowEvaluation {
  if (currentOpeningHours) {
    const current = evaluateOpenHours(currentOpeningHours, now, "current");
    if (current) return current;
  }

  if (regularOpeningHours) {
    const regular = evaluateOpenHours(regularOpeningHours, now, "regular");
    if (regular) return regular;
  }

  return {
    state: "UNKNOWN",
    isOpen: null,
    source: "unknown",
    is24Hours: false,
    closingAt: null,
    minutesUntilClose: null,
    evaluatedAt: now.toISOString(),
  };
}

export function isOpenState(state: OpenNowState) {
  return state === "OPEN" || state === "CLOSING_SOON" || state === "OPEN_LATE";
}

export function isOpenNowCacheFresh(
  checkedAt: string | null | undefined,
  now = new Date(),
) {
  if (!checkedAt) return false;
  const value = new Date(checkedAt).getTime();
  return Number.isFinite(value) && now.getTime() - value < OPEN_NOW_CACHE_TTL_MS;
}

export function brazilClock(now = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: OPEN_NOW_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}
