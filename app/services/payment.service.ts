import { apiService, type ApiResponse } from "@/app/utils/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface PayDishOrderParams {
  dishOrderId: string;
  paymentMethodId: string | null;
}

export interface PaySplitAmountParams {
  restaurantId: string;
  branchNumber: string;
  tableNumber: string;
  userId?: string | null;
  guestName?: string | null;
  paymentMethodId: string | null;
}

export interface PayTableAmountParams {
  restaurantId: string;
  branchNumber: string;
  tableNumber: string;
  amount: number;
  userId?: string | null;
  guestName?: string | null;
  paymentMethodId: string | null;
}

export interface RecordPaymentTransactionParams {
  payment_method_id: string | null;
  restaurant_id: number;
  id_table_order: string | null;
  id_tap_orders_and_pay: string | null;
  base_amount: number;
  tip_amount: number;
  iva_tip: number;
  even_commission_total: number;
  even_commission_client: number;
  even_commission_restaurant: number;
  iva_even_client: number;
  iva_even_restaurant: number;
  even_client_charge: number;
  even_restaurant_charge: number;
  even_rate_applied: number;
  total_amount_charged: number;
  subtotal_for_commission: number;
  currency: string;
  transaction_by?: string;
}

export interface CartItemForPayment {
  name: string;
  price: number;
  quantity: number;
  extraPrice?: number;
}

export interface MsiOption {
  months: number;
  rate: number;
  minAmount: number;
  fixedInstallments: boolean;
}

export interface MsiConfig {
  isActive: boolean;
  visaMc: MsiOption[];
  amex: MsiOption[];
}

export interface ProcessPaymentParams {
  paymentMethodId: string;
  amount: number;
  currency: string;
  description: string;
  orderId: string;
  tableNumber: string | undefined;
  restaurantId: string;
  installments?: number;
  baseAmount?: number;
  tipAmount?: number;
  items?: CartItemForPayment[];
}

async function makeRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<any>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("even_access_token")
      : null;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: {
        type: "API_ERROR",
        message: data.message || "Request failed",
        details: data,
      },
    };
  }

  return {
    success: true,
    data,
  };
}

// Servicio para manejar operaciones de pago
export const paymentService = {
  // Marca un platillo como pagado
  async payDishOrder(
    dishOrderId: string,
    paymentMethodId: string | null,
  ): Promise<void> {
    await apiService.payDishOrder(dishOrderId, paymentMethodId);
  },

  // Registra el pago de una división equitativa
  async paySplitAmount(
    params: PaySplitAmountParams,
  ): Promise<ApiResponse<any>> {
    const {
      restaurantId,
      branchNumber,
      tableNumber,
      userId,
      guestName,
      paymentMethodId,
    } = params;

    return makeRequest(
      `/restaurants/${restaurantId}/branches/${branchNumber}/tables/${tableNumber}/pay-split`,
      {
        method: "POST",
        body: JSON.stringify({
          userId: userId || null,
          guestName: guestName || null,
          paymentMethodId,
        }),
      },
    );
  },

  // Registra el pago de un monto específico de la mesa
  async payTableAmount(
    params: PayTableAmountParams,
  ): Promise<ApiResponse<any>> {
    const {
      restaurantId,
      branchNumber,
      tableNumber,
      amount,
      userId,
      guestName,
      paymentMethodId,
    } = params;

    return makeRequest(
      `/restaurants/${restaurantId}/branches/${branchNumber}/tables/${tableNumber}/pay`,
      {
        method: "POST",
        body: JSON.stringify({
          amount,
          userId: userId || null,
          guestName: guestName || null,
          paymentMethodId,
        }),
      },
    );
  },

  // Obtiene el estado de división de cuenta
  async getSplitPaymentStatus(
    restaurantId: string,
    branchNumber: string,
    tableNumber: string,
  ): Promise<ApiResponse<any>> {
    return makeRequest(
      `/restaurants/${restaurantId}/branches/${branchNumber}/tables/${tableNumber}/split-status`,
    );
  },

  // Inicializa división de cuenta
  async initializeSplitBill(
    restaurantId: string,
    branchNumber: string,
    tableNumber: string,
    numberOfPeople: number,
    userIds?: string[] | null,
    guestNames?: string[] | null,
  ): Promise<ApiResponse<any>> {
    return makeRequest(
      `/restaurants/${restaurantId}/branches/${branchNumber}/tables/${tableNumber}/split-bill`,
      {
        method: "POST",
        body: JSON.stringify({
          numberOfPeople,
          userIds,
          guestNames,
        }),
      },
    );
  },

  // Registra una transacción de pago en la base de datos
  async recordPaymentTransaction(
    params: RecordPaymentTransactionParams,
  ): Promise<void> {
    await apiService.recordPaymentTransaction(params);
  },

  // Obtiene los métodos de pago del usuario
  async getPaymentMethods() {
    return await apiService.getPaymentMethods();
  },

  // Procesa un pago con un método de pago específico
  async processPayment(params: ProcessPaymentParams) {
    return await apiService.processPayment(params);
  },

  // Paga múltiples platillos de un usuario
  async payUserDishes(
    dishOrders: any[],
    userName: string,
    paymentMethodId: string | null,
  ): Promise<void> {
    const userDishes = dishOrders.filter(
      (dish) =>
        dish.guest_name === userName &&
        (dish.payment_status === "not_paid" || !dish.payment_status),
    );

    for (const dish of userDishes) {
      try {
        await this.payDishOrder(dish.dish_order_id, paymentMethodId);
      } catch (error) {
        console.error(`Error paying dish ${dish.dish_order_id}:`, error);
        throw error;
      }
    }
  },

  // Paga platillos seleccionados específicamente
  async paySelectedDishes(
    selectedItems: string[],
    paymentMethodId: string | null,
  ): Promise<void> {
    for (const dishId of selectedItems) {
      try {
        await this.payDishOrder(dishId, paymentMethodId);
      } catch (error) {
        console.error(`Error paying selected dish ${dishId}:`, error);
        throw error;
      }
    }
  },

  // Crea una orden en Ecart Pay para Apple Pay y regresa el orderId
  async createApplePayOrder(params: {
    amount: number;
    currency: string;
    tableNumber?: string;
    restaurantId?: string;
    baseAmount?: number;
    tipAmount?: number;
    items?: CartItemForPayment[];
  }): Promise<ApiResponse<{ orderId: string }>> {
    return makeRequest("/payments/apple-pay/order", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  // Crea una orden en Ecart Pay para Google Pay y regresa el orderId
  async createGooglePayOrder(params: {
    amount: number;
    currency: string;
    tableNumber?: string;
    restaurantId?: string;
    baseAmount?: number;
    tipAmount?: number;
    items?: CartItemForPayment[];
  }): Promise<ApiResponse<{ orderId: string }>> {
    return makeRequest("/payments/google-pay/order", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  // Migra los métodos de pago de guest a usuario autenticado
  async migrateGuestPaymentMethods(
    guestId: string,
  ): Promise<ApiResponse<{ migratedCount: number }>> {
    return apiService.migrateGuestPaymentMethods(guestId);
  },

  async getMsiConfiguration(): Promise<ApiResponse<MsiConfig>> {
    return makeRequest("/payments/installment-config");
  },
};
