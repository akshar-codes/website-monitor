export const ROUTES = Object.freeze({
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_EMAIL: "/verify-email",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  OAUTH_CALLBACK: "/oauth/callback",
  UNAUTHORIZED: "/unauthorized",
  UPGRADE_REQUIRED: "/upgrade-required",
  DASHBOARD: "/",
  MONITORS: "/monitors",
  MONITOR_DETAILS: "/monitors/:id",
  INSIGHTS: "/insights",
  BILLING: "/billing",
  ACTIVITY: "/activity",
  PROFILE: "/profile",
  PREFERENCES: "/preferences",
  NOTIFICATIONS: "/notifications",
  ADMIN_USERS: "/admin/users",
  ADMIN_PLAN_REQUESTS: "/admin/plan-requests",
});

export const monitorDetailsPath = (monitorId) => `/monitors/${monitorId}`;
