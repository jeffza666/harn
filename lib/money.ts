/** Largest unit price or added charge accepted from a form, in minor units. */
export const MAX_UNIT_MINOR = 100_000_000;

/** Largest printed or calculated bill total accepted, in minor units. */
export const MAX_TOTAL_MINOR = 1_000_000_000_000;

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const RATE_PATTERN = /^\d+(\.\d{1,4})?$/;

export function parsePositiveInt(input: string, max: number): number | null {
  const value = input.trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) return null;
  return parsed;
}

export function parseMinor(input: string, max = MAX_UNIT_MINOR): number | null {
  const value = input.trim();
  if (!MONEY_PATTERN.test(value) || value.split(".")[0].length > 12) return null;
  const [whole, fraction = ""] = value.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > max) return null;
  return minor;
}

/** USD→THB rate scaled by 10,000. 35.5 becomes 355000. */
export function parseRateMilli(input: string): number | null {
  const value = input.trim();
  if (!RATE_PATTERN.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (whole.length > 5) return null;
  const milli = Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));
  if (!Number.isSafeInteger(milli) || milli <= 0 || milli > 100_000_000) return null;
  return milli;
}

export function isIsoDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const [year, month, day] = input.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function formatMinor(minor: number): string {
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  if (!Number.isSafeInteger(absolute)) return "—";
  const whole = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${fraction.toString().padStart(2, "0")}`;
}

export function formatMinorPlain(minor: number): string {
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const fraction = absolute % 100;
  return `${whole}.${fraction.toString().padStart(2, "0")}`;
}

/**
 * Round half up (away from zero for positive amounts) without binary floating point.
 * `rateMilli` is the THB-per-USD rate times 10,000.
 */
export function convertUsdCentsToThbSatang(cents: number, rateMilli: number): number {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("Invalid USD amount");
  }
  if (!Number.isSafeInteger(rateMilli) || rateMilli <= 0) {
    throw new Error("Invalid exchange rate");
  }
  if (cents !== 0 && rateMilli > Math.floor(Number.MAX_SAFE_INTEGER / cents)) {
    throw new Error("Amount overflow");
  }
  const product = cents * rateMilli;
  if (product > Number.MAX_SAFE_INTEGER - 5_000) {
    throw new Error("Amount overflow");
  }
  return Math.floor((product + 5_000) / 10_000);
}
