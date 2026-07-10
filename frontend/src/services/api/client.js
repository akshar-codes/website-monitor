import axios from "axios";
import { toast } from "sonner";

const apiClient = axios.create({
  baseURL: "/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor — normalize errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";

    // Don't toast on 404s — let components handle empty states
    if (error.response?.status !== 404) {
      toast.error(message);
    }

    return Promise.reject(error);
  },
);

export default apiClient;
