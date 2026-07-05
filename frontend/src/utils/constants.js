// Status colors (maps to CSS custom properties)
export const STATUS_COLORS = {
  up: { color: 'var(--status-up)', bg: 'var(--status-up-bg)', label: 'Up' },
  down: { color: 'var(--status-down)', bg: 'var(--status-down-bg)', label: 'Down' },
  degraded: { color: 'var(--status-degraded)', bg: 'var(--status-degraded-bg)', label: 'Degraded' },
  unknown: { color: 'var(--status-unknown)', bg: 'var(--status-unknown-bg)', label: 'Unknown' },
  paused: { color: 'var(--status-paused)', bg: 'var(--status-paused-bg)', label: 'Paused' },
  // Incident statuses
  ongoing: { color: 'var(--status-down)', bg: 'var(--status-down-bg)', label: 'Ongoing' },
  investigating: { color: 'var(--status-degraded)', bg: 'var(--status-degraded-bg)', label: 'Investigating' },
  identified: { color: 'var(--severity-major)', bg: 'var(--severity-major-bg)', label: 'Identified' },
  resolved: { color: 'var(--status-up)', bg: 'var(--status-up-bg)', label: 'Resolved' },
};

export const SEVERITY_COLORS = {
  critical: { color: 'var(--severity-critical)', bg: 'var(--severity-critical-bg)', label: 'Critical' },
  major: { color: 'var(--severity-major)', bg: 'var(--severity-major-bg)', label: 'Major' },
  minor: { color: 'var(--severity-minor)', bg: 'var(--severity-minor-bg)', label: 'Minor' },
};

export const INTERVAL_PRESETS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
];

export const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'name', label: 'Name' },
  { value: 'url', label: 'URL' },
  { value: 'interval', label: 'Interval' },
  { value: 'updatedAt', label: 'Last Updated' },
];

export const ROUTES = {
  DASHBOARD: '/',
  MONITORS: '/monitors',
  MONITOR_DETAIL: '/monitors/:id',
  INCIDENTS: '/incidents',
  INCIDENT_DETAIL: '/incidents/:id',
};

export const QUERY_KEYS = {
  DASHBOARD: 'dashboard',
  MONITORS: 'monitors',
  MONITOR_STATS: 'monitor-stats',
  INCIDENTS: 'incidents',
  HEALTH_CHECKS: 'health-checks',
  SERVER_HEALTH: 'server-health',
};

export const FAILURE_REASONS = {
  timeout: 'Request Timeout',
  dns_error: 'DNS Error',
  connection_refused: 'Connection Refused',
  invalid_json: 'Invalid JSON',
  invalid_contract: 'Invalid Contract',
  insufficient_health_data: 'Insufficient Health Data',
  http_error: 'HTTP Error',
  frontend_down: 'Frontend Down',
  backend_down: 'Backend Down',
  database_down: 'Database Down',
  unknown: 'Unknown Error',
};
