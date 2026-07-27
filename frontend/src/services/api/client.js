import axios from "axios";
import { toast } from "sonner";

const SILENT_AUTH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/me",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/forgot-password",
  "/auth/reset-password",
];

// Every code the backend's generalized ApiError.forbidden(...) /
// upgradeRequired(...) / featureRestricted(...) factories can attach to a
// 403 (see backend/src/utils/ApiError.js). Handled as a single family so
// role, permission, ownership, and plan-based denials all get the same
// consistent presentation instead of each call site inventing its own.
const ACCESS_DENIED_CODES = [
  "ROLE_FORBIDDEN",
  "PERMISSION_DENIED",
  "OWNERSHIP_REQUIRED",
  "UPGRADE_REQUIRED",
  "FEATURE_RESTRICTED",
];

const apiClient = axios.create({
  baseURL: "/api",
  timeout: 15000,
  withCredentials: true, // send the session cookie on every request
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor — normalize errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const url = error.config?.url || "";
    const isSilentAuthCall = SILENT_AUTH_PATHS.some((path) =>
      url.includes(path),
    );

    const message =
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";

    // A 401 on any other endpoint means the session expired mid-use —
    // notify the app so it can drop the cached user and redirect to /login.
    if (status === 401 && !isSilentAuthCall) {
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
    }

    // Every authorization-layer 403 (role, permission, ownership, plan
    // tier, or plan feature) is routed through one consistent handler —
    // see components/access/AccessErrorListener.jsx — instead of the
    // generic toast below, so upgrade-required errors can offer a "View
    // plans" action and every other denial gets the same tone.
    if (status === 403 && ACCESS_DENIED_CODES.includes(code)) {
      window.dispatchEvent(
        new CustomEvent("access:denied", { detail: { code, message } }),
      );
      return Promise.reject(error);
    }

    // Don't toast on 404s — let components handle empty states.
    if (status !== 404 && !isSilentAuthCall) {
      toast.error(message);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
