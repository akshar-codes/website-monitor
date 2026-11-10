/**
 * Zero-dependency cron expression validator and human-readable schedule describer.
 * Supports standard 5-part expressions and standard aliases (@daily, @hourly, etc.).
 */

const MACROS = {
  "@yearly": "Every year on January 1 at midnight",
  "@annually": "Every year on January 1 at midnight",
  "@monthly": "Every month on the 1st at midnight",
  "@weekly": "Every week on Sunday at midnight",
  "@daily": "Every day at midnight (00:00)",
  "@midnight": "Every day at midnight (00:00)",
  "@hourly": "Every hour at minute 0",
};

export const MACRO_EQUIVALENTS = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const MONTHS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Validates a single cron sub-part against allowed range.
 */
function isValidField(part, min, max, named = null) {
  if (!part || typeof part !== "string") return false;
  const subParts = part.split(",");

  for (const item of subParts) {
    if (item === "*") continue;

    // Step e.g. */15 or 1-30/5
    if (item.includes("/")) {
      const [range, step] = item.split("/");
      const stepNum = Number(step);
      if (isNaN(stepNum) || stepNum <= 0) return false;
      if (range !== "*" && !isValidRange(range, min, max, named)) return false;
      continue;
    }

    if (!isValidRange(item, min, max, named)) return false;
  }
  return true;
}

function isValidRange(item, min, max, named = null) {
  if (item.includes("-")) {
    const [start, end] = item.split("-");
    const s = resolveVal(start, named);
    const e = resolveVal(end, named);
    if (s === null || e === null || s < min || e > max || s > e) return false;
    return true;
  }
  const v = resolveVal(item, named);
  return v !== null && v >= min && v <= max;
}

function resolveVal(val, named = null) {
  const num = Number(val);
  if (!isNaN(num) && Number.isInteger(num)) return num;
  if (named && typeof val === "string") {
    const idx = named.findIndex(
      (n) => n && n.toLowerCase() === val.toLowerCase(),
    );
    if (idx !== -1) return idx;
  }
  return null;
}

/**
 * Validates a cron expression string.
 * @param {string} expr
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCron(expr) {
  if (!expr || typeof expr !== "string") {
    return { valid: false, error: "Cron expression cannot be empty" };
  }

  const trimmed = expr.trim();
  if (MACROS[trimmed.toLowerCase()]) {
    return { valid: true };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    return {
      valid: false,
      error: `Expected 5 fields (minute, hour, day, month, day-of-week), got ${parts.length}`,
    };
  }

  const [min, hr, dom, mon, dow] = parts;

  if (!isValidField(min, 0, 59)) {
    return {
      valid: false,
      error: `Invalid minute field "${min}": must be 0-59, *, or */n`,
    };
  }
  if (!isValidField(hr, 0, 23)) {
    return {
      valid: false,
      error: `Invalid hour field "${hr}": must be 0-23, *, or */n`,
    };
  }
  if (!isValidField(dom, 1, 31)) {
    return {
      valid: false,
      error: `Invalid day of month "${dom}": must be 1-31 or *`,
    };
  }
  if (!isValidField(mon, 1, 12, MONTHS)) {
    return {
      valid: false,
      error: `Invalid month "${mon}": must be 1-12 or JAN-DEC`,
    };
  }
  if (!isValidField(dow, 0, 7, DAYS_OF_WEEK)) {
    return {
      valid: false,
      error: `Invalid day of week "${dow}": must be 0-7 or SUN-SAT`,
    };
  }

  return { valid: true };
}

/**
 * Produces an accurate human-readable English description of a cron expression.
 * @param {string} expr
 * @param {string} [timezone]
 * @returns {string}
 */
export function describeCron(expr, timezone = null) {
  if (!expr || typeof expr !== "string") return "No schedule defined";
  const trimmed = expr.trim();

  if (MACROS[trimmed.toLowerCase()]) {
    const desc = MACROS[trimmed.toLowerCase()];
    return timezone ? `${desc} (${timezone})` : desc;
  }

  const validation = validateCron(trimmed);
  if (!validation.valid) {
    return validation.error || "Invalid cron expression";
  }

  const [min, hr, dom, mon, dow] = trimmed.split(/\s+/);

  // Common patterns
  if (trimmed === "* * * * *") {
    return wrapTz("Every minute", timezone);
  }

  if (
    min.startsWith("*/") &&
    hr === "*" &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    const step = min.slice(2);
    return wrapTz(`Every ${step} minutes`, timezone);
  }

  if (
    min === "0" &&
    hr.startsWith("*/") &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    const step = hr.slice(2);
    return wrapTz(`Every ${step} hours (at minute 0)`, timezone);
  }

  if (min === "0" && hr === "*" && dom === "*" && mon === "*" && dow === "*") {
    return wrapTz("Every hour at minute 0", timezone);
  }

  if (dom === "*" && mon === "*" && dow === "*") {
    // Specific time every day
    if (!isNaN(Number(min)) && !isNaN(Number(hr))) {
      const timeStr = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      return wrapTz(`Every day at ${timeStr}`, timezone);
    }
  }

  if (dow === "1-5" && dom === "*" && mon === "*") {
    if (!isNaN(Number(min)) && !isNaN(Number(hr))) {
      const timeStr = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      return wrapTz(`Weekdays (Mon-Fri) at ${timeStr}`, timezone);
    }
  }

  if (dow === "0" || dow === "7") {
    if (
      !isNaN(Number(min)) &&
      !isNaN(Number(hr)) &&
      dom === "*" &&
      mon === "*"
    ) {
      const timeStr = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      return wrapTz(`Every Sunday at ${timeStr}`, timezone);
    }
  }

  if (dom === "1" && mon === "*" && dow === "*") {
    if (!isNaN(Number(min)) && !isNaN(Number(hr))) {
      const timeStr = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      return wrapTz(`On the 1st of every month at ${timeStr}`, timezone);
    }
  }

  // Generic descriptive builder
  let timeDesc;
  if (min === "*" && hr === "*") {
    timeDesc = "every minute";
  } else if (min.startsWith("*/")) {
    timeDesc = `every ${min.slice(2)} minutes`;
  } else if (!isNaN(Number(min)) && hr === "*") {
    timeDesc = `at minute ${min} of every hour`;
  } else if (!isNaN(Number(min)) && !isNaN(Number(hr))) {
    timeDesc = `at ${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } else {
    timeDesc = `at ${hr}:${min}`;
  }

  let dayDesc = "";
  if (dow !== "*") {
    if (dow === "1-5") dayDesc = " on weekdays";
    else if (dow === "0,6" || dow === "6,0") dayDesc = " on weekends";
    else {
      const dName = DAYS_OF_WEEK[Number(dow)];
      dayDesc = dName ? ` on ${dName}` : ` on day-of-week ${dow}`;
    }
  } else if (dom !== "*") {
    dayDesc = ` on day ${dom} of month`;
  }

  let monthDesc = "";
  if (mon !== "*") {
    const mName = MONTHS[Number(mon)];
    monthDesc = mName ? ` in ${mName}` : ` in month ${mon}`;
  }

  const full = `Runs ${timeDesc}${dayDesc}${monthDesc}`;
  return wrapTz(full, timezone);
}

function wrapTz(text, timezone) {
  if (!timezone || timezone === "UTC") return `${text} (${timezone || "UTC"})`;
  return `${text} (${timezone})`;
}
