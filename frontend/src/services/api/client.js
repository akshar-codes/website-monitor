import axios from "axios";
import { toast } from "sonner";

const SILENT_AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/me"];

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

    // Don't toast on 404s — let components handle empty states.
    if (status !== 404 && !isSilentAuthCall) {
      toast.error(message);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
