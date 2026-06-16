// ===============================================
// PREVIOUS IMPLEMENTATION (COMMENTED OUT)
// User-based orders system - replaced with dish-based system
// ===============================================

/*
// Configuración de la API
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// Tipos para las respuestas de la API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface TableInfo {
  id: string;
  table_number: number;
  status: "available" | "occupied" | "reserved" | "maintenance";
  created_at: string;
  updated_at: string;
}

export interface UserOrder {
  id: string;
  table_number: number;
  user_name: string;
  items: Array<{
    id: number;
    name: string;
    price: number;
    quantity: number;
    description?: string;
    images?: string[];
  }>;
  total_items: number;
  total_price: number;
  paid_amount?: number;
  remaining_amount?: number;
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "delivered"
    | "cancelled";
  payment_status: "unpaid" | "partial" | "paid";
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TableStats {
  total_orders: number;
  total_items: number;
  total_amount: number;
  status_breakdown: Record<string, number>;
}
*/

// ===============================================
// NEW IMPLEMENTATION - DISH-BASED SYSTEM
// ===============================================

// New types based on the backend service
export interface DishOrder {
  dish_order_id: string;
  item: string;
  quantity: number;
  price: number;
  total_price: number;
  status: "pending" | "preparing" | "ready" | "delivered";
  payment_status: "not_paid" | "paid";
  user_id?: string;
  guest_name: string;
  table_order_id: string;
  images: string[];
  custom_fields?: any;
  extra_price?: number;
}

export interface TableSummary {
  restaurant_id: number;
  table_number: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  no_items: number;
  status: "not_paid" | "partial" | "paid";
}

export interface ActiveUser {
  restaurant_id: number;
  table_number: number;
  user_id?: string;
  guest_name: string;
  total_paid_individual: number;
  total_paid_amount: number;
  total_paid_split: number;
  is_in_split: boolean;
  updated_at: string;
}

export interface SplitPayment {
  user_id?: string;
  guest_name: string;
  expected_amount: number;
  amount_paid: number;
  status: "pending" | "paid";
  remaining: number;
  paid_at?: string;
}

/*
class TableApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "API request failed");
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // Obtener información de una mesa
  async getTableInfo(tableNumber: number): Promise<ApiResponse<TableInfo>> {
    return this.request<TableInfo>(`/tables/${tableNumber}`);
  }

  // Obtener todas las órdenes de una mesa (solo pendientes)
  async getTableOrders(tableNumber: number): Promise<ApiResponse<UserOrder[]>> {
    return this.request<UserOrder[]>(`/tables/${tableNumber}/orders`);
  }

  // Obtener órdenes pagadas de una mesa
  async getPaidTableOrders(
    tableNumber: number
  ): Promise<ApiResponse<UserOrder[]>> {
    return this.request<UserOrder[]>(`/tables/${tableNumber}/paid-orders`);
  }

  // Verificar estado de la mesa
  async getTableStatus(tableNumber: number): Promise<
    ApiResponse<{
      tableClosed: boolean;
      pendingOrdersCount: number;
      message?: string;
    }>
  > {
    return this.request<{
      tableClosed: boolean;
      pendingOrdersCount: number;
      message?: string;
    }>(`/tables/${tableNumber}/status`);
  }

  // Crear una nueva orden de usuario
  async createUserOrder(
    tableNumber: number,
    orderData: {
      user_name: string;
      items: Array<{
        id: number;
        name: string;
        price: number;
        quantity: number;
        description?: string;
        images?: string[];
      }>;
      total_items: number;
      total_price: number;
    }
  ): Promise<ApiResponse<UserOrder>> {
    return this.request<UserOrder>(`/tables/${tableNumber}/orders`, {
      method: "POST",
      body: JSON.stringify(orderData),
    });
  }

  // Actualizar el estado de una orden
  async updateOrderStatus(
    orderId: string,
    status: UserOrder["status"]
  ): Promise<ApiResponse<UserOrder>> {
    return this.request<UserOrder>(`/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  // Obtener estadísticas de una mesa
  async getTableStats(tableNumber: number): Promise<ApiResponse<TableStats>> {
    return this.request<TableStats>(`/tables/${tableNumber}/stats`);
  }

  // Limpiar órdenes de una mesa
  async clearTableOrders(tableNumber: number): Promise<ApiResponse<null>> {
    return this.request<null>(`/tables/${tableNumber}/orders`, {
      method: "DELETE",
    });
  }

  // Polling para obtener órdenes actualizadas
  startPolling(
    tableNumber: number,
    callback: (orders: UserOrder[]) => void,
    intervalMs: number = 5000
  ): NodeJS.Timeout {
    const poll = async () => {
      const response = await this.getTableOrders(tableNumber);
      if (response.success && response.data) {
        callback(response.data);
      }
    };

    // Ejecutar inmediatamente
    poll();

    // Configurar polling
    return setInterval(poll, intervalMs);
  }

  // Detener polling
  stopPolling(intervalId: NodeJS.Timeout): void {
    clearInterval(intervalId);
  }

  // Marcar órdenes como pagadas
  async markOrdersAsPaid(
    tableNumber: number,
    orderIds?: string[]
  ): Promise<
    ApiResponse<{
      updatedOrders: UserOrder[];
      count: number;
      tableClosed?: boolean;
      closeMessage?: string;
    }>
  > {
    return this.request<{
      updatedOrders: UserOrder[];
      count: number;
      tableClosed?: boolean;
      closeMessage?: string;
    }>(`/tables/${tableNumber}/orders/mark-paid`, {
      method: "POST",
      body: JSON.stringify({ orderIds }),
    });
  }

  // Realizar pago parcial
  async addPartialPayment(
    orderId: string,
    amount: number,
    paymentMethod?: string
  ): Promise<
    ApiResponse<{
      success: boolean;
      payment_id?: string;
      order: UserOrder;
    }>
  > {
    return this.request<{
      success: boolean;
      payment_id?: string;
      order: UserOrder;
    }>(`/orders/${orderId}/payments`, {
      method: "POST",
      body: JSON.stringify({
        amount,
        payment_method: paymentMethod,
      }),
    });
  }

  // Obtener historial de pagos de una orden
  async getPaymentHistory(orderId: string): Promise<
    ApiResponse<{
      success: boolean;
      order: UserOrder;
      payments: Array<{
        id: string;
        payment_amount: number;
        payment_method?: string;
        payment_date: string;
      }>;
    }>
  > {
    return this.request<{
      success: boolean;
      order: UserOrder;
      payments: Array<{
        id: string;
        payment_amount: number;
        payment_method?: string;
        payment_date: string;
      }>;
    }>(`/orders/${orderId}/payment-history`);
  }
}

export const tableApi = new TableApiService();
*/

// ===============================================
// NEW TABLE API SERVICE - DISH-BASED SYSTEM
// ===============================================

// IMPORTANT: All table API functionality has been moved to utils/api.ts
// This file now only exports types for backward compatibility

// Re-export apiService as the new table API
import { apiService } from "../utils/api";

// Export the main API service
export { apiService as tableApi };

// Legacy compatibility - redirect old tableApi usage to new apiService
export const legacyTableApi = {
  // Deprecated: use apiService.getTableOrders(restaurantId, branchNumber, tableNumber) instead
  getTableOrders: (_tableNumber: number) => {
    throw new Error(
      "legacyTableApi.getTableOrders is deprecated. Use apiService.getTableOrders(restaurantId, branchNumber, tableNumber) instead."
    );
  },

  // Deprecated: use apiService.createDishOrder() instead
  createUserOrder: (tableNumber: number, orderData: any) =>
    console.warn(
      "createUserOrder is deprecated. Use submitOrder from TableContext instead."
    ),

  // Add other legacy methods as needed for backward compatibility
};
