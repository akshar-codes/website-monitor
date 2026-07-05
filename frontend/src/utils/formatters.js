import { formatDistanceToNow, format, differenceInSeconds, differenceInMinutes, differenceInHours } from 'date-fns';

/**
 * Format a date as a relative time string (e.g. "2 min ago")
 */
export function formatRelativeTime(date) {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '—';
  }
}

/**
 * Format a date for display (e.g. "Jun 10, 2026 2:30 PM")
 */
export function formatDateTime(date) {
  if (!date) return '—';
  try {
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  } catch {
    return '—';
  }
}

/**
 * Format a date as short time (e.g. "2:30 PM")
 */
export function formatTime(date) {
  if (!date) return '—';
  try {
    return format(new Date(date), 'h:mm a');
  } catch {
    return '—';
  }
}

/**
 * Format a date as short date (e.g. "Jun 10")
 */
export function formatShortDate(date) {
  if (!date) return '—';
  try {
    return format(new Date(date), 'MMM d');
  } catch {
    return '—';
  }
}

/**
 * Format duration between two dates in human-readable form
 */
export function formatDuration(startDate, endDate) {
  if (!startDate) return '—';
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  const totalSeconds = differenceInSeconds(end, start);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = differenceInMinutes(end, start);
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = differenceInHours(end, start);
  const minutes = totalMinutes % 60;
  if (hours < 24) return `${hours}h ${minutes}m`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

/**
 * Format duration in seconds to human readable
 */
export function formatDurationSeconds(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format response time in milliseconds
 */
export function formatResponseTime(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * Format a number as a percentage
 */
export function formatPercentage(value, decimals = 2) {
  if (value == null) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format monitor interval (seconds) to human readable
 */
export function formatInterval(seconds) {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  return `${seconds / 3600}h`;
}

/**
 * Truncate a URL for display
 */
export function truncateUrl(url, maxLength = 40) {
  if (!url) return '—';
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    if (display.length <= maxLength) return display;
    return display.substring(0, maxLength - 3) + '...';
  } catch {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
}

/**
 * Format a large number with commas
 */
export function formatNumber(num) {
  if (num == null) return '—';
  return Number(num).toLocaleString();
}
