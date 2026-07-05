import axios from "axios";

const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — auth stub for future use
httpClient.interceptors.request.use(
  (config) => {
    // Future: attach auth token here
    // const token = localStorage.getItem('auth_token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — unwrap { success, data } envelope
httpClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && body.success !== undefined) {
      if (body.success) {
        // Return data + pagination if present
        if (body.pagination) {
          return { data: body.data, pagination: body.pagination };
        }
        return body.data;
      }
      // API returned success: false
      const error = new Error(body.message || "Request failed");
      error.status = response.status;
      throw error;
    }
    return body;
  },
  (error) => {
    if (error.response) {
      const msg = error.response.data?.message || error.message;
      const normalized = new Error(msg);
      normalized.status = error.response.status;
      normalized.data = error.response.data;
      return Promise.reject(normalized);
    }
    if (error.code === "ERR_NETWORK") {
      const offline = new Error("Network error — please check your connection");
      offline.status = 0;
      offline.isOffline = true;
      return Promise.reject(offline);
    }
    return Promise.reject(error);
  },
);

export default httpClient;
