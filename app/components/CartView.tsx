"use client";

import { useRef, useState, useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { useCart, CartItem } from "@/app/context/CartContext";
import { useTable } from "@/app/context/TableContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { getRestaurantData } from "@/app/utils/restaurantData";
import MenuHeaderBack from "@/app/components/headers/MenuHeaderBack";
import OrderAnimation from "@/app/components/UI/OrderAnimation";
import { useAuth } from "@/app/context/AuthContext";
import { useRestaurant } from "@/app/context/RestaurantContext";
import { useGuest } from "@/app/context/GuestContext";

export default function CartView() {
  const {
    state: cartState,
    updateQuantity,
    clearCart,
    orderNotes,
    setOrderNotes,
    updateOrderNotes,
  } = useCart();
  const { state: tableState, submitOrder } = useTable();
  const { navigateWithTable } = useTableNavigation();
  const restaurantData = getRestaurantData();
  const { user, isAuthenticated, isLoading, profile, refreshProfile } =
    useAuth();
  const { branchNumber } = useRestaurant();
  const { guestName } = useGuest();

  // Si el usuario está autenticado pero el perfil no cargó (ej. error de red al
  // volver de fondo en móvil), intentar cargarlo para que el checkout funcione.
  useEffect(() => {
    if (!isLoading && user && !profile) {
      refreshProfile();
    }
  }, [isLoading, user, profile, refreshProfile]);

  const [showOrderAnimation, setShowOrderAnimation] = useState(false);
  const [orderedItems, setOrderedItems] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleOrder = async () => {
    // Si el usuario está loggeado, hacer la orden directamente con animación
    if (!isLoading && isAuthenticated && user) {
      setIsSubmitting(true);
      // Guardar items antes de que se limpie el carrito
      const itemsToOrder = [...cartState.items];
      setOrderedItems(itemsToOrder);
      // Mostrar animación de orden INMEDIATAMENTE (sin enviar la orden aún)
      setShowOrderAnimation(true);
    } else if (guestName) {
      // Si NO está loggeado pero ya tiene nombre de invitado, proceder con la orden
      console.log(
        "📱 User not authenticated but has guest name, proceeding with order",
      );
      setIsSubmitting(true);
      const itemsToOrder = [...cartState.items];
      setOrderedItems(itemsToOrder);
      setShowOrderAnimation(true);
    } else {
      // Si NO está loggeado y no tiene nombre, navegar a la vista de usuario para capturar su nombre
      console.log("📱 User not authenticated, redirecting to /user");
      navigateWithTable("/user");
    }
  };

  const handleContinueFromAnimation = () => {
    navigateWithTable("/order");
  };

  const handleCancelOrder = () => {
    console.log("❌ Order cancelled by user");
    setShowOrderAnimation(false);
    setOrderedItems([]);
    setIsSubmitting(false);
  };

  const handleConfirmOrder = async () => {
    // Esta función se ejecuta después de que expira el período de cancelación
    if (orderedItems.length > 0) {
      // Determinar el nombre del usuario (autenticado o invitado)
      let userName: string;
      if (isAuthenticated && user) {
        userName = profile?.firstName
          ? `${profile.firstName}`.trim()
          : `Usuario ${user.id.substring(0, 8)}`;
      } else if (guestName) {
        userName = guestName;
      } else {
        console.error("No user name available for order");
        setShowOrderAnimation(false);
        setIsSubmitting(false);
        return;
      }

      try {
        // Enviar la orden a la API con branchNumber
        await submitOrder(
          userName,
          orderedItems,
          branchNumber?.toString(),
          orderNotes.trim() || null,
        );
        // Limpiar el carrito de la base de datos después de la orden exitosa
        await clearCart();
      } catch (error) {
        console.error("Error submitting order:", error);
        // Si hay error, ocultar la animación y mostrar mensaje al usuario
        setShowOrderAnimation(false);
        const errorMessage =
          error instanceof Error ? error.message : "Error desconocido";
        alert(
          `Error al enviar la orden: ${errorMessage}. Por favor intenta nuevamente.`,
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
      <MenuHeaderBack
        restaurant={restaurantData}
        tableNumber={tableState.tableNumber}
      />

      <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
        <div className="left-4 right-4 bg-gradient-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
          {cartState.items.length === 0 ? (
            <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
              <h1 className="text-[#e0e0e0] text-xl md:text-2xl lg:text-3xl font-medium">
                Mesa {tableState.tableNumber}
              </h1>
              <h2 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight mt-2 md:mt-3 mb-6 md:mb-8">
                El carrito está vacío, agrega items y disfruta
              </h2>
            </div>
          ) : (
            <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
              <h1 className="text-[#e0e0e0] text-xl md:text-2xl lg:text-3xl font-medium">
                Mesa {tableState.tableNumber}
              </h1>
              <h2 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 md:leading-9 lg:leading-tight mt-2 md:mt-3 mb-6 md:mb-8">
                Confirma tu pedido
              </h2>
            </div>
          )}
        </div>

        <div className="flex-1 h-full flex flex-col overflow-hidden">
          {/* Cart Items */}
          <div className="bg-white rounded-t-4xl flex-1 z-5 flex flex-col px-6 md:px-8 lg:px-10 overflow-hidden">
            {/* Scrollable content */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto flex flex-col pb-[160px] md:pb-[180px] lg:pb-[200px]"
            >
              <div className="pt-6 md:pt-8">
                <h2 className="bg-[#f9f9f9] border border-[#8e8e8e] rounded-full px-3 md:px-4 lg:px-5 py-1 md:py-1.5 text-base md:text-lg lg:text-xl font-medium text-black w-fit mx-auto">
                  Mi carrito
                </h2>
              </div>

              {cartState.items.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-8 md:py-12 text-center">
                  <div>
                    <div className="text-gray-400 text-6xl md:text-7xl lg:text-8xl mb-4 md:mb-6">
                      🛒
                    </div>
                    <p className="text-black text-2xl md:text-3xl lg:text-4xl">
                      El carrito está vacío
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-black font-medium text-sm md:text-base lg:text-lg flex gap-10 md:gap-12 lg:gap-[68px] justify-end translate-y-4">
                    <span>Cant.</span>
                    <span>Precio</span>
                  </div>
                  <div className="divide-y divide-[#8e8e8e]/50">
                    {cartState.items.map((item, index) => (
                      <div
                        key={`${item.id}-${index}`}
                        className="py-3 md:py-4 lg:py-5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                            <div className="flex-shrink-0">
                              <div className="size-16 md:size-20 lg:size-24 bg-gray-300 rounded-sm md:rounded-md flex items-center justify-center hover:scale-105 transition-transform duration-200">
                                {item.images && item.images.length > 0 ? (
                                  <img
                                    src={
                                      item.images[0] || "/logo-short-green.webp"
                                    }
                                    alt="Dish preview"
                                    className="w-full h-full object-cover rounded-sm md:rounded-md"
                                  />
                                ) : (
                                  <img
                                    src="/logo-short-green.webp"
                                    alt="Logo Even"
                                    className="size-18 md:size-20 lg:size-22 object-contain"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base md:text-lg lg:text-xl text-black capitalize">
                                {item.name}
                              </h3>
                              {item.customFields &&
                                item.customFields.length > 0 && (
                                  <div className="text-xs md:text-sm lg:text-base text-gray-400 space-y-0.5">
                                    {item.customFields.map((field, idx) => (
                                      <div key={idx}>
                                        {field.selectedOptions.map(
                                          (opt, optIdx) => (
                                            <p key={optIdx}>
                                              {optIdx === 0 &&
                                                (opt.quantity ?? 0) > 1 && (
                                                  <span className="ml-1">
                                                    x{item.quantity}
                                                  </span>
                                                )}{" "}
                                              {opt.optionName}
                                              {opt.price > 0 &&
                                                ` $${opt.price.toFixed(2)}`}
                                            </p>
                                          ),
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              {item.specialInstructions && (
                                <p className="text-xs md:text-sm text-gray-500 italic mt-0.5">
                                  &ldquo;{item.specialInstructions}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex items-center justify-center gap-4 md:gap-5 lg:gap-6">
                            <div className="flex items-center gap-2 md:gap-3">
                              <Minus
                                onClick={() =>
                                  item.cartItemId &&
                                  updateQuantity(
                                    item.cartItemId,
                                    item.quantity - 1,
                                  )
                                }
                                className="size-4 md:size-5 lg:size-6 flex items-center justify-center text-black cursor-pointer"
                              />
                              <p className="text-base md:text-lg lg:text-xl text-black text-center">
                                {item.quantity}
                              </p>
                              <Plus
                                onClick={() =>
                                  item.cartItemId &&
                                  updateQuantity(
                                    item.cartItemId,
                                    item.quantity + 1,
                                  )
                                }
                                className="size-4 md:size-5 lg:size-6 flex items-center justify-center text-black cursor-pointer"
                              />
                            </div>
                            <div className="w-16 md:w-20 lg:w-24 text-right">
                              <p className="text-base md:text-lg lg:text-xl text-black">
                                $
                                {(item.price + (item.extraPrice || 0)).toFixed(
                                  2,
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Comentarios Textarea - Dentro del scroll */}
                  <div className="text-black mt-6 md:mt-8">
                    <span className="font-medium text-xl md:text-2xl lg:text-3xl">
                      ¿Algo que debamos saber?
                    </span>
                    <textarea
                      className="h-24 md:h-28 lg:h-32 text-base md:text-lg lg:text-xl w-full bg-[#f9f9f9] border border-[#bfbfbf] px-3 md:px-4 py-2 md:py-3 rounded-lg resize-none focus:outline-none mt-2 md:mt-3"
                      placeholder="Comentarios generales para el restaurante..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      onBlur={(e) => {
                        updateOrderNotes(e.target.value);
                        setTimeout(() => {
                          window.scrollTo({ top: 0, behavior: "smooth" });
                          if (scrollContainerRef.current) {
                            scrollContainerRef.current.scrollTop = 0;
                          }
                        }, 300);
                      }}
                      maxLength={80}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                      onFocus={(e) => {
                        setTimeout(() => {
                          e.target.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }, 200);
                      }}
                    />
                    <p className="text-right text-sm text-gray-400 mt-1">
                      {orderNotes.length}/80
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed bottom section */}
            {cartState.items.length > 0 && (
              <div
                className="fixed bottom-0 left-0 bg-white right-0 mx-4 md:mx-6 lg:mx-8 px-6 md:px-8 lg:px-10 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
                style={{
                  paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
                }}
              >
                <div className="w-full flex gap-3 md:gap-4 lg:gap-5 mt-6 md:mt-7 lg:mt-8 justify-between">
                  <div className="flex flex-col justify-center">
                    <span className="text-gray-600 text-sm md:text-base lg:text-lg">
                      {cartState.totalItems} artículos
                    </span>
                    <div className="flex items-center justify-center w-fit text-2xl md:text-3xl lg:text-4xl font-medium text-black text-center">
                      ${cartState.totalPrice.toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={handleOrder}
                    disabled={isSubmitting || cartState.isLoading}
                    className={`py-3 md:py-4 lg:py-5 text-white rounded-full cursor-pointer font-normal h-fit flex items-center justify-center text-base md:text-lg lg:text-xl active:scale-95 transition-transform ${
                      isSubmitting || cartState.isLoading
                        ? "bg-gradient-to-r from-[#34808C] to-[#173E44] opacity-50 cursor-not-allowed px-10 md:px-12 lg:px-14"
                        : "bg-gradient-to-r from-[#34808C] to-[#173E44] px-20 md:px-24 lg:px-28 animate-pulse-button"
                    }`}
                  >
                    {isSubmitting || cartState.isLoading
                      ? "Cargando..."
                      : "Ordenar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OrderAnimation overlay - para usuarios loggeados o invitados con nombre */}
      {showOrderAnimation && (
        <OrderAnimation
          userName={profile?.firstName || guestName || "Usuario"}
          orderedItems={orderedItems}
          onContinue={handleContinueFromAnimation}
          onCancel={handleCancelOrder}
          onConfirm={handleConfirmOrder}
        />
      )}
    </div>
  );
}
