"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSocketContext } from "../context/SocketContext";
import type {
  DishOrder,
  TableSummary,
  ActiveUser,
} from "../services/table.service";
import type { SplitPayment } from "../services/tableApi";

// Payloads de eventos del servidor
interface DishCreatedPayload {
  dish: DishOrder;
  timestamp: string;
}

interface DishStatusPayload {
  dishId: string;
  status: DishOrder["status"];
  timestamp: string;
}

interface DishPaidPayload {
  dishId: string;
  paidBy: string;
  timestamp: string;
}

interface TableSummaryPayload {
  summary: TableSummary;
  timestamp: string;
}

interface UserJoinedPayload {
  userId?: string;
  guestId?: string;
  guestName?: string;
  tableNumber?: string;
}

interface UserLeftPayload {
  userId?: string;
  guestId?: string;
  tableNumber?: string;
}

interface SplitUpdatePayload {
  splitPayments: SplitPayment[];
  timestamp: string;
}

interface UseTableRealtimeOptions {
  tableNumber: string | null;
  enabled?: boolean;
  onDishCreated?: (dish: DishOrder) => void;
  onDishStatusChanged?: (dishId: string, status: DishOrder["status"]) => void;
  onDishPaid?: (dishId: string, paidBy: string) => void;
  onSummaryUpdate?: (summary: TableSummary) => void;
  onUserJoined?: (user: ActiveUser) => void;
  onUserLeft?: (userId: string) => void;
  onSplitUpdate?: (splitPayments: SplitPayment[]) => void;
  onFullRefresh?: () => void;
}

export function useTableRealtime(options: UseTableRealtimeOptions) {
  const {
    tableNumber,
    enabled = true,
    onDishCreated,
    onDishStatusChanged,
    onDishPaid,
    onSummaryUpdate,
    onUserJoined,
    onUserLeft,
    onSplitUpdate,
    onFullRefresh,
  } = options;

  const { socket, isConnected, joinTable, leaveTable } = useSocketContext();
  const previousTableNumber = useRef<string | null>(null);

  // Unirse/abandonar sala de mesa
  useEffect(() => {
    if (!enabled || !isConnected || !tableNumber) return;

    // Si cambio el numero de mesa, abandonar la anterior
    if (
      previousTableNumber.current &&
      previousTableNumber.current !== tableNumber
    ) {
      leaveTable(previousTableNumber.current);
    }

    // Unirse a la nueva mesa
    joinTable(tableNumber);
    previousTableNumber.current = tableNumber;

    return () => {
      if (tableNumber) {
        leaveTable(tableNumber);
      }
    };
  }, [enabled, isConnected, tableNumber, joinTable, leaveTable]);

  // Escuchar eventos del socket
  useEffect(() => {
    if (!socket || !enabled) return;

    const handleDishCreated = (data: DishCreatedPayload) => {
      onDishCreated?.(data.dish);
    };

    const handleDishStatus = (data: DishStatusPayload) => {
      onDishStatusChanged?.(data.dishId, data.status);
    };

    const handleDishPaid = (data: DishPaidPayload) => {
      onDishPaid?.(data.dishId, data.paidBy);
    };

    const handleSummaryUpdate = (data: TableSummaryPayload) => {
      onSummaryUpdate?.(data.summary);
    };

    const handleUserJoined = (data: UserJoinedPayload) => {
      // Transformar el payload del servidor al formato ActiveUser
      const user: ActiveUser = {
        restaurant_id: 0, // Se actualizará con datos reales del contexto
        branch_number: 0,
        table_number: parseInt(data.tableNumber || "0"),
        user_id: data.userId || data.guestId,
        guest_name: data.guestName || "Invitado",
        total_paid_individual: 0,
        total_paid_amount: 0,
        total_paid_split: 0,
        is_in_split: false,
        updated_at: new Date().toISOString(),
      };
      onUserJoined?.(user);
    };

    const handleUserLeft = (data: UserLeftPayload) => {
      const userId = data.userId || data.guestId || "";
      onUserLeft?.(userId);
    };

    const handleSplitUpdate = (data: SplitUpdatePayload) => {
      onSplitUpdate?.(data.splitPayments);
    };

    const handleFullRefresh = () => {
      onFullRefresh?.();
    };

    // Registrar listeners
    socket.on("table:dish-created", handleDishCreated);
    socket.on("table:dish-status", handleDishStatus);
    socket.on("table:dish-paid", handleDishPaid);
    socket.on("table:summary-update", handleSummaryUpdate);
    socket.on("table:user-joined", handleUserJoined);
    socket.on("table:user-left", handleUserLeft);
    socket.on("table:split-update", handleSplitUpdate);
    socket.on("table:full-refresh", handleFullRefresh);

    return () => {
      // Limpiar listeners
      socket.off("table:dish-created", handleDishCreated);
      socket.off("table:dish-status", handleDishStatus);
      socket.off("table:dish-paid", handleDishPaid);
      socket.off("table:summary-update", handleSummaryUpdate);
      socket.off("table:user-joined", handleUserJoined);
      socket.off("table:user-left", handleUserLeft);
      socket.off("table:split-update", handleSplitUpdate);
      socket.off("table:full-refresh", handleFullRefresh);
    };
  }, [
    socket,
    enabled,
    onDishCreated,
    onDishStatusChanged,
    onDishPaid,
    onSummaryUpdate,
    onUserJoined,
    onUserLeft,
    onSplitUpdate,
    onFullRefresh,
  ]);

  return {
    isSocketConnected: isConnected,
  };
}
