function getLastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function normalizeCutoffKey(year, monthIndex, half) {
  let nextYear = year;
  let nextMonthIndex = monthIndex;
  let nextHalf = half;

  while (nextHalf < 1) {
    nextHalf += 2;
    nextMonthIndex -= 1;
    if (nextMonthIndex < 0) {
      nextMonthIndex = 11;
      nextYear -= 1;
    }
  }

  while (nextHalf > 2) {
    nextHalf -= 2;
    nextMonthIndex += 1;
    if (nextMonthIndex > 11) {
      nextMonthIndex = 0;
      nextYear += 1;
    }
  }

  return { year: nextYear, monthIndex: nextMonthIndex, half: nextHalf };
}

export function formatCutoffLabel({ year, monthIndex, half }) {
  const startDay = half === 1 ? 1 : 16;
  const endDay = half === 1 ? 15 : getLastDayOfMonth(year, monthIndex);
  const monthLabel = new Date(year, monthIndex, 1).toLocaleString("en-US", { month: "long" });
  return `${monthLabel} ${startDay}-${endDay}, ${year}`;
}

export function getCutoffKeyFromDate(input = new Date()) {
  const date = new Date(input);
  return {
    year: date.getFullYear(),
    monthIndex: date.getMonth(),
    half: date.getDate() <= 15 ? 1 : 2,
  };
}

export function getCutoffLabelFromDate(input = new Date()) {
  return formatCutoffLabel(getCutoffKeyFromDate(input));
}

export function buildCutoffOptions(referenceDate = new Date(), count = 2) {
  const start = getCutoffKeyFromDate(referenceDate);
  return Array.from({ length: count }, (_, index) => {
    const cutoff = normalizeCutoffKey(start.year, start.monthIndex, start.half - index);
    return formatCutoffLabel(cutoff);
  });
}

export function mergeCutoffOptions(values = [], referenceDate = new Date(), count = 6) {
  const merged = [...buildCutoffOptions(referenceDate, count), ...values.filter(Boolean)];
  return Array.from(new Set(merged));
}
