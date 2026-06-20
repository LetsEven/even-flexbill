"use client";

import { useEffect, useState } from "react";
import { Eye, EyeClosed, Loader, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTable } from "../context/TableContext";
import { useTableNavigation } from "../hooks/useTableNavigation";
import { getRestaurantData } from "../utils/restaurantData";
import MenuHeaderBackOrder from "./headers/MenuHeaderBackOrder";

export default function OrderStatus() {
  const { state, loadTableData } = useTable();
  const { navigateWithTable } = useTableNavigation();
  const { isAuthenticated, isLoading } = useAuth();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaidOrders, setShowPaidOrders] = useState(false);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const restaurantData = getRestaurantData();

  const handleRefresh = () => {
    loadTableData();
  };

  const handleCheckOut = async () => {
    setIsProcessingPayment(true);
    try {
      if (!isLoading && isAuthenticated) {
        // User is authenticated, redirect directly to payment options
        navigateWithTable("/payment-options");
      } else {
        // User is guest, redirect to auth page
        navigateWithTable("/auth-selection");
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Filtrar platillos pagados y no pagados
  const unpaidDishes = Array.isArray(state.dishOrders)
    ? state.dishOrders.filter((dish) => dish.payment_status === "not_paid")
    : [];
  const paidDishes = Array.isArray(state.dishOrders)
    ? state.dishOrders.filter((dish) => dish.payment_status === "paid")
    : [];

  // Función para agrupar items idénticos del mismo usuario
  const groupIdenticalItems = (dishes: any[]) => {
    const grouped = new Map<string, any>();

    dishes.forEach((dish) => {
      // Crear una clave única basada en: usuario + item + custom_fields
      const customFieldsKey = JSON.stringify(
        dish.custom_fields?.map((field: any) => ({
          name: field.name,
          options: field.selectedOptions
            .map((opt: any) => `${opt.optionName}:${opt.price}`)
            .sort(),
        })) || [],
      );
      const key = `${dish.guest_name}|${dish.item}|${customFieldsKey}`;

      if (grouped.has(key)) {
        const existing = grouped.get(key);
        existing.quantity += dish.quantity;
        existing.total_price += dish.total_price;
        // Acumular estatus de cada sub-orden
        existing.statuses.push({
          status: dish.status,
          quantity: dish.quantity,
        });
      } else {
        grouped.set(key, {
          ...dish,
          statuses: [{ status: dish.status, quantity: dish.quantity }],
        });
      }
    });

    return Array.from(grouped.values());
  };

  // Agrupar items no pagados idénticos
  const groupedUnpaidDishes = groupIdenticalItems(unpaidDishes);

  // Calcular totales de la mesa usando tableSummary si está disponible
  const tableTotalItems =
    state.tableSummary?.data?.data?.no_items || state.dishOrders?.length || 0;
  const tableTotalPrice =
    state.tableSummary?.data?.data?.total_amount ||
    state.dishOrders?.reduce((sum, dish) => sum + dish.total_price, 0) ||
    0;
  const tablePaidAmount =
    state.tableSummary?.data?.data?.paid_amount ||
    paidDishes.reduce((sum, dish) => sum + dish.total_price, 0) ||
    0;
  const tableRemainingAmount =
    state.tableSummary?.data?.data?.remaining_amount ||
    unpaidDishes.reduce((sum, dish) => sum + dish.total_price, 0) ||
    0;

  // Calcular totales de platillos pagados
  const paidTotalItems = paidDishes.length;
  const paidTotalPrice = paidDishes.reduce(
    (sum, dish) => sum + dish.total_price,
    0,
  );

  // Cargar datos cuando se monta el componente o cambia el número de mesa
  useEffect(() => {
    if (state.tableNumber && !hasLoadedInitialData) {
      setHasLoadedInitialData(true);

      // Call API directly to debug
      loadTableData()
        .then(() => {})
        .catch((error) => {
          console.error("❌ loadTableData failed:", error);
        });
    }
  }, [state.tableNumber]); // Removed loadTableData from dependencies

  return (
    <div className="min-h-dvh brand-evergreen flex flex-col">
      <MenuHeaderBackOrder
        restaurant={restaurantData}
        tableNumber={state.tableNumber}
      />

      <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
        <div className="left-4 right-4 bg-even-evergreen rounded-t-4xl translate-y-7 z-0">
          <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
            <h1 className="font-medium text-white/60 text-xl md:text-2xl lg:text-3xl">
              Mesa {state.tableNumber}
            </h1>
            <h2 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight mt-2 md:mt-3 mb-6 md:mb-8">
              Revisa tu cuenta y elige como pagar
            </h2>
          </div>
        </div>

        <div className="flex-1 h-full flex flex-col overflow-hidden">
          <div className="bg-white rounded-t-4xl flex-1 z-5 flex flex-col overflow-hidden">
            {/* Table Closed Message */}
            {state.tableSummary?.data?.data?.status === "paid" ? (
              <div className="flex-1 flex items-center justify-center py-8 md:py-12 text-center">
                <div>
                  <div className="mb-4 md:mb-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 mx-auto bg-even-grass/20 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 text-even-shamrock"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-medium text-even-shamrock mb-2 md:mb-3">
                    ¡Mesa Cerrada!
                  </h2>
                  <p className="text-gray-600 text-base md:text-lg lg:text-xl mb-4 md:mb-6">
                    Todas las órdenes han sido pagadas exitosamente
                  </p>
                  <button
                    onClick={handleRefresh}
                    className="bg-even-grass text-even-evergreen px-6 md:px-8 lg:px-10 py-2 md:py-3 lg:py-4 rounded-full transition-colors active:scale-95 text-base md:text-lg lg:text-xl"
                  >
                    Actualizar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 pb-[180px] md:pb-[200px] lg:pb-[220px]">
                  {/* Ordered Items */}
                  <div className="w-full mx-auto pb-6 md:pb-8">
                    <div className="flex justify-center items-start relative mt-6 md:mt-8">
                      <h2 className="bg-surface border border-stroke rounded-full px-3 md:px-4 lg:px-5 py-1 md:py-1.5 text-base md:text-lg lg:text-xl font-medium text-black">
                        Cuenta Compartida
                      </h2>
                      <div className="absolute right-0">
                        <button
                          onClick={handleRefresh}
                          disabled={state.isLoading}
                          className="flex items-center gap-2 text-even-shamrock hover:text-even-evergreen transition-colors disabled:text-gray-400 cursor-pointer"
                        >
                          <svg
                            className={`w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 ${state.isLoading ? "animate-spin" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {state.isLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 animate-spin text-even-shamrock" />
                      </div>
                    ) : unpaidDishes.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-8 md:py-12 text-center">
                        <div>
                          <p className="text-black text-2xl md:text-3xl lg:text-4xl">
                            Aún no hay pedidos realizados para esta mesa
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-black font-medium text-sm md:text-base lg:text-lg flex gap-10 md:gap-12 lg:gap-14 justify-end translate-y-4">
                          <span>Cant.</span>
                          <span>Precio</span>
                        </div>
                        <div className="divide-y divide-stroke/50">
                          {groupedUnpaidDishes.map((dish, dishIndex) => {
                            const statusMap: Record<string, string> = {
                              preparing: "Preparando",
                              ready: "Listo",
                              delivered: "Entregado",
                            };
                            const statusColorMap: Record<string, string> = {
                              preparing:
                                "bg-yellow-100 text-yellow-800 border-yellow-300",
                              ready:
                                "bg-blue-100 text-blue-800 border-blue-300",
                              delivered:
                                "bg-green-100 text-green-800 border-green-300",
                            };

                            // Agrupar cantidades por estatus
                            const statusCounts = (
                              dish.statuses as {
                                status: string;
                                quantity: number;
                              }[]
                            ).reduce(
                              (acc, s) => {
                                acc[s.status] =
                                  (acc[s.status] || 0) + s.quantity;
                                return acc;
                              },
                              {} as Record<string, number>,
                            );
                            const statusHierarchy = [
                              "delivered",
                              "ready",
                              "preparing",
                            ];
                            const uniqueStatuses = Object.keys(statusCounts);
                            const multipleStatuses = uniqueStatuses.length > 1;
                            // Estatus más avanzado según jerarquía
                            const topStatus =
                              statusHierarchy.find((s) => statusCounts[s]) ??
                              uniqueStatuses[0];

                            return (
                              <div
                                key={dish.dish_order_id}
                                className="py-3 md:py-4 lg:py-5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                                    <div className="flex-shrink-0 mt-1">
                                      <div className="size-16 md:size-20 lg:size-24 bg-gray-300 rounded-sm md:rounded-md flex items-center justify-center hover:scale-105 transition-transform duration-200">
                                        {dish.images?.[0] ? (
                                          <img
                                            src={dish.images[0]}
                                            alt="Dish Image"
                                            className="w-full h-full object-cover rounded-sm md:rounded-md"
                                          />
                                        ) : (
                                          <img
                                            src="/even/even-asterisk-evergreen.svg"
                                            alt="Logo Even"
                                            className="size-10 md:size-12 lg:size-14 object-contain"
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-xs md:text-sm lg:text-base text-black/60 font-medium">
                                        {dish.guest_name.toUpperCase()}
                                      </h3>
                                      <h4 className="text-base md:text-lg lg:text-xl text-black capitalize">
                                        {dish.item}
                                      </h4>
                                      {dish.custom_fields &&
                                        dish.custom_fields.length > 0 && (
                                          <div className="text-xs md:text-sm lg:text-base text-gray-400 space-y-0.5">
                                            {dish.custom_fields.map(
                                              (field: any, idx: number) => (
                                                <div key={idx}>
                                                  {field.selectedOptions.map(
                                                    (
                                                      opt: any,
                                                      optIdx: number,
                                                    ) => (
                                                      <p key={optIdx}>
                                                        {optIdx === 0 &&
                                                          (opt.quantity ?? 0) >
                                                            1 && (
                                                            <span className="ml-1">
                                                              x{dish.quantity}
                                                            </span>
                                                          )}{" "}
                                                        {opt.optionName}
                                                        {opt.price > 0 &&
                                                          ` $${opt.price.toFixed(2)}`}
                                                      </p>
                                                    ),
                                                  )}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        )}
                                      <div className="mt-1 md:mt-1.5 lg:mt-2">
                                        <span
                                          className={`inline-block px-2 md:px-3 lg:px-4 py-0.5 md:py-1 lg:py-1.5 text-xs md:text-sm lg:text-base font-medium rounded-full border ${statusColorMap[topStatus] || "bg-yellow-100 text-yellow-800 border-yellow-300"}`}
                                        >
                                          {statusMap[topStatus] || topStatus}
                                          {multipleStatuses &&
                                            ` ${statusCounts[topStatus]}/${dish.quantity}`}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right flex gap-10 md:gap-12 lg:gap-14">
                                    <p className="text-black text-base md:text-lg lg:text-xl">
                                      {dish.quantity}
                                    </p>
                                    <p className="text-black w-14 md:w-16 lg:w-20 text-base md:text-lg lg:text-xl">
                                      $
                                      {(
                                        dish.total_price / dish.quantity
                                      ).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Paid Orders Section */}
                  {paidDishes.length > 0 && (
                    <div className="w-full mx-auto pb-6 md:pb-8">
                      <div className="flex justify-between items-center mb-4 md:mb-6">
                        <h2 className="bg-surface border border-stroke rounded-full px-3 md:px-4 lg:px-5 py-1 md:py-1.5 text-base md:text-lg lg:text-xl font-medium text-black justify-self-center">
                          Artículos Pagados
                        </h2>
                        <button
                          onClick={() => setShowPaidOrders(!showPaidOrders)}
                          className="text-even-shamrock hover:text-even-evergreen transition-colors cursor-pointer text-sm md:text-base lg:text-lg"
                        >
                          {showPaidOrders ? (
                            <div className="flex items-center gap-1 md:gap-1.5">
                              <EyeClosed className="size-4 md:size-5 lg:size-6" />
                              Ocultar
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 md:gap-1.5">
                              <Eye className="size-4 md:size-5 lg:size-6" />
                              Ver
                            </div>
                          )}
                        </button>
                      </div>

                      {showPaidOrders && (
                        <>
                          <div className="text-black font-medium text-sm md:text-base lg:text-lg flex gap-5 md:gap-6 lg:gap-7 justify-end translate-y-3">
                            <span>Cant.</span>
                            <span>Precio</span>
                          </div>

                          <div className="divide-y divide-stroke/50">
                            {paidDishes.map((dish, dishIndex) => (
                              <div
                                key={`paid-${dish.dish_order_id}`}
                                className="py-3 md:py-4 lg:py-5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                                    <div className="flex-shrink-0 mt-1">
                                      <div className="size-16 md:size-20 lg:size-24 bg-gray-300 rounded-sm md:rounded-md flex items-center justify-center hover:scale-105 transition-transform duration-200">
                                        {dish.images?.[0] ? (
                                          <img
                                            src={dish.images[0]}
                                            alt="Dish Image"
                                            className="w-full h-full object-cover rounded-sm md:rounded-md"
                                          />
                                        ) : (
                                          <img
                                            src="/even/even-asterisk-evergreen.svg"
                                            alt="Logo Even"
                                            className="size-10 md:size-12 lg:size-14 object-contain"
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm md:text-base lg:text-lg text-stroke">
                                        {dish.guest_name.toUpperCase()}
                                      </h3>
                                      <h4 className="text-base md:text-lg lg:text-xl text-black">
                                        {dish.item}
                                      </h4>
                                      {dish.custom_fields &&
                                        dish.custom_fields.length > 0 && (
                                          <div className="text-xs md:text-sm lg:text-base text-gray-400 space-y-0.5">
                                            {dish.custom_fields.map(
                                              (field: any, idx: number) => (
                                                <div key={idx}>
                                                  {field.selectedOptions.map(
                                                    (
                                                      opt: any,
                                                      optIdx: number,
                                                    ) => (
                                                      <p key={optIdx}>
                                                        {optIdx === 0 &&
                                                          (opt.quantity ?? 0) >
                                                            1 && (
                                                            <span className="ml-1">
                                                              x{dish.quantity}
                                                            </span>
                                                          )}{" "}
                                                        {opt.optionName}
                                                        {opt.price > 0 &&
                                                          ` $${opt.price.toFixed(2)}`}
                                                      </p>
                                                    ),
                                                  )}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        )}
                                      <div className="mt-1 flex items-center gap-2">
                                        <p className="text-xs md:text-sm lg:text-base text-even-shamrock">
                                          ✓ PAGADO
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right flex gap-10 md:gap-12 lg:gap-14">
                                    <p className="text-black text-base md:text-lg lg:text-xl">
                                      {dish.quantity}
                                    </p>
                                    <p className="text-black text-base md:text-lg lg:text-xl">
                                      $
                                      {(
                                        dish.total_price / dish.quantity
                                      ).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {/* Paid Orders Total */}
                            <div className="pt-4 md:pt-6">
                              <div className="flex justify-between items-center text-black">
                                <span className="text-lg md:text-xl lg:text-2xl font-medium">
                                  Total Pagado
                                </span>
                                <span className="font-medium text-base md:text-lg lg:text-xl">
                                  ${paidTotalPrice.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-sm md:text-base lg:text-lg mt-1 text-black">
                                {paidTotalItems} platillos pagados
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Fixed bottom section */}
                {unpaidDishes.length > 0 && tableRemainingAmount > 0 && (
                  <div
                    className="fixed bottom-0 left-0 right-0 bg-white mx-4 md:mx-6 lg:mx-8 px-6 md:px-8 lg:px-10 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
                    style={{
                      paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
                    }}
                  >
                    <div className="mb-4 md:mb-5 lg:mb-6"></div>
                    {/* Table Total */}
                    <div className="space-y-3 md:space-y-4">
                      {/* Total de la Mesa */}
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                          Subtotal
                        </span>
                        <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                          ${tableTotalPrice.toFixed(2)} MXN
                        </span>
                      </div>

                      {/* Pagado */}
                      {tablePaidAmount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-even-shamrock font-medium text-base md:text-lg lg:text-xl">
                            Pagado:
                          </span>
                          <span className="text-even-shamrock font-medium text-base md:text-lg lg:text-xl">
                            ${tablePaidAmount.toFixed(2)} MXN
                          </span>
                        </div>
                      )}

                      {/* Restante por pagar */}
                      <div className="flex justify-between items-center">
                        <span className="text-black font-bold text-base md:text-lg lg:text-xl">
                          Total:
                        </span>
                        <span className="text-black font-bold text-base md:text-lg lg:text-xl">
                          ${tableRemainingAmount.toFixed(2)} MXN
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleCheckOut}
                      disabled={
                        isProcessingPayment || tableRemainingAmount <= 0
                      }
                      className={`mt-5 md:mt-6 lg:mt-7 w-full py-3 md:py-4 lg:py-5 rounded-full font-medium active:scale-95 transition-all bg-even-grass text-even-evergreen text-base md:text-lg lg:text-xl ${
                        !isProcessingPayment && tableRemainingAmount > 0
                          ? "cursor-pointer"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {isProcessingPayment ? (
                        <div className="flex items-center justify-center gap-2 md:gap-3">
                          <Loader2 className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 animate-spin" />
                          <span>Cargando...</span>
                        </div>
                      ) : tableRemainingAmount <= 0 ? (
                        "¡Cuenta pagada completamente!"
                      ) : (
                        "Continuar"
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
