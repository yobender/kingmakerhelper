export const KINGMAKER_DEFAULT_START_DATE = "4710-02-24";

export const GOLARION_MONTHS = Object.freeze([
  { name: "Abadius", shortName: "Aba", days: 31 },
  { name: "Calistril", shortName: "Cal", days: 28 },
  { name: "Pharast", shortName: "Pha", days: 31 },
  { name: "Gozran", shortName: "Goz", days: 30 },
  { name: "Desnus", shortName: "Des", days: 31 },
  { name: "Sarenith", shortName: "Sar", days: 30 },
  { name: "Erastus", shortName: "Era", days: 31 },
  { name: "Arodus", shortName: "Aro", days: 31 },
  { name: "Rova", shortName: "Rov", days: 30 },
  { name: "Lamashan", shortName: "Lam", days: 31 },
  { name: "Neth", shortName: "Net", days: 30 },
  { name: "Kuthona", shortName: "Kut", days: 31 },
]);

const DAYS_PER_YEAR = GOLARION_MONTHS.reduce((sum, month) => sum + month.days, 0);

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseGolarionDate(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = toInt(match[1], 0);
  const month = toInt(match[2], 0);
  const day = toInt(match[3], 0);
  const monthData = GOLARION_MONTHS[month - 1];

  if (!year || !monthData || day < 1 || day > monthData.days) return null;

  return {
    year,
    month,
    day,
    monthData,
  };
}

export function normalizeGolarionDate(value, fallback = KINGMAKER_DEFAULT_START_DATE) {
  return parseGolarionDate(value) ? String(value).trim() : fallback;
}

export function formatGolarionDate(value, options = {}) {
  const parsed = parseGolarionDate(value);
  if (!parsed) return options.fallback || "No date";
  return `${parsed.day} ${parsed.monthData.name} ${parsed.year} AR`;
}

export function getGolarionMonthYearLabel(value) {
  const parsed = parseGolarionDate(value);
  if (!parsed) return "Unknown month";
  return `${parsed.monthData.name} ${parsed.year} AR`;
}

export function toGolarionOrdinal(value) {
  const parsed = parseGolarionDate(value);
  if (!parsed) return 0;

  let days = parsed.year * DAYS_PER_YEAR;
  for (let monthIndex = 0; monthIndex < parsed.month - 1; monthIndex += 1) {
    days += GOLARION_MONTHS[monthIndex].days;
  }
  days += parsed.day;
  return days;
}

export function diffGolarionDates(left, right) {
  return toGolarionOrdinal(right) - toGolarionOrdinal(left);
}

export function addDaysToGolarionDate(value, amount) {
  const parsed = parseGolarionDate(value) || parseGolarionDate(KINGMAKER_DEFAULT_START_DATE);
  let remaining = Math.max(0, Number.parseInt(String(amount || 0), 10) || 0);
  let year = parsed.year;
  let month = parsed.month;
  let day = parsed.day;

  while (remaining > 0) {
    day += 1;
    const monthDays = GOLARION_MONTHS[month - 1].days;
    if (day > monthDays) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    remaining -= 1;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function sameGolarionMonth(left, right) {
  const leftDate = parseGolarionDate(left);
  const rightDate = parseGolarionDate(right);
  return !!leftDate && !!rightDate && leftDate.year === rightDate.year && leftDate.month === rightDate.month;
}

export function getGolarionMonthContext(value) {
  const currentDate = normalizeGolarionDate(value);
  const parsed = parseGolarionDate(currentDate) || parseGolarionDate(KINGMAKER_DEFAULT_START_DATE);
  return {
    currentDate,
    parsed,
    month: parsed.monthData,
    monthLabel: `${parsed.monthData.name} ${parsed.year} AR`,
    daysRemaining: Math.max(0, parsed.monthData.days - parsed.day),
  };
}
