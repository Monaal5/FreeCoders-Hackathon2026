import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { apiClient } from '../api/client';
import { TOKEN_KEY, getStoredToken, userFromToken } from '../utils/authToken';

const AuthContext = createContext(null);

const saveToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('sunpower_user'); // old separate role copy – no longer used
  } catch {
    /* storage blocked: session lasts until reload */
  }
};

export function AuthProvider({ children }) {
  // Only the token is stored. Who the user is – and their ROLE – is read from inside it.
  const [token, setToken] = useState(() => {
    const t = getStoredToken();
    if (t && !userFromToken(t)) {
      saveToken(null); // expired or malformed token from an earlier visit
      return null;
    }
    return t;
  });
  const user = useMemo(() => userFromToken(token), [token]);
  const [loading, setLoading] = useState(false);

  const logout = useCallback(() => {
    saveToken(null);
    setToken(null);
  }, []);

  // Sign out automatically the moment the token expires.
  useEffect(() => {
    if (!user?.expiresAt) return undefined;
    const ms = user.expiresAt - Date.now();
    if (ms <= 0) {
      logout();
      return undefined;
    }
    const id = setTimeout(logout, Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, [user?.expiresAt, logout]);

  // Reopened app (Live mode): ask the server whether the token is still valid and the role unchanged.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiClient
      .get('/api/auth/me')
      .then((res) => {
        const serverRole = res?.data?.role?.toUpperCase();
        if (!cancelled && serverRole && serverRole !== user?.role) logout(); // role changed since login
      })
      .catch(() => {
        /* 401 is handled by the API client (clears the token, goes to /login) */
      });
    return () => {
      cancelled = true;
    };
    // run once per token, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/login', { email, password });
      const authToken = res?.data?.token;
      const authUser = userFromToken(authToken);
      if (res.success && authUser) {
        saveToken(authToken);
        setToken(authToken);
        return { success: true, user: authUser };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Login failed';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (...roles) => !!user && roles.map((r) => r.toUpperCase()).includes(user.role);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        hasRole,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
