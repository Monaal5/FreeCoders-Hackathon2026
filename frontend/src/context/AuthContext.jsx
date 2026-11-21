import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient, setMockMode, isMockMode, mockDb } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('sunpower_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('sunpower_token'));
  const [useMock, setUseMockState] = useState(isMockMode());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleModeChange = () => {
      setUseMockState(isMockMode());
    };
    window.addEventListener('sunpower_mode_changed', handleModeChange);
    return () => window.removeEventListener('sunpower_mode_changed', handleModeChange);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/login', { email, password });
      if (res.success && res.data) {
        const { token: authToken, user: authUser } = res.data;
        setUser(authUser);
        setToken(authToken);
        localStorage.setItem('sunpower_token', authToken);
        localStorage.setItem('sunpower_user', JSON.stringify(authUser));
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

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('sunpower_token');
    localStorage.removeItem('sunpower_user');
  };

  const toggleMockMode = () => {
    const next = !useMock;
    setMockMode(next);
    setUseMockState(next);
  };

  const resetMockData = () => {
    mockDb.reset();
    window.location.reload();
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    return roles.map(r => r.toUpperCase()).includes(user.role?.toUpperCase());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        useMock,
        isAuthenticated: !!user && !!token,
        hasRole,
        login,
        logout,
        toggleMockMode,
        resetMockData,
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
