"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { X, Minus, Plus } from "lucide-react";
import type { DishOrder } from "@/app/services/table.service";
import { useCart, CartItem } from "@/app/context/CartContext";
import { useTable } from "@/app/context/TableContext";
import { useAuth } from "@/app/context/AuthContext";
import { useRestaurant } from "@/app/context/RestaurantContext";
import { useGuest } from "@/app/context/GuestContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import OrderAnimation from "@/app/components/UI/OrderAnimation";

interface ReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  dishOrders: DishOrder[];
  tableNumber?: string;
}

function getCustomFieldsKey(customFields: any): string {
  if (!customFields) return "";
  try {
    return JSON.stringify(customFields);
  } catch {
    return "";
  }
}

function ReorderModal({
  isOpen,
  onClose,
  dishOrders,
  tableNumber,
}: ReorderModalProps) {
  const { state: cartState, addItem, removeItem, updateQuantity } = useCart();
  const { submitOrder } = useTable();
  const { user, isAuthenticated, isLoading: authLoading, profile } = useAuth();
  const { branchNumber } = useRestaurant();
  const { guestName } = useGuest();
  const { navigateWithTable } = useTableNavigation();

  const [showOrderAnimation, setShowOrderAnimation] = useState(false);
  const [orderedItems, setOrderedItems] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Snapshot of cart item IDs that existed before the modal opened
  const preModalCartIds = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (isOpen) {
      preModalCartIds.current = new Set(cartState.items.map((i) => i.id));
    }
  }, [isOpen]);

  const handleClose = async () => {
    const modalItemIds = new Set(
      uniqueItems.map(({ order }) => order.menu_item_id),
    );
    const itemsToRemove = cartState.items.filter(
      (item) =>
        modalItemIds.has(item.id) && !preModalCartIds.current.has(item.id),
    );
    for (const item of itemsToRemove) {
      await removeItem(item.id);
    }
    onClose();
  };

  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    const result: { key: string; order: DishOrder }[] = [];
    for (const order of dishOrders) {
      if (!order.menu_item_id) continue;
      const key = `${order.menu_item_id}_${getCustomFieldsKey(order.custom_fields)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ key, order });
      }
    }
    return result;
  }, [dishOrders]);

  const getCartItem = (menuItemId: number) =>
    cartState.items.find((i) => i.id === menuItemId);

  const handleCardTap = async (order: DishOrder) => {
    const cartItem = getCartItem(order.menu_item_id!);
    if (!cartItem || cartItem.quantity === 0) {
      await addItem({
        id: order.menu_item_id!,
        name: order.item,
        description: "",
        price: order.price,
        images: order.images,
        features: [],
        discount: 0,
        customFields: order.custom_fields || [],
        extraPrice: order.extra_price || 0,
      });
    }
  };

  const handleDecrement = async (order: DishOrder) => {
    const cartItem = getCartItem(order.menu_item_id!);
    if (!cartItem) return;
    if (cartItem.quantity <= 1) {
      await removeItem(cartItem.id);
    } else {
      await updateQuantity(cartItem.cartItemId!, cartItem.quantity - 1);
    }
  };

  const handleIncrement = async (order: DishOrder) => {
    const cartItem = getCartItem(order.menu_item_id!);
    if (!cartItem) {
      await handleCardTap(order);
      return;
    }
    await updateQuantity(cartItem.cartItemId!, cartItem.quantity + 1);
  };

  const hasSelection = uniqueItems.some(({ order }) => {
    const cartItem = cartState.items.find((i) => i.id === order.menu_item_id);
    return (cartItem?.quantity ?? 0) > 0;
  });

  const subtotal = useMemo(
    () =>
      uniqueItems.reduce((sum, { order }) => {
        const cartItem = cartState.items.find(
          (i) => i.id === order.menu_item_id,
        );
        const qty = cartItem?.quantity ?? 0;
        return sum + qty * (order.price + (order.extra_price || 0));
      }, 0),
    [uniqueItems, cartState.items],
  );

  const handleReorder = () => {
    const modalItemIds = new Set(
      uniqueItems.map(({ order }) => order.menu_item_id),
    );
    const itemsToOrder = cartState.items.filter(
      (item) => modalItemIds.has(item.id) && item.quantity > 0,
    );
    if (itemsToOrder.length === 0) return;

    if (!authLoading && isAuthenticated && user) {
      setIsSubmitting(true);
      setOrderedItems(itemsToOrder);
      setShowOrderAnimation(true);
    } else if (guestName) {
      setIsSubmitting(true);
      setOrderedItems(itemsToOrder);
      setShowOrderAnimation(true);
    } else {
      navigateWithTable("/user");
    }
  };

  const handleConfirmOrder = async () => {
    if (orderedItems.length === 0) return;

    let userName: string;
    if (isAuthenticated && user) {
      userName = profile?.firstName
        ? `${profile.firstName}`.trim()
        : `Usuario ${user.id.substring(0, 8)}`;
    } else if (guestName) {
      userName = guestName;
    } else {
      setShowOrderAnimation(false);
      setIsSubmitting(false);
      return;
    }

    try {
      await submitOrder(userName, orderedItems, branchNumber?.toString(), null);
      for (const item of orderedItems) {
        await removeItem(item.id);
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      setShowOrderAnimation(false);
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      alert(
        `Error al enviar la orden: ${errorMessage}. Por favor intenta nuevamente.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueFromAnimation = () => {
    navigateWithTable("/order");
  };

  const handleCancelOrder = () => {
    setShowOrderAnimation(false);
    setOrderedItems([]);
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-xs z-[999] flex items-center justify-center"
        onClick={handleClose}
      >
        <div
          className="relative bg-[#173E44]/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] w-full mx-4 md:mx-12 lg:mx-28 rounded-4xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0">
            <div className="w-full flex justify-end">
              <button
                onClick={handleClose}
                className="p-2 md:p-3 lg:p-4 hover:bg-white/10 rounded-lg md:rounded-xl transition-colors mt-3 md:mt-4 lg:mt-5 mr-3 md:mr-4 lg:mr-5"
              >
                <X className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-white" />
              </button>
            </div>
            <div className="px-6 md:px-8 lg:px-10 pb-4 md:pb-5 flex flex-col">
              <h2 className="text-lg md:text-xl lg:text-2xl text-white font-semibold leading-snug">
                Reordenar
              </h2>
              {tableNumber && (
                <p className="text-sm md:text-base text-white/60 mt-0.5">
                  Mesa {tableNumber}
                </p>
              )}
              <p className="text-sm text-white mt-0.5">
                Selecciona los artículos que deseas volver a ordenar
              </p>
            </div>
            <div className="border-t border-white/20" />
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-6 md:px-8 lg:px-10 py-4 md:py-5">
            {uniqueItems.length === 0 ? (
              <p className="text-white/70 text-base md:text-lg text-center py-8">
                No hay items disponibles para reordenar
              </p>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {uniqueItems.map(({ key, order }) => {
                  const cartItem = getCartItem(order.menu_item_id!);
                  const qty = cartItem?.quantity ?? 0;
                  const isSelected = qty > 0;

                  const customFields = order.custom_fields as
                    | Array<{
                        fieldId: string;
                        fieldName: string;
                        selectedOptions: Array<{
                          optionId: string;
                          optionName: string;
                          price: number;
                          quantity?: number;
                        }>;
                      }>
                    | null
                    | undefined;

                  return (
                    <div
                      key={key}
                      onClick={() => handleCardTap(order)}
                      className={`flex items-center gap-3 md:gap-4 rounded-xl md:rounded-2xl p-3 md:p-4 border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "bg-white/10 border-[#eab3f4]/70"
                          : "bg-white/5 border-white/10"
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className="flex-shrink-0 self-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected && cartItem) {
                            removeItem(cartItem.id);
                          } else {
                            handleCardTap(order);
                          }
                        }}
                      >
                        <div
                          className={`size-4 md:size-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                            isSelected
                              ? "bg-[#eab3f4] border-[#eab3f4]"
                              : "bg-transparent border-white/40"
                          }`}
                        >
                          {isSelected && (
                            <div className="size-1.5 md:size-2 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      {/* Image */}
                      <div className="flex-shrink-0">
                        <div className="size-16 md:size-20 rounded-sm overflow-hidden bg-gray-300">
                          {order.images &&
                          order.images.length > 0 &&
                          order.images[0] ? (
                            <img
                              src={order.images[0]}
                              alt={order.item}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src="/logo-short-green.webp"
                              alt="Logo Even"
                              className="w-full h-full object-contain p-2"
                            />
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base md:text-lg text-white font-medium capitalize">
                          {order.item}
                        </h3>
                        {customFields && customFields.length > 0 && (
                          <div className="text-xs md:text-sm text-gray-400 space-y-0.5 mt-0.5">
                            {customFields.map((field, idx) => (
                              <div key={idx}>
                                {field.selectedOptions.map((opt, optIdx) => (
                                  <p key={optIdx}>
                                    {opt.optionName}
                                    {opt.price > 0 &&
                                      ` $${opt.price.toFixed(2)}`}
                                  </p>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs md:text-sm text-white/60 mt-1">
                          ${(order.price + (order.extra_price || 0)).toFixed(2)}
                        </p>
                      </div>

                      {/* Quantity controls — visible cuando qty > 0 */}
                      {isSelected ? (
                        <div
                          className="flex items-center flex-shrink-0 self-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleDecrement(order)}
                            disabled={cartState.isLoading}
                            className="flex items-center justify-center size-7 md:size-8 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
                          >
                            <Minus className="size-4 md:size-5 text-white" />
                          </button>
                          <span className="text-base md:text-lg text-white w-6 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => handleIncrement(order)}
                            disabled={cartState.isLoading}
                            className="flex items-center justify-center size-7 md:size-8 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30"
                          >
                            <Plus className="size-4 md:size-5 text-white" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 md:px-8 lg:px-10 py-4 md:py-5 border-t border-white/20">
            {hasSelection && (
              <p className="text-white/70 text-sm md:text-base text-right mb-3">
                Subtotal:{" "}
                <span className="text-white font-semibold">
                  ${subtotal.toFixed(2)}
                </span>
              </p>
            )}
            <button
              onClick={handleReorder}
              disabled={!hasSelection || isSubmitting || cartState.isLoading}
              className="w-full bg-gradient-to-r from-[#34808C] to-[#173E44] text-white rounded-full py-3 md:py-4 text-base md:text-lg font-medium transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {(isSubmitting || cartState.isLoading) && (
                <span className="size-4 md:size-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {isSubmitting ? "Enviando..." : "Reordenar"}
            </button>
          </div>
        </div>
      </div>

      {showOrderAnimation && (
        <OrderAnimation
          userName={profile?.firstName || guestName || "Usuario"}
          orderedItems={orderedItems}
          onConfirm={handleConfirmOrder}
          onContinue={handleContinueFromAnimation}
          onCancel={handleCancelOrder}
        />
      )}
    </>
  );
}

export default ReorderModal;
