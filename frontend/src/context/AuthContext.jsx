import { createContext, useCallback, useEffect, useState } from "react";
import * as authApi from "../services/api/auth";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const { data } = await authApi.getMe();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for an existing session on first load.
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Dropped by the axios interceptor when any authenticated request comes
  // back 401 mid-session (expired/revoked cookie) — clear the cached user
  // so ProtectedRoute redirects to /login.
  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("auth:session-expired", handleSessionExpired);
  }, []);

  const login = useCallback(async (email, password, rememberMe = false) => {
    const { data } = await authApi.login({ email, password, rememberMe });
    setUser(data);
    return data;
  }, []);

  /**
   * BREAKING CHANGE: registration no longer establishes a session — the
   * backend creates the account in an unverified state and does not log
   * it in. This intentionally does NOT call setUser(); the caller (the
   * Register page) is responsible for showing a "check your inbox" state
   * rather than treating the response as an authenticated user.
   */
  const register = useCallback(
    async (name, email, password, rememberMe = true) => {
      const { data } = await authApi.register({
        name,
        email,
        password,
        confirmPassword: password,
        rememberMe,
      });
      return data;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  // Ends every session for this account, including the current device —
  // used by the "sign out everywhere" action in Sidebar.
  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      setUser(null);
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    logoutAll,
    refetchUser: fetchCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
