"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  authService,
  type AuthResponse,
  type ProfileData,
} from "../services/auth.service";
import { apiService } from "../utils/api";

interface User {
  id: string;
  phone?: string;
  email?: string;
  accountType: string;
}

interface Profile {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: string;
  photoUrl?: string;
  userContext?: string;
  accountType: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sendOTP: (phone: string) => Promise<AuthResponse>;
  verifyOTP: (phone: string, token: string) => Promise<AuthResponse>;
  createOrUpdateProfile: (profileData: ProfileData) => Promise<AuthResponse>;
  updateProfile: (updates: Partial<ProfileData>) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar usuario del localStorage al montar
  useEffect(() => {
    const loadUser = async () => {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        // Set auth token in ApiService first
        if (currentUser.token) {
          apiService.setAuthToken(currentUser.token);
        }

        // Verificar si el token está por expirar o ya expiró
        const expiresAt = localStorage.getItem("xquisito_expires_at");
        if (expiresAt) {
          const now = Math.floor(Date.now() / 1000);
          const expiration = parseInt(expiresAt);
          const timeUntilExpiry = expiration - now;

          // Si ya expiró o expira en menos de 5 minutos, refrescar ahora
          if (timeUntilExpiry < 300) {
            try {
              const refreshResponse = await authService.refreshToken();
              if (refreshResponse.success && refreshResponse.data?.session) {
                const newToken = refreshResponse.data.session.access_token;
                apiService.setAuthToken(newToken);
                setUser(currentUser);
                await loadProfileWithValidation();
              } else {
                // Refresh falló - solo cerrar sesión si el token ya expiró
                if (timeUntilExpiry <= 0) {
                  await performLogout();
                } else {
                  setUser(currentUser);
                  await loadProfileWithValidation();
                }
              }
            } catch (error) {
              if (timeUntilExpiry > 0) {
                setUser(currentUser);
                await loadProfileWithValidation();
              } else {
                await performLogout();
              }
            }
            setIsLoading(false);
            return;
          }
        }

        // Token válido - establecer usuario y cargar perfil
        setUser(currentUser);

        // Cargar perfil - no cerrar sesión si falla (puede ser error de red o usuario nuevo)
        await loadProfileWithValidation();
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

  // Refresh token periódicamente mientras el usuario está autenticado
  useEffect(() => {
    if (!user) return;

    // Refrescar cada 50 minutos (el token expira en 1 hora por defecto)
    const REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutos en ms

    const refreshTokenPeriodically = async () => {
      try {
        const refreshResponse = await authService.refreshToken();
        if (refreshResponse.success && refreshResponse.data?.session) {
          const newToken = refreshResponse.data.session.access_token;
          apiService.setAuthToken(newToken);
        }
      } catch (error) {
        console.error("❌ Error in periodic refresh:", error);
      }
    };

    const intervalId = setInterval(refreshTokenPeriodically, REFRESH_INTERVAL);

    // También refrescar cuando la app vuelve a estar visible
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const expiresAt = localStorage.getItem("xquisito_expires_at");
        if (expiresAt) {
          const now = Math.floor(Date.now() / 1000);
          const expiration = parseInt(expiresAt);
          const timeUntilExpiry = expiration - now;

          // Si ya expiró o expira en menos de 10 minutos, refrescar
          if (timeUntilExpiry < 600) {
            try {
              const refreshResponse = await authService.refreshToken();
              if (refreshResponse.success && refreshResponse.data?.session) {
                const newToken = refreshResponse.data.session.access_token;
                apiService.setAuthToken(newToken);
              } else {
                // Refresh falló - solo cerrar sesión si el token ya expiró
                const nowCheck = Math.floor(Date.now() / 1000);
                if (parseInt(expiresAt) <= nowCheck) {
                  await performLogout();
                }
              }
            } catch (error) {
              console.error("❌ Network error refreshing on visibility change:", error);
            }
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  // Función interna para hacer logout sin async issues
  const performLogout = async () => {
    await authService.logout();
    apiService.clearAuthToken();
    apiService.clearAllSessionData();
    setUser(null);
    setProfile(null);
  };

  const loadProfile = async () => {
    try {
      const response = await authService.getMyProfile();

      if (response.success && response.data) {
        const responseData = (response as any).data;
        const profileData =
          responseData?.data?.profile || responseData?.profile;

        if (profileData) {
          setProfile(profileData);
        }
      }
    } catch (error) {
      console.error("❌ Error loading profile:", error);
    }
  };

  const loadProfileWithValidation = async (): Promise<boolean> => {
    try {
      const response = await authService.getMyProfile();

      if (response.success && response.data) {
        const responseData = (response as any).data;
        const profileData =
          responseData?.data?.profile || responseData?.profile;

        if (profileData) {
          setProfile(profileData);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Error loading profile:", error);
      return false;
    }
  };

  const sendOTP = async (phone: string): Promise<AuthResponse> => {
    const response = await authService.sendPhoneOTP(phone);
    return response;
  };

  const verifyOTP = async (
    phone: string,
    token: string,
  ): Promise<AuthResponse> => {
    const response = await authService.verifyPhoneOTP(phone, token);

    if (response.success && response.data) {
      // Add token to user object for context consistency
      const userWithToken = {
        ...response.data.user,
        token: response.data.session.access_token,
      };

      setUser(userWithToken);
      if (response.data.profile) {
        setProfile(response.data.profile);
      }

      apiService.setAuthToken(response.data.session.access_token);
    }

    return response;
  };

  const createOrUpdateProfile = async (
    profileData: ProfileData,
  ): Promise<AuthResponse> => {
    const response = await authService.createOrUpdateProfile(profileData);

    if (response.success && response.data?.profile) {
      setProfile(response.data.profile);
    }

    return response;
  };

  const updateProfile = async (
    updates: Partial<ProfileData>,
  ): Promise<AuthResponse> => {
    const response = await authService.updateMyProfile(updates);

    if (response.success && response.data?.profile) {
      setProfile(response.data.profile);
    }

    return response;
  };

  const logout = async () => {
    await authService.logout();
    apiService.clearAuthToken();
    apiService.clearAllSessionData();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const value = {
    user,
    profile,
    isAuthenticated: !!user,
    isLoading,
    sendOTP,
    verifyOTP,
    createOrUpdateProfile,
    updateProfile,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error(
      "useSupabaseAuth must be used within a SupabaseAuthProvider",
    );
  }
  return context;
}
