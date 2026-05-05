"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { apiService, PaymentMethod } from "../utils/api";
import { useGuest } from "./GuestContext";
import { useAuth } from "./AuthContext";
import { authService } from "../services/auth.service";
import { paymentService } from "../services/payment.service";

interface PaymentContextType {
  paymentMethods: PaymentMethod[];
  isLoading: boolean;
  hasPaymentMethods: boolean;
  addPaymentMethod: (paymentMethod: PaymentMethod) => void;
  refreshPaymentMethods: () => Promise<void>;
  removePaymentMethod: (paymentMethodId: string) => void;
  setDefaultPaymentMethod: (paymentMethodId: string) => Promise<void>;
  deletePaymentMethod: (paymentMethodId: string) => Promise<void>;
  migrateGuestPaymentMethods: () => Promise<void>;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

interface PaymentProviderProps {
  children: ReactNode;
}

export function PaymentProvider({ children }: PaymentProviderProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { isGuest, guestId, setAsAuthenticated } = useGuest();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const hasPaymentMethods = paymentMethods.length > 0;

  const refreshPaymentMethods = async () => {
    // For registered users - prioritize user over guest session
    if (isAuthenticated && user) {
      console.log("🔐 Fetching payment methods for registered user:", user.id);

      // Get current user with token from authService
      const currentUser = authService.getCurrentUser();
      const userToken = currentUser?.token;

      console.log("🔑 User token available:", !!userToken);

      // Wait for token to be available
      if (!userToken) {
        console.log(
          "⏳ Token not yet available, skipping payment methods request",
        );
        setPaymentMethods([]);
        return;
      }

      setIsLoading(true);
      try {
        apiService.setAuthToken(userToken);

        const response = await apiService.getPaymentMethods();
        if (response.success) {
          let methods: PaymentMethod[] = [];
          if ((response as any).paymentMethods) {
            methods = (response as any).paymentMethods;
          } else if (response.data?.paymentMethods) {
            methods = response.data.paymentMethods;
          } else if (Array.isArray(response.data)) {
            methods = response.data;
          }
          setPaymentMethods(methods);
          console.log(
            "💳 Loaded payment methods for registered user:",
            methods.length,
          );
        } else {
          setPaymentMethods([]);
          console.log("💳 No payment methods found for registered user");
        }
      } catch (error) {
        console.error(
          "❌ Error fetching payment methods for registered user:",
          error,
        );
        setPaymentMethods([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // For guests, ensure we have a guest ID
    if (isGuest && guestId) {
      console.log("👥 Fetching payment methods for guest:", guestId);
      setIsLoading(true);
      try {
        const response = await apiService.getPaymentMethods();
        if (response.success) {
          let methods: PaymentMethod[] = [];
          if ((response as any).paymentMethods) {
            methods = (response as any).paymentMethods;
          } else if (response.data?.paymentMethods) {
            methods = response.data.paymentMethods;
          } else if (Array.isArray(response.data)) {
            methods = response.data;
          }
          setPaymentMethods(methods);
          console.log("💳 Loaded payment methods for guest:", methods.length);
        } else {
          setPaymentMethods([]);
          console.log("💳 No payment methods found for guest");
        }
      } catch (error) {
        console.error("❌ Error fetching payment methods for guest:", error);
        setPaymentMethods([]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // No valid authentication context
    console.log("⚠️ No valid authentication context for payment methods");
    setPaymentMethods([]);
  };

  const addPaymentMethod = (paymentMethod: PaymentMethod) => {
    setPaymentMethods((prev) => [...prev, paymentMethod]);
  };

  const removePaymentMethod = (paymentMethodId: string) => {
    setPaymentMethods((prev) => prev.filter((pm) => pm.id !== paymentMethodId));
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    // Only registered users can set default payment methods
    if (!user) {
      console.log(
        "⚠️ setDefaultPaymentMethod: Only registered users can set default payment methods",
      );
      throw new Error("Only registered users can set default payment methods");
    }

    console.log(
      "🔧 Setting default payment method for registered user:",
      paymentMethodId,
    );
    try {
      // Get Supabase auth token
      const currentUser = await authService.getCurrentUser();
      if (currentUser?.token) {
        apiService.setAuthToken(currentUser.token);
      }

      const response =
        await apiService.setDefaultPaymentMethod(paymentMethodId);
      if (response.success) {
        // Update local state to reflect the new default
        setPaymentMethods((prev) =>
          prev.map((pm) => ({
            ...pm,
            isDefault: pm.id === paymentMethodId,
          })),
        );
        console.log(
          "✅ Default payment method set successfully:",
          paymentMethodId,
        );
      } else {
        throw new Error(
          response.error?.message || "Failed to set default payment method",
        );
      }
    } catch (error) {
      console.error("❌ Error setting default payment method:", error);
      throw error;
    }
  };

  const deletePaymentMethod = async (paymentMethodId: string) => {
    if (!user && !isGuest) {
      throw new Error("No active session");
    }

    console.log(
      `🗑️ Deleting payment method for ${isGuest ? "guest" : "registered user"}:`,
      paymentMethodId,
    );

    // Optimistic update: remove immediately, restore on failure
    const deletedMethod = paymentMethods.find(
      (pm) => pm.id === paymentMethodId,
    );
    removePaymentMethod(paymentMethodId);

    try {
      if (isGuest && guestId) {
        apiService.setGuestInfo(guestId);
      } else {
        const currentUser = await authService.getCurrentUser();
        if (currentUser?.token) {
          apiService.setAuthToken(currentUser.token);
        }
      }

      const response = await apiService.deletePaymentMethod(paymentMethodId);
      if (!response.success) {
        throw new Error(
          response.error?.message || "Failed to delete payment method",
        );
      }
      console.log("✅ Payment method deleted successfully:", paymentMethodId);
    } catch (error) {
      console.error("❌ Error deleting payment method:", error);
      if (deletedMethod) addPaymentMethod(deletedMethod);
      throw error;
    }
  };

  const migrateGuestPaymentMethods = async () => {
    const guestIdInStorage = localStorage.getItem("xquisito-guest-id");

    if (!user || !guestIdInStorage) {
      console.log("⚠️ Cannot migrate: missing user or guest-id");
      return;
    }

    console.log("🔄 Starting payment methods migration from guest to user", {
      guestId: guestIdInStorage,
      userId: user.id,
    });

    try {
      // Get Supabase auth token
      const currentUser = await authService.getCurrentUser();
      if (currentUser?.token) {
        apiService.setAuthToken(currentUser.token);
      }

      const response =
        await paymentService.migrateGuestPaymentMethods(guestIdInStorage);

      if (response.success) {
        console.log(
          "✅ Payment methods migrated successfully:",
          response.data?.migratedCount || 0,
          "methods",
        );

        // Refresh payment methods to show migrated ones
        await refreshPaymentMethods();

        // IMPORTANT: Only delete guest-id after ALL migrations complete
        // This includes: guest orders linking (done in GuestContext) + payment methods migration
        console.log(
          "🗑️ All migrations completed - removing guest ID from localStorage",
        );
        localStorage.removeItem("xquisito-guest-id");
        console.log("✅ Guest ID successfully removed");
      } else {
        console.error("❌ Payment methods migration failed:", response.error);
      }
    } catch (error) {
      console.error("❌ Error migrating payment methods:", error);
    }
  };

  // Load payment methods when user context changes
  useEffect(() => {
    if (authLoading) return;

    // If user is authenticated, clear any guest session
    if (isAuthenticated && user && isGuest) {
      console.log("🔐 User authenticated - clearing guest session");
      setAsAuthenticated(user.id);
    }

    console.log("🔄 PaymentContext - Context changed:", {
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      isGuest,
      guestId,
    });

    refreshPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authLoading,
    isAuthenticated,
    user?.id,
    isGuest,
    guestId,
    setAsAuthenticated,
  ]);

  // Auto-migrate guest payment methods after guest orders are linked (GuestContext dispatches this event)
  useEffect(() => {
    if (!user) return;
    const handleGuestOrdersLinked = async () => {
      const guestIdInStorage = localStorage.getItem("xquisito-guest-id");
      if (guestIdInStorage) {
        await migrateGuestPaymentMethods();
      }
    };
    window.addEventListener("xquisito:guestOrdersLinked", handleGuestOrdersLinked);
    return () => {
      window.removeEventListener("xquisito:guestOrdersLinked", handleGuestOrdersLinked);
    };
  }, [user?.id]);

  const value: PaymentContextType = {
    paymentMethods,
    isLoading,
    hasPaymentMethods,
    addPaymentMethod,
    refreshPaymentMethods,
    removePaymentMethod,
    setDefaultPaymentMethod,
    deletePaymentMethod,
    migrateGuestPaymentMethods,
  };

  return (
    <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>
  );
}

// Custom hook to use payment context
export function usePayment(): PaymentContextType {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error("usePayment must be used within a PaymentProvider");
  }
  return context;
}

// Helper hook to check if user has payment methods
export function useHasPaymentMethods(): boolean {
  const { hasPaymentMethods } = usePayment();
  return hasPaymentMethods;
}
