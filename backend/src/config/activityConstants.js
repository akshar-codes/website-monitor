export const ACTIVITY_CATEGORIES = Object.freeze({
  AUTH: "auth",
  MONITOR: "monitor",
  INCIDENT: "incident",
  PROFILE: "profile",
  PLAN: "plan",
  ADMIN: "admin",
  PREFERENCES: "preferences",
  SESSION: "session",
});

export const ACTIVITY_CATEGORY_VALUES = Object.freeze(
  Object.values(ACTIVITY_CATEGORIES),
);

export const ACTIVITY_ACTIONS = Object.freeze({
  // ── Auth ──
  LOGIN: "login",
  LOGOUT: "logout",
  LOGOUT_ALL: "logout_all",
  LOGOUT_OTHERS: "logout_others",
  REGISTER: "register",
  EMAIL_VERIFIED: "email_verified",
  PASSWORD_RESET_COMPLETED: "password_reset_completed",
  PASSWORD_CHANGED: "password_changed",

  // ── Session ──
  SESSION_REVOKED: "session_revoked",

  // ── Monitor ──
  MONITOR_CREATED: "monitor_created",
  MONITOR_UPDATED: "monitor_updated",
  MONITOR_PAUSED: "monitor_paused",
  MONITOR_RESUMED: "monitor_resumed",
  MONITOR_DELETED: "monitor_deleted",

  // ── Incident ──
  INCIDENT_STATUS_UPDATED: "incident_status_updated",

  // ── Profile ──
  PROFILE_UPDATED: "profile_updated",
  AVATAR_UPLOADED: "avatar_uploaded",
  AVATAR_REMOVED: "avatar_removed",

  // ── Plan (self-service) ──
  PLAN_UPGRADED: "plan_upgraded",
  PLAN_DOWNGRADED: "plan_downgraded",
  PLAN_UPGRADE_REQUESTED: "plan_upgrade_requested",
  PLAN_UPGRADE_REQUEST_APPROVED: "plan_upgrade_request_approved",
  PLAN_UPGRADE_REQUEST_REJECTED: "plan_upgrade_request_rejected",

  // ── Preferences ──
  PREFERENCES_UPDATED: "preferences_updated",
  DASHBOARD_PREFERENCES_UPDATED: "dashboard_preferences_updated",
  PREFERENCES_RESET: "preferences_reset",

  // ── Admin (recorded on the ACTING admin's own activity log) ──
  ADMIN_USER_ROLE_CHANGED: "admin_user_role_changed",
  ADMIN_USER_PLAN_CHANGED: "admin_user_plan_changed",
  ADMIN_USER_SUSPENDED: "admin_user_suspended",
  ADMIN_USER_REACTIVATED: "admin_user_reactivated",
  ADMIN_USER_DELETED: "admin_user_deleted",
  ADMIN_PLAN_UPGRADE_REQUEST_APPROVED: "admin_plan_upgrade_request_approved",
  ADMIN_PLAN_UPGRADE_REQUEST_REJECTED: "admin_plan_upgrade_request_rejected",
  ADMIN_MONITOR_CHECK_TRIGGERED: "admin_monitor_check_triggered",
  ADMIN_INCIDENT_RESOLVED: "admin_incident_resolved",
  ADMIN_ACTION_FAILED: "admin_action_failed",
});

export const ACTIVITY_ACTION_VALUES = Object.freeze(
  Object.values(ACTIVITY_ACTIONS),
);
