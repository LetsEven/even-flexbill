"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { MenuItemData } from "../interfaces/menuItemData";
import { ApiResponse } from "../utils/api";
import { tableService } from "../services/table.service";
import type {
  DishOrder,
  TableSummary,
  ActiveUser,
} from "../services/table.service";
import { SplitPayment } from "../services/tableApi";

// Tipo para respuestas con estructura anidada { data: { data: T } }
interface NestedDataResponse<T> {
  data: T;
}
import { useAuth } from "./AuthContext";
import { useRestaurant } from "./RestaurantContext";
import { paymentService } from "../services/payment.service";
import { useTableRealtime } from "../hooks/useTableRealtime";

// Interfaz para un item del carrito (mantiene la misma funcionalidad)
export interface CartItem extends MenuItemData {
  quantity: number;
  customFields?: {
    fieldId: string;
    fieldName: string;
    selectedOptions: Array<{
      optionId: string;
      optionName: string;
      price: number;
    }>;
  }[];
  extraPrice?: number;
}

// Nuevo estado de la mesa basado en platillos
interface TableState {
  tableNumber: string;
  tableSummary: ApiResponse<NestedDataResponse<TableSummary>> | null;
  dishOrders: DishOrder[];
  activeUsers: ActiveUser[];
  splitPayments: SplitPayment[];
  currentUserName: string;
  currentUserItems: CartItem[];
  currentUserTotalItems: number;
  currentUserTotalPrice: number;
  isLoading: boolean;
  error: string | null;
  isSplitBillActive: boolean;
}

// Nuevas acciones para el sistema de platillos
type TableAction =
  | { type: "SET_TABLE_NUMBER"; payload: string }
  | { type: "ADD_ITEM_TO_CURRENT_USER"; payload: MenuItemData }
  | { type: "REMOVE_ITEM_FROM_CURRENT_USER"; payload: number }
  | {
      type: "UPDATE_QUANTITY_CURRENT_USER";
      payload: {
        id: number;
        quantity: number;
        customFields?: CartItem["customFields"];
      };
    }
  | { type: "SET_CURRENT_USER_NAME"; payload: string }
  | { type: "CLEAR_CURRENT_USER_CART" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | {
      type: "SET_TABLE_SUMMARY";
      payload: ApiResponse<NestedDataResponse<TableSummary>> | null;
    }
  | { type: "SET_DISH_ORDERS"; payload: DishOrder[] }
  | { type: "SET_ACTIVE_USERS"; payload: ActiveUser[] }
  | { type: "SET_SPLIT_PAYMENTS"; payload: SplitPayment[] }
  | { type: "SET_SPLIT_BILL_ACTIVE"; payload: boolean }
  | {
      type: "UPDATE_DISH_STATUS";
      payload: { dishId: string; status: DishOrder["status"] };
    }
  | {
      type: "UPDATE_DISH_PAYMENT_STATUS";
      payload: { dishId: string; paymentStatus: DishOrder["payment_status"] };
    };

// Nuevo estado inicial
const initialState: TableState = {
  tableNumber: "",
  tableSummary: null,
  dishOrders: [],
  activeUsers: [],
  splitPayments: [],
  currentUserName: "",
  currentUserItems: [],
  currentUserTotalItems: 0,
  currentUserTotalPrice: 0,
  isLoading: false,
  error: null,
  isSplitBillActive: false,
};

// Función para calcular totales (incluye extraPrice)
const calculateTotals = (items: CartItem[]) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + (item.price + (item.extraPrice || 0)) * item.quantity,
    0,
  );
  return { totalItems, totalPrice };
};

// Nuevo reducer para el sistema de platillos
function tableReducer(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case "SET_TABLE_NUMBER":
      return {
        ...state,
        tableNumber: action.payload,
      };

    // Mantener la funcionalidad del carrito (con comparación de custom fields)
    case "ADD_ITEM_TO_CURRENT_USER": {
      // Función helper para comparar custom fields
      const areCustomFieldsEqual = (
        cf1?: CartItem["customFields"],
        cf2?: CartItem["customFields"],
      ) => {
        if (!cf1 && !cf2) return true;
        if (!cf1 || !cf2) return false;
        if (cf1.length !== cf2.length) return false;

        return cf1.every((field1, index) => {
          const field2 = cf2[index];
          if (field1.fieldId !== field2.fieldId) return false;
          if (field1.selectedOptions.length !== field2.selectedOptions.length)
            return false;

          return field1.selectedOptions.every((opt1, idx) => {
            const opt2 = field2.selectedOptions[idx];
            return opt1.optionId === opt2.optionId;
          });
        });
      };

      const existingItem = state.currentUserItems.find(
        (item) =>
          item.id === action.payload.id &&
          areCustomFieldsEqual(item.customFields, action.payload.customFields),
      );

      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.currentUserItems.map((item) =>
          item.id === action.payload.id &&
          areCustomFieldsEqual(item.customFields, action.payload.customFields)
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      } else {
        newItems = [
          ...state.currentUserItems,
          { ...action.payload, quantity: 1 },
        ];
      }

      const { totalItems, totalPrice } = calculateTotals(newItems);

      return {
        ...state,
        currentUserItems: newItems,
        currentUserTotalItems: totalItems,
        currentUserTotalPrice: totalPrice,
      };
    }

    case "REMOVE_ITEM_FROM_CURRENT_USER": {
      const newItems = state.currentUserItems.filter(
        (item) => item.id !== action.payload,
      );
      const { totalItems, totalPrice } = calculateTotals(newItems);

      return {
        ...state,
        currentUserItems: newItems,
        currentUserTotalItems: totalItems,
        currentUserTotalPrice: totalPrice,
      };
    }

    case "UPDATE_QUANTITY_CURRENT_USER": {
      // Función helper para comparar custom fields (reutilizada)
      const areCustomFieldsEqual = (
        cf1?: CartItem["customFields"],
        cf2?: CartItem["customFields"],
      ) => {
        if (!cf1 && !cf2) return true;
        if (!cf1 || !cf2) return false;
        if (cf1.length !== cf2.length) return false;

        return cf1.every((field1, index) => {
          const field2 = cf2[index];
          if (field1.fieldId !== field2.fieldId) return false;
          if (field1.selectedOptions.length !== field2.selectedOptions.length)
            return false;

          return field1.selectedOptions.every((opt1, idx) => {
            const opt2 = field2.selectedOptions[idx];
            return opt1.optionId === opt2.optionId;
          });
        });
      };

      const newItems = state.currentUserItems
        .map((item) =>
          item.id === action.payload.id &&
          areCustomFieldsEqual(item.customFields, action.payload.customFields)
            ? { ...item, quantity: action.payload.quantity }
            : item,
        )
        .filter((item) => item.quantity > 0);

      const { totalItems, totalPrice } = calculateTotals(newItems);

      return {
        ...state,
        currentUserItems: newItems,
        currentUserTotalItems: totalItems,
        currentUserTotalPrice: totalPrice,
      };
    }

    case "SET_CURRENT_USER_NAME":
      return {
        ...state,
        currentUserName: action.payload,
      };

    case "CLEAR_CURRENT_USER_CART":
      return {
        ...state,
        currentUserItems: [],
        currentUserTotalItems: 0,
        currentUserTotalPrice: 0,
      };

    // Nuevas acciones para el sistema de platillos
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case "SET_TABLE_SUMMARY":
      return {
        ...state,
        tableSummary: action.payload,
        isLoading: false,
        error: null,
      };

    case "SET_DISH_ORDERS":
      return {
        ...state,
        dishOrders: Array.isArray(action.payload) ? action.payload : [],
        isLoading: false,
        error: null,
      };

    case "SET_ACTIVE_USERS":
      return {
        ...state,
        activeUsers: Array.isArray(action.payload) ? action.payload : [],
      };

    case "SET_SPLIT_PAYMENTS":
      return {
        ...state,
        splitPayments: Array.isArray(action.payload) ? action.payload : [],
      };

    case "SET_SPLIT_BILL_ACTIVE":
      return {
        ...state,
        isSplitBillActive: action.payload,
      };

    case "UPDATE_DISH_STATUS": {
      const updatedOrders = state.dishOrders.map((order) =>
        order.dish_order_id === action.payload.dishId
          ? { ...order, status: action.payload.status }
          : order,
      );
      return {
        ...state,
        dishOrders: updatedOrders,
      };
    }

    case "UPDATE_DISH_PAYMENT_STATUS": {
      const updatedOrders = state.dishOrders.map((order) =>
        order.dish_order_id === action.payload.dishId
          ? { ...order, payment_status: action.payload.paymentStatus }
          : order,
      );
      return {
        ...state,
        dishOrders: updatedOrders,
      };
    }

    default:
      return state;
  }
}

// Nuevo contexto de la mesa
const TableContext = createContext<{
  state: TableState;
  dispatch: React.Dispatch<TableAction>;
  // Funciones del carrito (mantiene funcionalidad existente)
  submitOrder: (
    userName?: string,
    cartItems?: CartItem[],
    branchNumber?: string,
    orderNotes?: string | null,
  ) => Promise<void>;
  // Nuevas funciones para el sistema de platillos
  loadTableData: () => Promise<void>;
  loadTableSummary: () => Promise<void>;
  loadDishOrders: () => Promise<void>;
  loadActiveUsers: () => Promise<void>;
  loadSplitPayments: () => Promise<void>;
  // Funciones de pago
  payDishOrder: (
    dishId: string,
    paymentMethodId?: string | null,
  ) => Promise<void>;
  payTableAmount: (
    amount: number,
    userId?: string,
    guestName?: string,
  ) => Promise<void>;
  // Funciones de división de cuenta
  initializeSplitBill: (
    numberOfPeople: number,
    userIds?: string[],
    guestNames?: string[],
  ) => Promise<void>;
  paySplitAmount: (userId?: string, guestName?: string) => Promise<void>;
  recalculateSplitBill: () => Promise<void>;
  // Función para actualizar estado de platillo (cocina)
  updateDishStatus: (
    dishId: string,
    status: DishOrder["status"],
  ) => Promise<void>;
} | null>(null);

// Nuevo Provider del contexto de mesa
export function TableProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tableReducer, initialState);
  const { user, profile, isLoading } = useAuth();
  const { restaurantId, branchNumber } = useRestaurant();

  // Ref para evitar cargas duplicadas
  const lastLoadedTable = React.useRef<string | null>(null);
  const isLoadingRef = React.useRef(false);

  // Cargar resumen de la mesa (definido primero para usar en otros callbacks)
  const loadTableSummary = useCallback(async () => {
    if (!state.tableNumber || !restaurantId || !branchNumber) return;

    try {
      const response = await tableService.getTableSummary(
        restaurantId.toString(),
        branchNumber.toString(),
        state.tableNumber,
      );

      if (response.success && response.data) {
        dispatch({ type: "SET_TABLE_SUMMARY", payload: response });
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: response.error?.message || "Failed to load table summary",
        });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error occurred" });
    }
  }, [state.tableNumber, restaurantId, branchNumber]);

  // Cargar órdenes de platillos
  const loadDishOrders = useCallback(async () => {
    if (!state.tableNumber || !restaurantId || !branchNumber) return;

    try {
      const response = await tableService.getTableOrders(
        restaurantId.toString(),
        branchNumber.toString(),
        state.tableNumber,
      );

      if (response.success && Array.isArray(response?.data?.data)) {
        const dishOrders = response.data.data;
        dispatch({ type: "SET_DISH_ORDERS", payload: dishOrders });
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: response.error?.message || "Failed to load dish orders",
        });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error occurred" });
    }
  }, [state.tableNumber, restaurantId, branchNumber]);

  // Cargar usuarios activos
  const loadActiveUsers = useCallback(async () => {
    if (!state.tableNumber || !restaurantId || !branchNumber) return;

    try {
      const response = await tableService.getActiveUsers(
        restaurantId.toString(),
        branchNumber.toString(),
        state.tableNumber,
      );

      if (response.success && response.data) {
        dispatch({ type: "SET_ACTIVE_USERS", payload: response.data });
      }
    } catch (error) {
      console.error("Error loading active users:", error);
    }
  }, [state.tableNumber, restaurantId, branchNumber]);

  // Cargar pagos divididos
  const loadSplitPayments = useCallback(async () => {
    if (!state.tableNumber || !restaurantId || !branchNumber) return;

    try {
      const response = await paymentService.getSplitPaymentStatus(
        restaurantId.toString(),
        branchNumber.toString(),
        state.tableNumber,
      );

      if (response.success && response.data) {
        const splitPayments = response.data.split_payments || [];
        dispatch({ type: "SET_SPLIT_PAYMENTS", payload: splitPayments });
        dispatch({
          type: "SET_SPLIT_BILL_ACTIVE",
          payload: splitPayments.length > 0,
        });
      }
    } catch (error) {
      console.error("Error loading split payments:", error);
    }
  }, [state.tableNumber, restaurantId, branchNumber]);

  // Cargar todos los datos de la mesa
  const loadTableData = useCallback(async () => {
    if (!state.tableNumber) return;

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      await Promise.all([
        loadTableSummary(),
        loadDishOrders(),
        loadActiveUsers(),
        loadSplitPayments(),
      ]);
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Error loading table data" });
    }
  }, [
    state.tableNumber,
    loadTableSummary,
    loadDishOrders,
    loadActiveUsers,
    loadSplitPayments,
  ]);

  // Cargar todos los datos cuando se establece el número de mesa
  useEffect(() => {
    // Evitar cargas duplicadas
    if (
      state.tableNumber &&
      state.tableNumber !== lastLoadedTable.current &&
      !isLoadingRef.current
    ) {
      lastLoadedTable.current = state.tableNumber;
      isLoadingRef.current = true;

      loadTableData().finally(() => {
        isLoadingRef.current = false;
      });
    }
  }, [state.tableNumber, loadTableData]);

  // Callbacks para eventos de socket en tiempo real
  const handleDishCreated = useCallback(
    (dish: DishOrder) => {
      dispatch({
        type: "SET_DISH_ORDERS",
        payload: [...state.dishOrders, dish],
      });
    },
    [state.dishOrders],
  );

  const handleDishStatusChanged = useCallback(
    (dishId: string, status: DishOrder["status"]) => {
      dispatch({ type: "UPDATE_DISH_STATUS", payload: { dishId, status } });
    },
    [],
  );

  const handleDishPaid = useCallback((dishId: string) => {
    dispatch({
      type: "UPDATE_DISH_PAYMENT_STATUS",
      payload: { dishId, paymentStatus: "paid" },
    });
  }, []);

  const handleSummaryUpdate = useCallback(() => {
    loadTableSummary();
  }, [loadTableSummary]);

  const handleUserJoined = useCallback(
    (user: ActiveUser) => {
      // Validar que user no sea undefined
      if (!user) {
        console.warn("⚠️ handleUserJoined received undefined user, ignoring");
        return;
      }
      dispatch({
        type: "SET_ACTIVE_USERS",
        payload: [...state.activeUsers, user],
      });
    },
    [state.activeUsers],
  );

  const handleUserLeft = useCallback(
    (userId: string) => {
      const updatedUsers = state.activeUsers.filter(
        (u) => u && u.user_id !== userId && u.guest_name !== userId,
      );
      dispatch({ type: "SET_ACTIVE_USERS", payload: updatedUsers });
    },
    [state.activeUsers],
  );

  const handleSplitUpdate = useCallback((splitPayments: SplitPayment[]) => {
    dispatch({ type: "SET_SPLIT_PAYMENTS", payload: splitPayments });
  }, []);

  const handleFullRefresh = useCallback(() => {
    loadTableData();
  }, [loadTableData]);

  // Hook de socket para tiempo real
  // Nota: onUserJoined deshabilitado - usuarios solo aparecen cuando ordenan (desde DB)
  const { isSocketConnected } = useTableRealtime({
    tableNumber: state.tableNumber || null,
    enabled: !!state.tableNumber,
    onDishCreated: handleDishCreated,
    onDishStatusChanged: handleDishStatusChanged,
    onDishPaid: handleDishPaid,
    onSummaryUpdate: handleSummaryUpdate,
    // onUserJoined: handleUserJoined, // Deshabilitado: solo mostrar usuarios que han ordenado
    onUserLeft: handleUserLeft,
    onSplitUpdate: handleSplitUpdate,
    onFullRefresh: handleFullRefresh,
  });

  // Función para enviar orden (adaptada al nuevo sistema)
  // Función helper para recalcular el split bill automáticamente
  const recalculateSplitBill = async () => {
    if (!state.tableNumber || !restaurantId || !branchNumber) return;

    try {
      // Verificar si hay un split status activo
      const splitResponse = await paymentService.getSplitPaymentStatus(
        restaurantId.toString(),
        branchNumber.toString(),
        state.tableNumber,
      );

      if (splitResponse.success && splitResponse.data?.data) {
        // Hay split activo, obtener active users actualizados
        const activeUsersResponse = await tableService.getActiveUsers(
          restaurantId.toString(),
          branchNumber.toString(),
          state.tableNumber,
        );

        if (activeUsersResponse.success && activeUsersResponse.data?.data) {
          const activeUsers = activeUsersResponse.data.data;

          const formattedUsers = activeUsers.map((user: any) => ({
            userId: user.user_id ?? null, // si no tiene user_id, queda null
            guestName: user.guest_name ?? null,
          }));

          const userIds = formattedUsers.map((u: any) => u.userId);
          const guestNames = formattedUsers.map((u: any) => u.guestName);

          const totalUsers = formattedUsers.length;

          if (totalUsers > 0) {
            // Recalcular split bill con los active users (tanto autenticados como invitados)
            await initializeSplitBill(
              totalUsers,
              userIds.length > 0 ? userIds : undefined,
              guestNames.length > 0 ? guestNames : undefined,
            );

            // Recargar tableSummary después del recálculo
            await loadTableSummary();
          }
        }
      } else {
        // No hay split activo, intentar inicializar si hay múltiples active users
        const activeUsersResponse = await tableService.getActiveUsers(
          restaurantId.toString(),
          branchNumber.toString(),
          state.tableNumber,
        );

        if (activeUsersResponse.success && activeUsersResponse.data?.data) {
          const activeUsers = activeUsersResponse.data.data;

          const formattedUsers = activeUsers.map((user: any) => ({
            userId: user.user_id ?? null, // si no tiene user_id, queda null
            guestName: user.guest_name ?? null,
          }));

          const userIds = formattedUsers.map((u: any) => u.userId);
          const guestNames = formattedUsers.map((u: any) => u.guestName);

          const totalUsers = formattedUsers.length;

          if (totalUsers > 1) {
            await initializeSplitBill(
              totalUsers,
              userIds.length > 0 ? userIds : undefined,
              guestNames.length > 0 ? guestNames : undefined,
            );

            // Recargar tableSummary después de la inicialización
            await loadTableSummary();
          }
        }
      }
    } catch (error) {
      console.error("Error recalculating split bill:", error);
    }
  };

  const submitOrder = async (
    userName?: string,
    cartItems?: CartItem[],
    branchNumberParam?: string,
    orderNotes?: string | null,
  ) => {
    const finalUserName = userName || state.currentUserName;
    // Usar cartItems pasados como parámetro, o fallback a state.currentUserItems (legacy)
    const itemsToOrder = cartItems || state.currentUserItems;
    // Usar branchNumber pasado como parámetro, o fallback al del contexto
    const finalBranchNumber =
      branchNumberParam || branchNumber?.toString() || "1";

    if (!state.tableNumber || !finalUserName || itemsToOrder.length === 0) {
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Esperar a que auth termine de cargar
      if (isLoading) {
        dispatch({ type: "SET_LOADING", payload: false });
        throw new Error("Por favor espera mientras verificamos tu sesión");
      }

      // Determinar si el usuario está autenticado
      const isAuthenticated = !!user;
      const userId = isAuthenticated ? user.id : null;

      // Solo usar guestId si NO está autenticado
      const guestId =
        !isAuthenticated && typeof window !== "undefined"
          ? localStorage.getItem("even-guest-id")
          : null;

      // Si está autenticado pero el perfil no ha cargado, esperar
      if (isAuthenticated && !profile?.firstName) {
        dispatch({ type: "SET_LOADING", payload: false });
        throw new Error("Por favor espera mientras cargamos tu perfil");
      }

      // Usar nombre real del perfil si está autenticado, sino el proporcionado
      // IMPORTANTE: Si está autenticado, SIEMPRE usar el nombre del perfil
      const displayName = isAuthenticated
        ? profile?.firstName && profile?.lastName
          ? `${profile.firstName} ${profile.lastName}`
          : profile!.firstName!
        : finalUserName;

      // Guardar nombre para vinculación posterior (solo si no está autenticado)
      if (!isAuthenticated && typeof window !== "undefined") {
        localStorage.setItem("even-guest-name", finalUserName);
      }

      // Crear órdenes de platillos con la cantidad correcta
      for (const item of itemsToOrder) {
        const response = await tableService.createDishOrder(
          restaurantId?.toString() || "1", // restaurantId del contexto
          finalBranchNumber, // branchNumber del contexto o parámetro
          state.tableNumber,
          userId, // userId de Clerk si está autenticado, null si es invitado
          displayName, // Nombre real o guest name
          item.name, // item
          item.quantity, // quantity real del carrito
          item.price, // price
          guestId, // guestId solo si es invitado
          item.images,
          item.customFields, // custom fields seleccionados
          item.extraPrice, // precio extra por custom fields
          item.id, // menu_item_id
          orderNotes, // notas de la orden
          item.specialInstructions || null, // instrucciones especiales del platillo
        );

        if (!response.success) {
          console.error("❌ Error creando orden:", response.error);
          throw new Error(
            response.error?.message || "Failed to create dish order",
          );
        }
      }

      // Actualizar el nombre del usuario en el estado si se pasó como parámetro
      if (userName) {
        dispatch({ type: "SET_CURRENT_USER_NAME", payload: finalUserName });
      }

      // Limpiar carrito actual (legacy)
      dispatch({ type: "CLEAR_CURRENT_USER_CART" });

      // Recargar datos de la mesa
      await loadTableData();

      // Recalcular split bill automáticamente
      await recalculateSplitBill();
    } catch (error) {
      console.error("❌ submitOrder - Error:", error);
      dispatch({
        type: "SET_ERROR",
        payload:
          error instanceof Error ? error.message : "Network error occurred",
      });
      throw error; // Re-throw para que los componentes puedan manejarlo
    }
  };

  // Nuevas funciones de pago
  const payDishOrder = async (
    dishId: string,
    paymentMethodId?: string | null,
  ) => {
    if (!state.tableNumber) return;

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      await paymentService.payDishOrder(dishId, paymentMethodId || null);

      // Actualizar el estado del platillo localmente
      dispatch({
        type: "UPDATE_DISH_PAYMENT_STATUS",
        payload: { dishId, paymentStatus: "paid" },
      });

      // Recargar datos de la mesa
      await loadTableData();

      // Recalcular split bill después del pago
      await recalculateSplitBill();
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error occurred" });
    }
  };

  const payTableAmount = async (
    amount: number,
    userId?: string,
    guestName?: string,
  ) => {
    if (!state.tableNumber || !branchNumber) return;

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Si no se proporciona userId o guestName, usar el usuario actual
      let finalUserId = userId;
      let finalGuestName = guestName;

      if (!finalUserId && !finalGuestName) {
        // Determinar si el usuario está autenticado
        const isAuthenticated = !isLoading && user;

        if (isAuthenticated) {
          finalUserId = user.id;
          finalGuestName =
            profile?.firstName && profile?.lastName
              ? `${profile.firstName} ${profile.lastName}`
              : profile?.firstName || state.currentUserName;
        } else {
          // Usuario invitado
          finalGuestName = state.currentUserName;
        }
      }

      const response = await paymentService.payTableAmount({
        restaurantId: restaurantId?.toString() || "1",
        branchNumber: branchNumber.toString(),
        tableNumber: state.tableNumber,
        amount,
        userId: finalUserId,
        guestName: finalGuestName,
        paymentMethodId: null,
      });

      if (response.success) {
        // Recargar datos de la mesa
        await loadTableData();

        // Recalcular split bill después del pago
        await recalculateSplitBill();
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: response.error?.message || "Failed to pay table amount",
        });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error occurred" });
    }
  };

  // Funciones de división de cuenta
  const initializeSplitBill = async (
    numberOfPeople: number,
    userIds?: string[],
    guestNames?: string[],
  ) => {
    if (!state.tableNumber) return;

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Si no se proporcionan userIds o guestNames, obtenerlos de activeUsers
      let finalUserIds = userIds;
      let finalGuestNames = guestNames;

      if (!userIds && !guestNames) {
        // Obtener active users de la mesa
        const activeUsersResponse = await tableService.getActiveUsers(
          restaurantId?.toString() || "1",
          branchNumber?.toString() || "1",
          state.tableNumber,
        );

        if (activeUsersResponse.success && activeUsersResponse.data?.data) {
          const activeUsers = activeUsersResponse.data;

          // Separar usuarios autenticados (con user_id) de invitados (con guest_name)
          finalUserIds = activeUsers
            .filter((user: any) => user.user_id)
            .map((user: any) => user.user_id);

          finalGuestNames = activeUsers
            .filter((user: any) => !user.user_id && user.guest_name)
            .map((user: any) => user.guest_name);
        }
      }

      const response = await paymentService.initializeSplitBill(
        restaurantId?.toString() || "1",
        branchNumber?.toString() || "1",
        state.tableNumber,
        numberOfPeople,
        finalUserIds,
        finalGuestNames,
      );

      if (response.success) {
        dispatch({ type: "SET_SPLIT_BILL_ACTIVE", payload: true });
        // Recargar datos de la mesa
        await loadTableData();
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: response.error?.message || "Failed to initialize split bill",
        });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error occurred" });
    }
  };

  const paySplitAmount = async (userId?: string, guestName?: string) => {
    if (!state.tableNumber || !branchNumber) return;

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const response = await paymentService.paySplitAmount({
        restaurantId: restaurantId?.toString() || "1",
        branchNumber: branchNumber.toString(),
        tableNumber: state.tableNumber,
        userId,
        guestName,
        paymentMethodId: null,
      });

      if (response.success) {
        // Recargar datos de la mesa incluyendo split payments
        await loadTableData();
        await loadSplitPayments();
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: response.error?.message || "Failed to pay split amount",
        });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error occurred" });
    }
  };

  // Función para actualizar estado de platillo (cocina)
  const updateDishStatus = async (
    dishId: string,
    status: DishOrder["status"],
  ) => {
    try {
      const response = await tableService.updateDishStatus(dishId, status);

      if (response.success) {
        // Actualizar el estado del platillo localmente
        dispatch({
          type: "UPDATE_DISH_STATUS",
          payload: { dishId, status },
        });
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: response.error?.message || "Failed to update dish status",
        });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error occurred" });
    }
  };

  return (
    <TableContext.Provider
      value={{
        state,
        dispatch,
        // Funciones del carrito (mantiene funcionalidad existente)
        submitOrder,
        // Nuevas funciones para el sistema de platillos
        loadTableData,
        loadTableSummary,
        loadDishOrders,
        loadActiveUsers,
        loadSplitPayments,
        // Funciones de pago
        payDishOrder,
        payTableAmount,
        // Funciones de división de cuenta
        initializeSplitBill,
        paySplitAmount,
        recalculateSplitBill,
        // Función para actualizar estado de platillo (cocina)
        updateDishStatus,
      }}
    >
      {children}
    </TableContext.Provider>
  );
}

// Hook personalizado para usar el contexto de mesa
export function useTable() {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error("useTable must be used within a TableProvider");
  }
  return context;
}
