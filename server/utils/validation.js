const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = value => typeof value === 'string' && UUID.test(value);
export const isTime = value => typeof value === 'string' && TIME.test(value);
export const isDate = value => {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
export const isTimezone = value => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return true; }
  catch { return false; }
};
export const isHttpUrl = value => {
  if (value == null || value === '') return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
};
export const isPhone = value => value == null || value === '' || /^[0-9+()\-\s]{7,30}$/.test(value);
export const finiteInRange = (value, min, max) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

export function minutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function timeFromMinutes(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function zonedLocalToUtc(date, time, timeZone) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const intended = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = intended;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(candidate)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
    candidate -= represented - intended;
  }
  return new Date(candidate).toISOString();
}
