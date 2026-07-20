export const VACCINE_INTERVAL_MONTHS = 6;

function daysInUtcMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addMonthsToIsoDate(isoDate, months = VACCINE_INTERVAL_MONTHS) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const targetDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
}

export function evaluateVaccineInterval(lastApplicationDate, requestedDate) {
  if (!lastApplicationDate) {
    return { allowed: true, nextAllowedDate: addMonthsToIsoDate(requestedDate) };
  }

  const nextAllowedDate = addMonthsToIsoDate(lastApplicationDate);
  if (requestedDate < nextAllowedDate) {
    return {
      allowed: false,
      lastApplicationDate,
      nextAllowedDate,
      message: `La vacuna ya fue aplicada el ${lastApplicationDate}. Podra aplicarse nuevamente a partir del ${nextAllowedDate}.`
    };
  }

  return { allowed: true, nextAllowedDate: addMonthsToIsoDate(requestedDate) };
}
