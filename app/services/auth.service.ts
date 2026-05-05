import { apiService } from "../utils/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface SendOTPResponse {
  success: boolean;
  message: string;
  data: {
    phone: string;
    messageId?: string;
  };
  error?: string;
}

interface VerifyOTPResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      phone: string;
      accountType: string;
    };
    profile: any;
    session: {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };
  };
  error?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: {
      id: string;
      phone?: string;
      email?: string;
      accountType: string;
    };
    profile?: any;
    session: {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };
  };
  error?: string;
}

export interface ProfileData {
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: "male" | "female" | "other";
  photoUrl?: string;
}

class AuthService {
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  private subscribeTokenRefresh(callback: (token: string) => void): void {
    this.refreshSubscribers.push(callback);
  }

  private onRefreshed(token: string): void {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  async handleTokenRefresh(): Promise<string | null> {
    try {
      const result = await this.refreshToken();
      if (result.success && result.data?.session?.access_token) {
        return result.data.session.access_token;
      } else if (result.error === "Error al refrescar el token") {
        console.warn("⚠️ Network error during token refresh, keeping session");
        return null;
      } else {
        await this.logout();
        if (typeof window !== "undefined") {
          window.location.href = "/";
        }
        return null;
      }
    } catch (error) {
      console.error("❌ Unexpected error in handleTokenRefresh:", error);
      return null;
    }
  }

  // Enviar código OTP al teléfono
  async sendPhoneOTP(phone: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/customer/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error sending OTP:", error);
      return {
        success: false,
        error: "Error al enviar el código OTP",
      };
    }
  }

  // Verificar código OTP y hacer login
  async verifyPhoneOTP(phone: string, token: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/customer/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, token }),
      });

      const data = await response.json();

      // Guardar token en localStorage
      if (data.success && data.data?.session?.access_token) {
        localStorage.setItem(
          "xquisito_access_token",
          data.data.session.access_token,
        );
        localStorage.setItem(
          "xquisito_refresh_token",
          data.data.session.refresh_token,
        );
        if (data.data.session.expires_at) {
          localStorage.setItem(
            "xquisito_expires_at",
            data.data.session.expires_at.toString(),
          );
        }
        localStorage.setItem("xquisito_user", JSON.stringify(data.data.user));
      }

      return data;
    } catch (error) {
      console.error("Error verifying OTP:", error);
      return {
        success: false,
        error: "Error al verificar el código OTP",
      };
    }
  }

  // Crear o actualizar perfil del usuario
  async createOrUpdateProfile(profileData: ProfileData): Promise<AuthResponse> {
    try {
      const token = localStorage.getItem("xquisito_access_token");

      if (!token) {
        return {
          success: false,
          error: "No estás autenticado",
        };
      }

      // Use apiService which has automatic token refresh
      const response = await apiService.request("/profiles", {
        method: "POST",
        body: JSON.stringify(profileData),
      });

      if (response.success) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        return {
          success: false,
          error:
            response.error?.message || "Error al crear/actualizar el perfil",
        };
      }
    } catch (error) {
      console.error("Error creating/updating profile:", error);
      return {
        success: false,
        error: "Error al crear/actualizar el perfil",
      };
    }
  }

  // Obtener perfil del usuario autenticado
  async getMyProfile(): Promise<AuthResponse> {
    try {
      const token = localStorage.getItem("xquisito_access_token");

      if (!token) {
        return {
          success: false,
          error: "No estás autenticado",
        };
      }

      // Use apiService which has automatic token refresh
      const response = await apiService.request("/profiles/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.success) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        return {
          success: false,
          error: response.error?.message || "Error al obtener el perfil",
        };
      }
    } catch (error) {
      console.error("Error getting profile:", error);
      return {
        success: false,
        error: "Error al obtener el perfil",
      };
    }
  }

  // Actualizar perfil del usuario autenticado
  async updateMyProfile(updates: Partial<ProfileData>): Promise<AuthResponse> {
    try {
      const token = localStorage.getItem("xquisito_access_token");

      if (!token) {
        return {
          success: false,
          error: "No estás autenticado",
        };
      }

      // Use apiService which has automatic token refresh
      const response = await apiService.request("/profiles/me", {
        method: "PUT",
        body: JSON.stringify(updates),
      });

      if (response.success) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        return {
          success: false,
          error: response.error?.message || "Error al actualizar el perfil",
        };
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      return {
        success: false,
        error: "Error al actualizar el perfil",
      };
    }
  }

  // Refrescar el access token (thread-safe: solo se ejecuta una vez en paralelo)
  async refreshToken(): Promise<AuthResponse> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.subscribeTokenRefresh((token: string) => {
          if (token) {
            resolve({
              success: true,
              data: {
                user: { id: "", accountType: "" },
                session: {
                  access_token: token,
                  refresh_token:
                    localStorage.getItem("xquisito_refresh_token") || "",
                  expires_at: parseInt(
                    localStorage.getItem("xquisito_expires_at") || "0",
                  ),
                },
              },
            });
          } else {
            resolve({ success: false, error: "Token refresh failed" });
          }
        });
      });
    }

    this.isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem("xquisito_refresh_token");

      if (!refreshToken) {
        this.isRefreshing = false;
        return {
          success: false,
          error: "No hay refresh token",
        };
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();

      if (data.success && data.data?.session?.access_token) {
        localStorage.setItem(
          "xquisito_access_token",
          data.data.session.access_token,
        );
        localStorage.setItem(
          "xquisito_refresh_token",
          data.data.session.refresh_token,
        );
        if (data.data.session.expires_at) {
          localStorage.setItem(
            "xquisito_expires_at",
            data.data.session.expires_at.toString(),
          );
        }
        this.onRefreshed(data.data.session.access_token);
      } else {
        this.onRefreshed("");
      }

      this.isRefreshing = false;
      return data;
    } catch (error) {
      console.error("Error refreshing token:", error);
      this.isRefreshing = false;
      this.onRefreshed("");
      return {
        success: false,
        error: "Error al refrescar el token",
      };
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      const token = localStorage.getItem("xquisito_access_token");

      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      // Limpiar localStorage
      localStorage.removeItem("xquisito_access_token");
      localStorage.removeItem("xquisito_refresh_token");
      localStorage.removeItem("xquisito_expires_at");
      localStorage.removeItem("xquisito_user");
    } catch (error) {
      console.error("Error logging out:", error);
      // Limpiar localStorage de todos modos
      localStorage.removeItem("xquisito_access_token");
      localStorage.removeItem("xquisito_refresh_token");
      localStorage.removeItem("xquisito_expires_at");
      localStorage.removeItem("xquisito_user");
    }
  }

  // Obtener usuario actual del localStorage
  getCurrentUser(): any | null {
    const userStr = localStorage.getItem("xquisito_user");
    const accessToken = localStorage.getItem("xquisito_access_token");

    if (userStr) {
      const user = JSON.parse(userStr);
      return {
        ...user,
        token: accessToken, // Include token for ApiService
      };
    }

    return null;
  }

  // Store session data in localStorage
  storeSession(session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  }): void {
    localStorage.setItem("xquisito_access_token", session.access_token);
    localStorage.setItem("xquisito_refresh_token", session.refresh_token);
    localStorage.setItem("xquisito_expires_at", session.expires_at.toString());
  }

  // Get access token from localStorage
  getAccessToken(): string | null {
    return localStorage.getItem("xquisito_access_token");
  }

  // Get refresh token from localStorage
  getRefreshToken(): string | null {
    return localStorage.getItem("xquisito_refresh_token");
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const expiresAt = localStorage.getItem("xquisito_expires_at");

    if (!token || !expiresAt) {
      return false;
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    const expiration = parseInt(expiresAt);

    return now < expiration;
  }

  // Clear session data
  clearSession(): void {
    localStorage.removeItem("xquisito_access_token");
    localStorage.removeItem("xquisito_refresh_token");
    localStorage.removeItem("xquisito_expires_at");
  }
}

export const authService = new AuthService();
