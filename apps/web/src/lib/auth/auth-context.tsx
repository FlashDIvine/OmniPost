'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { apiClient } from '../api/client';
import {
  AuthContextType,
  AuthResponse,
  AuthUser,
  LoginCredentials,
  RefreshResponse,
  RegisterCredentials,
} from './types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Attempts silent session refresh using the httpOnly refreshToken cookie.
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const refreshRes = await apiClient.post<RefreshResponse>('/auth/refresh');
      const newToken = refreshRes.data.accessToken;

      if (!newToken) {
        throw new Error('No access token returned from refresh');
      }

      apiClient.setAccessToken(newToken);
      setAccessToken(newToken);

      // Fetch user profile
      const meRes = await apiClient.get<AuthUser>('/auth/me', {
        token: newToken,
      });
      setUser(meRes.data);
      setError(null);
      return true;
    } catch {
      apiClient.setAccessToken(null);
      setAccessToken(null);
      setUser(null);
      return false;
    }
  }, []);

  /**
   * Authenticates user with username & password.
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<AuthResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<AuthResponse>(
          '/auth/login',
          credentials,
        );
        const { user: authUser, accessToken: token } = response.data;

        apiClient.setAccessToken(token);
        setAccessToken(token);
        setUser(authUser);
        return response.data;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Login failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  /**
   * Registers a new user account.
   */
  const register = useCallback(
    async (credentials: RegisterCredentials): Promise<AuthResponse> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<AuthResponse>(
          '/auth/register',
          credentials,
        );
        const { user: authUser, accessToken: token } = response.data;

        apiClient.setAccessToken(token);
        setAccessToken(token);
        setUser(authUser);
        return response.data;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Registration failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  /**
   * Logs out user, revokes refresh token on backend, and resets client state.
   */
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Continue cleanup even if server request fails
    } finally {
      apiClient.setAccessToken(null);
      setAccessToken(null);
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  // Initial session recovery on app mount
  useEffect(() => {
    let mounted = true;
    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        await refreshSession();
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [refreshSession]);

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated: Boolean(user && accessToken),
    isLoading,
    error,
    login,
    register,
    logout,
    refreshSession,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
