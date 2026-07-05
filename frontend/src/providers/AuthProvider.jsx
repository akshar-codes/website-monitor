import { createContext, useContext } from "react";

const AuthContext = createContext(null);

/**
 * Auth stub provider — always authenticated in V0.
 * When real auth is added, only this file and the httpClient interceptor change.
 */
export function AuthProvider({ children }) {
  const value = {
    user: null,
    isAuthenticated: true,
    login: () => {},
    logout: () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;
