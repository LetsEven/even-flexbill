"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@/app/context/TableContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { getRestaurantData } from "@/app/utils/restaurantData";
import { getSavedUrlParams, clearSavedUrlParams } from "@/app/utils/urlParams";
import MenuHeaderBack from "@/app/components/headers/MenuHeaderBack";
import { paymentService } from "@/app/services/payment.service";
import { ChevronRight, DollarSign, ReceiptText } from "lucide-react";
import { useValidateAccess } from "@/app/hooks/useValidateAccess";
import ValidationError from "@/app/components/ValidationError";

export default function PaymentOptionsPage() {
  const { validationError, restaurantId, branchNumber } = useValidateAccess();
  const searchParams = useSearchParams();

  const { state, dispatch, loadTableData, loadActiveUsers } = useTable();
  const { navigateWithTable } = useTableNavigation();

  // Establecer tableNumber desde URL si no está en el estado
  useEffect(() => {
    const tableFromUrl = searchParams?.get("table");
    if (tableFromUrl && !state.tableNumber) {
      dispatch({ type: "SET_TABLE_NUMBER", payload: tableFromUrl });
    }
  }, [searchParams, state.tableNumber, dispatch]);
  const router = useRouter();
  const restaurantData = getRestaurantData();
  const [isLoading, setIsLoading] = useState(true);
  const [splitStatus, setSplitStatus] = useState<any>(null);

  const loadSplitStatus = async () => {
    if (!state.tableNumber || !branchNumber) return;

    try {
      const response = await paymentService.getSplitPaymentStatus(
        restaurantId.toString(),
        branchNumber.toString(),
        state.tableNumber.toString(),
      );

      if (response.success) {
        setSplitStatus(response.data.data);
      } else {
        setSplitStatus(null);
      }
    } catch (error) {
      console.error("Error loading split status:", error);
      setSplitStatus(null);
    }
  };

  useEffect(() => {
    const savedParams = getSavedUrlParams();
    if (savedParams) {
      router.replace(`/payment-options${savedParams}`);
      clearSavedUrlParams();
    }
  }, [router]);

  useEffect(() => {
    const loadPaymentData = async () => {
      if (state.tableNumber) {
        // Si no hay datos cargados o están desactualizados, cargar
        if (
          !state.dishOrders ||
          state.dishOrders.length === 0 ||
          !state.tableSummary
        ) {
          setIsLoading(true);
          await loadTableData();
          await loadActiveUsers();
          await loadSplitStatus();
          setIsLoading(false);
        } else {
          // Ya hay datos, recargar activeUsers y split status (pueden haber cambiado por pagos)

          await loadActiveUsers();
          await loadSplitStatus();
          setIsLoading(false);
        }
      } else if (!state.tableNumber && !isLoading) {
        // Si no hay número de mesa, mantenerse en loading
      }
    };

    loadPaymentData();
  }, [state.tableNumber, state.dishOrders, state.tableSummary]);

  // Recargar split status cuando cambien los split payments en el contexto
  useEffect(() => {
    if (state.tableNumber && state.splitPayments) {
      loadSplitStatus();
    }
  }, [state.splitPayments]);

  // Mostrar error de validación si existe
  if (validationError) {
    return <ValidationError errorType={validationError as any} />;
  }

  // Calcular totales usando tableSummary si está disponible
  const dishOrders = Array.isArray(state.dishOrders) ? state.dishOrders : [];

  // Platillos no pagados y pagados
  const unpaidDishes = dishOrders.filter(
    (dish) => dish.payment_status === "not_paid" || !dish.payment_status,
  );
  const paidDishes = dishOrders.filter(
    (dish) => dish.payment_status === "paid",
  );

  // Usar tableSummary.data.data si está disponible, sino calcular desde dishOrders
  const tableTotalPrice =
    state.tableSummary?.data?.data?.total_amount ||
    dishOrders.reduce((sum, dish) => sum + (dish.total_price || 0), 0);

  const paidAmount =
    state.tableSummary?.data?.data?.paid_amount ||
    paidDishes.reduce((sum, dish) => sum + (dish.total_price || 0), 0);

  const unpaidAmount =
    state.tableSummary?.data?.data?.remaining_amount ||
    unpaidDishes.reduce((sum, dish) => sum + (dish.total_price || 0), 0);

  const tableTotalItems =
    state.tableSummary?.data?.data?.no_items || dishOrders.length;

  // Obtener usuarios únicos considerando active_users que NO hayan pagado nada
  const uniqueUsers = (() => {
    // Si tenemos activeUsers, usar esa información
    if (state.activeUsers && state.activeUsers.length > 0) {
      const usersWithNoPaid = state.activeUsers
        .filter((user) => {
          const totalPaid =
            (user.total_paid_individual || 0) +
            (user.total_paid_amount || 0) +
            (user.total_paid_split || 0);
          return totalPaid === 0;
        })
        .map((user) => user.guest_name)
        .filter(Boolean);

      return [...new Set(usersWithNoPaid)]; // Asegurar unicidad
    }

    // Si hay split status activo, usar esa información
    if (splitStatus && Array.isArray(splitStatus.split_payments)) {
      const allUsers = splitStatus.split_payments.map((payment: any) => ({
        name: payment.guest_name || payment.user_id,
        status: payment.status,
      }));

      const pendingUsers = splitStatus.split_payments
        .filter((payment: any) => payment.status === "pending")
        .map((payment: any) => payment.guest_name || payment.user_id)
        .filter(Boolean);

      splitStatus.split_payments.forEach((payment: any, index: number) => {});

      return [...new Set(pendingUsers)]; // Asegurar unicidad
    }

    // Fallback: usar usuarios con platillos no pagados
    const usersFromDishes = Array.from(
      new Set(unpaidDishes.map((dish) => dish.guest_name).filter(Boolean)),
    );

    return usersFromDishes;
  })();

  // Para mostrar la opción de split, usar usuarios con platillos no pagados
  // pero excluir a los que ya pagaron (tienen registros en active_table_users con pagos > 0)
  const usersForSplitOption = (() => {
    const usersWithUnpaidDishes = Array.from(
      new Set(unpaidDishes.map((dish) => dish.guest_name).filter(Boolean)),
    );

    // Si tenemos activeUsers, filtrar los que ya pagaron completamente
    if (state.activeUsers && state.activeUsers.length > 0) {
      const usersPaid = state.activeUsers
        .filter((user) => {
          const totalPaid =
            (user.total_paid_individual || 0) +
            (user.total_paid_amount || 0) +
            (user.total_paid_split || 0);
          return totalPaid > 0;
        })
        .map((user) => user.guest_name)
        .filter(Boolean);

      // Excluir usuarios que ya pagaron
      return usersWithUnpaidDishes.filter(
        (userName) => !usersPaid.includes(userName),
      );
    }

    return usersWithUnpaidDishes;
  })();

  // Platillos del usuario actual
  const currentUserDishes = dishOrders.filter(
    (dish) => dish.guest_name === state.currentUserName,
  );

  const currentUserUnpaidDishes = currentUserDishes.filter(
    (dish) => dish.payment_status === "not_paid" || !dish.payment_status,
  );

  const currentUserUnpaidAmount = currentUserUnpaidDishes.reduce(
    (sum, dish) => {
      return sum + (dish.total_price || 0);
    },
    0,
  );

  // Verificar si hay división activa
  const hasActiveSplit =
    state.isSplitBillActive &&
    Array.isArray(state.splitPayments) &&
    state.splitPayments.length > 0;

  const handlePayFullBill = () => {
    if (unpaidAmount <= 0) {
      alert("No hay cuenta pendiente por pagar");
      return;
    }

    const queryParams = new URLSearchParams({
      amount: unpaidAmount.toString(),
      type: "full-bill",
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  const handleSelectItems = () => {
    if (unpaidDishes.length === 0) {
      alert("No hay platillos pendientes por pagar");
      return;
    }

    const queryParams = new URLSearchParams({
      type: "select-items",
      userName: state.currentUserName || "",
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  const handleEqualShares = () => {
    if (unpaidAmount <= 0) {
      alert("No hay cuenta pendiente por pagar");
      return;
    }

    const numberOfPeople = usersForSplitOption.length;
    const splitAmount = numberOfPeople > 0 ? unpaidAmount / numberOfPeople : 0;

    const queryParams = new URLSearchParams({
      amount: splitAmount.toString(),
      type: "equal-shares",
      userName: state.currentUserName || "",
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  const handleChooseAmount = () => {
    if (unpaidAmount <= 0) {
      alert("No hay cuenta pendiente por pagar");
      return;
    }

    const queryParams = new URLSearchParams({
      type: "choose-amount",
      userName: state.currentUserName || "",
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  const handlePayCurrentUser = () => {
    if (currentUserUnpaidAmount <= 0) {
      alert("No tienes platillos pendientes por pagar");
      return;
    }

    const queryParams = new URLSearchParams({
      amount: currentUserUnpaidAmount.toString(),
      type: "user-items",
      userName: state.currentUserName || "",
    });

    navigateWithTable(`/tip-selection?${queryParams.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
        <MenuHeaderBack
          restaurant={restaurantData}
          tableNumber={state.tableNumber}
        />

        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
          <div className="left-4 right-4 bg-gradient-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
            <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
              <h1 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight mt-2 md:mt-3 mb-6 md:mb-8">
                Elige cómo quieres pagar la cuenta
              </h1>
            </div>
          </div>

          <div className="flex-1 h-full flex flex-col overflow-hidden">
            <div className="bg-white rounded-t-4xl flex-1 z-5 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 pb-[140px] md:pb-[160px] lg:pb-[180px]">
                <div className="flex flex-col mt-4 md:mt-6 space-y-0">
                  {/* Skeleton para 4 opciones de pago */}
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="w-full bg-white border-b border-[#8e8e8e] animate-pulse"
                    >
                      <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                        <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md bg-gray-200"></div>
                        <div className="flex-1">
                          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                        <div className="size-5 md:size-6 lg:size-7 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skeleton del total */}
              <div className="fixed bottom-0 left-0 right-0 bg-white mx-4 md:mx-6 lg:mx-8 px-6 md:px-8 lg:px-10 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="py-4 md:py-8 lg:py-12 space-y-2 md:space-y-3 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="h-6 bg-gray-200 rounded w-32"></div>
                    <div className="h-6 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-5 bg-gray-200 rounded w-24"></div>
                    <div className="h-5 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
      <MenuHeaderBack
        restaurant={restaurantData}
        tableNumber={state.tableNumber}
      />

      <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
        <div className="left-4 right-4 bg-gradient-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
          <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
            <h1 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight mt-2 md:mt-3 mb-6 md:mb-8">
              Elige cómo quieres pagar la cuenta
            </h1>
          </div>
        </div>

        <div className="flex-1 h-full flex flex-col overflow-hidden">
          <div className="bg-white rounded-t-4xl flex-1 z-5 flex flex-col overflow-hidden">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 pb-[140px] md:pb-[160px] lg:pb-[180px]">
              {/* 4 OPCIONES PRINCIPALES DE PAGO */}
              <div className="flex flex-col mt-4 md:mt-6">
                {/* Opción 1: Pagar cuenta completa */}
                {unpaidAmount > 0 && (
                  <button
                    onClick={handlePayFullBill}
                    className="w-full bg-white cursor-pointer border-b border-[#8e8e8e] active:bg-[#0a8b9b]/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                      <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md border border-black flex items-center justify-center">
                        <ReceiptText
                          className="text-black size-9 md:size-11 lg:size-12"
                          strokeWidth={1}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-black text-base md:text-lg lg:text-xl">
                          Pagar cuenta completa
                        </h3>
                      </div>
                      <div className="text-black">
                        <ChevronRight className="size-5 md:size-6 lg:size-7" />
                      </div>
                    </div>
                  </button>
                )}

                {/* Opción 2: Seleccionar platillos específicos (TODOS los items disponibles) */}
                {unpaidDishes.length > 0 && (
                  <button
                    onClick={handleSelectItems}
                    className="w-full bg-white cursor-pointer border-b border-[#8e8e8e] active:bg-[#0a8b9b]/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                      <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md border border-black flex items-center justify-center">
                        <img
                          src="/icons/select-items-logo.svg"
                          alt=""
                          className="rounded-sm md:rounded-md"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-black text-base md:text-lg lg:text-xl">
                          Seleccionar artículos
                        </h3>
                      </div>
                      <div className="text-black">
                        <ChevronRight className="size-5 md:size-6 lg:size-7" />
                      </div>
                    </div>
                  </button>
                )}

                {/* Opción 3: Dividir cuenta */}
                {unpaidAmount > 0 && (
                  <button
                    onClick={handleEqualShares}
                    className="w-full bg-white cursor-pointer border-b border-[#8e8e8e] active:bg-[#0a8b9b]/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                      <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md border border-black flex items-center justify-center">
                        <img
                          src="/icons/split-bill-logo.png"
                          alt=""
                          className="size-9 md:size-11 lg:size-12"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-black text-base md:text-lg lg:text-xl">
                          Dividir cuenta
                        </h3>
                        {uniqueUsers.length > 1 && (
                          <p className="text-sm md:text-base lg:text-lg text-gray-600">
                            ${(unpaidAmount / uniqueUsers.length).toFixed(2)}{" "}
                            por persona (${uniqueUsers.length} personas
                            pendientes)
                          </p>
                        )}
                      </div>
                      <div className="text-black">
                        <ChevronRight className="size-5 md:size-6 lg:size-7" />
                      </div>
                    </div>
                  </button>
                )}

                {/* Opción 4: Elegir monto personalizado */}
                {unpaidAmount > 0 && (
                  <button
                    onClick={handleChooseAmount}
                    className="w-full bg-white cursor-pointer active:bg-[#0a8b9b]/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 md:gap-4 lg:gap-5 py-3 md:py-4 lg:py-5 px-4 md:px-5 lg:px-6">
                      <div className="size-16 md:size-20 lg:size-24 rounded-sm md:rounded-md border border-black flex items-center justify-center">
                        <DollarSign
                          className="text-black size-9 md:size-11 lg:size-12"
                          strokeWidth={1}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-black text-base md:text-lg lg:text-xl">
                          Elegir monto
                        </h3>
                      </div>
                      <div className="text-black">
                        <ChevronRight className="size-5 md:size-6 lg:size-7" />
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* Mensaje si no hay platillos pendientes */}
              {unpaidAmount <= 0 && (
                <div className="my-8 md:my-10 lg:my-12 text-center px-6 md:px-8 lg:px-10">
                  <div className="p-6 md:p-8 lg:p-10 bg-green-50 rounded-lg md:rounded-xl">
                    <h3 className="text-lg md:text-xl lg:text-2xl font-medium text-green-800 mb-2 md:mb-3">
                      ¡Cuenta pagada completamente!
                    </h3>
                    <p className="text-green-600 text-base md:text-lg lg:text-xl">
                      Todos los platillos de la mesa han sido pagados.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Total - Fixed to bottom */}
            {unpaidAmount > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white mx-4 md:mx-6 lg:mx-8 px-6 md:px-8 lg:px-10 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="py-4 md:py-8 lg:py-12 space-y-2 md:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg md:text-2xl lg:text-3xl font-medium text-black">
                      Total mesa {state.tableNumber}
                    </span>
                    <span className="text-lg md:text-2xl lg:text-3xl font-medium text-black">
                      ${tableTotalPrice.toFixed(2)}
                    </span>
                  </div>
                  {paidAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-green-600 font-medium text-base md:text-xl lg:text-2xl">
                        Pagado:
                      </span>
                      <span className="text-green-600 font-medium text-base md:text-xl lg:text-2xl">
                        ${paidAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[#eab3f4] font-medium text-base md:text-xl lg:text-2xl">
                      Restante:
                    </span>
                    <span className="text-[#eab3f4] font-medium text-base md:text-xl lg:text-2xl">
                      ${unpaidAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
