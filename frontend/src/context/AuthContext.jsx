import React, { createContext, useState, useEffect, useCallback } from 'react';
import { authApi, setAccessToken } from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const initAuth = useCallback(async () => {
    try {
      // First attempt to refresh token via HttpOnly cookie
      const refreshResponse = await authApi.refresh();
      if (refreshResponse?.data?.accessToken) {
        setAccessToken(refreshResponse.data.accessToken);
        setUser(refreshResponse.data.user);
      }
    } catch (err) {
      // User is not authenticated or refresh token expired
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();

    const handleSessionExpired = () => {
      setUser(null);
      setAccessToken(null);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, [initAuth]);

  const login = async (email, password) => {
    setError(null);
    try {
      const response = await authApi.login({ email, password });
      const { user: loggedInUser, accessToken } = response.data;
      setAccessToken(accessToken);
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (name, email, password) => {
    setError(null);
    try {
      const response = await authApi.register({ name, email, password });
      const { user: registeredUser, accessToken } = response.data;
      setAccessToken(accessToken);
      setUser(registeredUser);
      return registeredUser;
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Registration failed. Please check inputs.';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout error:', err.message);
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
