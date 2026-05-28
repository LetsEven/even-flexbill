"use client";

import { useSearchParams } from "next/navigation";
import { useTable } from "@/app/context/TableContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { useGuest, useIsGuest } from "@/app/context/GuestContext";
import { usePayment } from "@/app/context/PaymentContext";
import { getRestaurantData } from "@/app/utils/restaurantData";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useEcartPay } from "@/app/hooks/useEcartPay";
import MenuHeaderBack from "@/app/components/headers/MenuHeaderBack";
import { apiService } from "@/app/utils/api";
import PaymentAnimation from "@/app/components/UI/PaymentAnimation";
import { useValidateAccess } from "@/app/hooks/useValidateAccess";
import ValidationError from "@/app/components/ValidationError";
import { paymentService } from "@/app/services/payment.service";
import { useAgentStatus } from "@/app/hooks/useAgentStatus";

import { Plus, Trash2, Loader2, CircleAlert, X } from "lucide-react";
import { getCardTypeIcon } from "@/app/utils/cardIcons";
import { usePaymentProvider } from "@/app/hooks/usePaymentProvider";
import { useMsiConfig } from "@/app/hooks/useMsiConfig";

export default function CardSelectionPage() {
  const { validationError, restaurantId, branchNumber } = useValidateAccess();
  const { provider, isLoadingProvider } = usePaymentProvider(restaurantId);
  const { isAgentRequired } = useAgentStatus(
    restaurantId,
    branchNumber ? parseInt(branchNumber) : null,
  );
  const { msiConfig } = useMsiConfig();
  const { state, dispatch, loadTableData } = useTable();
  const { navigateWithTable } = useTableNavigation();
  const searchParams = useSearchParams();
  const restaurantData = getRestaurantData();
  const isGuest = useIsGuest();
  const { guestId, tableNumber, guestName, setAsAuthenticated } = useGuest();
  const { hasPaymentMethods, paymentMethods, deletePaymentMethod } =
    usePayment();
  const { user, profile, isLoading } = useAuth();

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Establecer tableNumber desde URL si no está en el estado
  useEffect(() => {
    const tableFromUrl = searchParams?.get("table");
    if (tableFromUrl && !state.tableNumber) {
      dispatch({ type: "SET_TABLE_NUMBER", payload: tableFromUrl });
    }
  }, [searchParams, state.tableNumber, dispatch]);

  // Tarjeta por defecto del sistema para todos los usuarios

  const defaultSystemCard = {
    id: "system-default-card",
    lastFourDigits: "1234",
    cardBrand: "amex",
    cardType: "credit",
    isDefault: true,
    isSystemCard: true,
  };

  // Combinar tarjetas del sistema con las del usuario
  const allPaymentMethods = [defaultSystemCard, ...paymentMethods];

  const paymentType = searchParams.get("type") || "full-bill";
  const totalAmountCharged = parseFloat(searchParams.get("amount") || "0"); // Total cobrado al cliente
  const baseAmount = parseFloat(searchParams.get("baseAmount") || "0"); // Monto base (consumo)
  const tipAmount = parseFloat(searchParams.get("tipAmount") || "0"); // Propina
  const ivaTip = parseFloat(searchParams.get("ivaTip") || "0"); // IVA propina (no pagado por cliente)
  const evenCommissionClient = parseFloat(
    searchParams.get("evenCommissionClient") || "0",
  );
  const ivaEvenClient = parseFloat(searchParams.get("ivaEvenClient") || "0");
  const evenCommissionRestaurant = parseFloat(
    searchParams.get("evenCommissionRestaurant") || "0",
  );
  const evenCommissionTotal = parseFloat(
    searchParams.get("evenCommissionTotal") || "0",
  );
  const ecartCommissionTotal = parseFloat(
    searchParams.get("ecartCommissionTotal") || "0",
  );
  const userName = searchParams.get("userName");
  const selectedItemsParam = searchParams.get("selectedItems");

  // Calcular valores faltantes
  const evenClientCharge = evenCommissionClient + ivaEvenClient;

  // IVA sobre la comisión del restaurante (16% de evenCommissionRestaurant)
  const ivaEvenRestaurant = evenCommissionRestaurant * 0.16;

  // Cargo total al restaurante (comisión + IVA)
  const evenRestaurantCharge = evenCommissionRestaurant + ivaEvenRestaurant;

  // Subtotal para comisión es el consumo base + propina
  const subtotalForCommission = baseAmount + tipAmount;

  // Tasa aplicada (% total de comisión Even sobre el subtotal)
  const evenRateApplied =
    subtotalForCommission > 0
      ? (evenCommissionTotal / subtotalForCommission) * 100
      : 0;

  useEcartPay();

  //const isDev = process.env.NODE_ENV === "development";

  // Determinar el nombre a usar: prioridad a userName de URL, luego state.currentUserName, luego nombre de usuario autenticado
  const effectiveName =
    userName ||
    state.currentUserName ||
    (profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile?.firstName || "") ||
    "";

  const [name, setName] = useState(effectiveName);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);
  const [paymentAttempts, setPaymentAttempts] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [showPaymentAnimation, setShowPaymentAnimation] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isTableDataReady, setIsTableDataReady] = useState(false);
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [showPaymentOptionsModal, setShowPaymentOptionsModal] = useState(false);
  const [selectedMSI, setSelectedMSI] = useState<number | null>(null);
  const applePayListenersRef = useRef(false);
  const googlePayListenersRef = useRef(false);
  const [applePayReady, setApplePayReady] = useState(false);
  const [applePayUnavailable, setApplePayUnavailable] = useState(false);
  const [isApplePayProcessing, setIsApplePayProcessing] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);
  const [googlePayUnavailable, setGooglePayUnavailable] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      const ua = navigator.userAgent;
      return (
        /iPhone|iPad|iPod/.test(ua) ||
        (ua.includes("Macintosh") &&
          navigator.vendor === "Apple Computer, Inc.")
      );
    },
  );
  const [isGooglePayProcessing, setIsGooglePayProcessing] = useState(false);
  const [googlePayPaymentId, setGooglePayPaymentId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      setAsAuthenticated(user.id);
    }
  }, [isLoading, user, setAsAuthenticated]);

  useEffect(() => {
    // Actualizar nombre cuando cambie effectiveName
    const newName =
      userName ||
      state.currentUserName ||
      (profile?.firstName && profile?.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : profile?.firstName || "") ||
      "";
    if (newName && newName !== name) {
      setName(newName);
    }

    // Configurar usuarios seleccionados según el tipo de pago
    if (userName) {
      setSelectedUsers([userName]);
    }

    // Configurar items seleccionados para select-items
    if (paymentType === "select-items" && selectedItemsParam) {
      setSelectedItems(
        selectedItemsParam.split(",").filter((item) => item.trim() !== ""),
      );
    }
  }, [userName, state.currentUserName, user, paymentType, selectedItemsParam]);

  // Cargar datos de la mesa si no existen en el contexto
  useEffect(() => {
    const loadData = async () => {
      if (state.tableNumber) {
        // Si no hay datos cargados o están desactualizados, cargar
        await loadTableData();
        setIsTableDataReady(true);
      } else if (!state.tableNumber) {
        setIsTableDataReady(true);
      }
    };
    loadData();
  }, [state.tableNumber]);

  // Calcular totales basados en el nuevo sistema de platillos
  const dishOrders = Array.isArray(state.dishOrders) ? state.dishOrders : [];

  // Total de la mesa basado en platillos
  const tableTotalPrice = dishOrders.reduce((sum, dish) => {
    return sum + (dish.total_price || 0);
  }, 0);

  // Platillos no pagados
  const unpaidDishes = dishOrders.filter(
    (dish) => dish.payment_status === "not_paid" || !dish.payment_status,
  );

  // Items para enviar a EcartPay según el tipo de pago
  const getEcartPayItems = () => {
    if (paymentType === "user-items" && userName) {
      return dishOrders
        .filter(
          (d) =>
            (d.payment_status === "not_paid" || !d.payment_status) &&
            d.guest_name === userName,
        )
        .map((d) => ({
          name: d.item,
          price: d.price,
          quantity: d.quantity,
          extraPrice: d.extra_price || 0,
        }));
    }
    if (paymentType === "select-items") {
      return dishOrders
        .filter((d) => selectedItems.includes(d.dish_order_id?.toString()))
        .map((d) => ({
          name: d.item,
          price: d.price,
          quantity: d.quantity,
          extraPrice: d.extra_price || 0,
        }));
    }
    // full-bill, choose-amount, equal-shares: items simplificados que suman el monto exacto
    const items: {
      name: string;
      price: number;
      quantity: number;
      extraPrice: number;
    }[] = [];
    if (baseAmount > 0)
      items.push({
        name: "Consumo",
        price: baseAmount,
        quantity: 1,
        extraPrice: 0,
      });
    if (tipAmount > 0)
      items.push({
        name: "Propina",
        price: tipAmount,
        quantity: 1,
        extraPrice: 0,
      });
    const commission = (evenCommissionClient || 0) + (ivaEvenClient || 0);
    if (commission > 0)
      items.push({
        name: "Cargo por servicio",
        price: commission,
        quantity: 1,
        extraPrice: 0,
      });
    return items;
  };

  const unpaidAmount = unpaidDishes.reduce((sum, dish) => {
    return sum + (dish.total_price || 0);
  }, 0);

  // Set default payment method when payment methods are loaded (only once)
  useEffect(() => {
    const visibleMethods = allPaymentMethods;
    /*.filter(
      (pm) => isDev || pm.id !== "system-default-card",
    );*/
    if (!selectedPaymentMethodId && visibleMethods.length > 0) {
      const defaultMethod =
        visibleMethods.find((pm) => pm.isDefault) || visibleMethods[0];
      setSelectedPaymentMethodId(defaultMethod.id);
    }
    // Set loading to false once we have payment methods data
    setIsLoadingInitial(false);
  }, [allPaymentMethods.length]);

  // Log del proveedor de pago activo
  useEffect(() => {
    if (!isLoadingProvider) {
      if (provider === "clip") {
        console.warn(
          "[PaymentProvider] Clip seleccionado — flujo no implementado aún, usando eCartPay como fallback",
        );
      }
    }
  }, [provider, isLoadingProvider, restaurantId]);

  // Verificar soporte de Apple Pay y cargar el SDK solo si aplica
  useEffect(() => {
    if (isLoadingProvider) return; // esperar a que se resuelva el proveedor

    // Apple Pay solo aplica cuando el proveedor es eCartPay (o null como fallback)
    if (provider !== null && provider !== "ecartpay") return;

    const ApplePaySession = (window as any).ApplePaySession;
    if (!ApplePaySession || !ApplePaySession.canMakePayments?.()) {
      // Dispositivo/navegador no soporta Apple Pay — mantener oculto
      return;
    }

    // Dispositivo compatible y proveedor es eCartPay — cargar SDK
    setApplePayUnavailable(false);
    const src = "https://ecartpay.com/sdk/pay.js";
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [provider, isLoadingProvider]);

  // Verificar soporte de Google Pay y cargar el SDK solo si aplica
  useEffect(() => {
    if (isLoadingProvider) return;

    // Google Pay solo aplica cuando el proveedor es eCartPay (o null como fallback)
    if (provider !== null && provider !== "ecartpay") return;

    // Google Pay no está disponible en iOS — usar Apple Pay
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      setGooglePayUnavailable(true);
      return;
    }

    const src = "https://ecartpay.com/sdk/pay.js";
    if (!document.querySelector(`script[src="${src}"]`)) {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  }, [provider, isLoadingProvider]);

  const handlePaymentSuccess = async (
    paymentId: string,
    amount: number,
    paymentType: string,
  ): Promise<void> => {
    try {
      setIsProcessing(true);

      // OPERACIONES CRÍTICAS (deben completarse antes de mostrar animación)
      // En el nuevo sistema de platillos, necesitamos marcar platillos específicos como pagados
      // Esto dependerá del tipo de pago y los platillos involucrados

      // Determinar el payment_method_id real (null para tarjeta del sistema)
      const realPaymentMethodId =
        selectedPaymentMethodId === "system-default-card"
          ? null
          : selectedPaymentMethodId;

      if (paymentType === "user-items" && userName) {
        // Pagar solo los platillos del usuario específico
        await paymentService.payUserDishes(
          dishOrders,
          userName,
          realPaymentMethodId,
        );
      } else if (paymentType === "select-items") {
        // Pagar solo los platillos seleccionados específicamente
        await paymentService.paySelectedDishes(
          selectedItems,
          realPaymentMethodId,
        );
      } else if (paymentType === "equal-shares") {
        // Para división equitativa, usar paySplitAmount para rastrear qué usuario pagó
        await paymentService.paySplitAmount({
          restaurantId,
          branchNumber,
          tableNumber: state.tableNumber,
          userId: user?.id,
          guestName: !user?.id ? name.trim() : null,
          paymentMethodId: realPaymentMethodId,
        });
      } else if (
        paymentType === "full-bill" ||
        paymentType === "choose-amount"
      ) {
        // Para cuenta completa o monto personalizado, usar el monto exacto
        await paymentService.payTableAmount({
          restaurantId,
          branchNumber,
          tableNumber: state.tableNumber,
          amount: baseAmount,
          userId: user?.id,
          guestName: !user?.id ? name.trim() : null,
          paymentMethodId: realPaymentMethodId,
        });
      }

      // OPERACIONES NO CRÍTICAS (ejecutar en segundo plano)
      // No esperar a que terminen - dejar que se ejecuten mientras se muestra la animación
      const backgroundOperations = async () => {
        try {
          // Recargar datos de la mesa después del pago para reflejar cambios
          await loadTableData();

          // Get table_order_id from any dish order
          const tableOrderId =
            dishOrders.length > 0 && dishOrders[0].table_order_id
              ? dishOrders[0].table_order_id
              : null;

          // Record payment transaction
          // Usar null para tarjeta del sistema, sino usar el selectedPaymentMethodId
          const transactionPaymentMethodId =
            selectedPaymentMethodId === "system-default-card"
              ? null
              : selectedPaymentMethodId;

          // Determinar nombre del pagador
          const transactionBy = isGuest
            ? guestName || "Invitado"
            : [profile?.firstName, profile?.lastName].filter(Boolean).join(" ");

          // Registrar transacción siempre, con o sin table_order_id
          await paymentService.recordPaymentTransaction({
            payment_method_id: transactionPaymentMethodId,
            restaurant_id: parseInt(restaurantId),
            id_table_order: tableOrderId,
            id_tap_orders_and_pay: null,
            base_amount: baseAmount,
            tip_amount: tipAmount,
            iva_tip: ivaTip,
            even_commission_total: evenCommissionTotal,
            even_commission_client: evenCommissionClient,
            even_commission_restaurant: evenCommissionRestaurant,
            iva_even_client: ivaEvenClient,
            iva_even_restaurant: ivaEvenRestaurant,
            even_client_charge: evenCommissionClient + ivaEvenClient,
            even_restaurant_charge: evenRestaurantCharge,
            even_rate_applied: evenRateApplied,
            total_amount_charged: selectedMSI
              ? displayTotal
              : totalAmountCharged,
            subtotal_for_commission: subtotalForCommission,
            currency: "MXN",
            transaction_by: transactionBy,
          });
        } catch (transactionError) {
          console.error("❌ Error in background operations:", transactionError);
          // Don't throw - these are non-critical operations
        }
      };

      // Ejecutar operaciones en segundo plano sin esperar
      backgroundOperations();

      // Store payment success data for payment-success page (rápido, solo localStorage)
      if (typeof window !== "undefined") {
        // Limpiar datos de pago anteriores para que payment-success lea datos frescos
        sessionStorage.removeItem("even-current-payment-key");
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("even-payment-success-"))
            sessionStorage.removeItem(key);
        }

        // Get payment method details
        const selectedMethod = allPaymentMethods.find(
          (pm) => pm.id === selectedPaymentMethodId,
        );

        const successData = {
          paymentId,
          amount,
          paymentType,
          userName: userName || name,
          tableNumber: state.tableNumber,
          dishOrders: dishOrders, // Todos los dish orders de la mesa
          tableSummary: state.tableSummary, // Resumen completo de la mesa
          baseAmount,
          tipAmount,
          ivaTip,
          evenCommissionClient,
          ivaEvenClient,
          evenCommissionRestaurant,
          evenRestaurantCharge,
          evenCommissionTotal,
          totalAmountCharged: selectedMSI ? displayTotal : totalAmountCharged,
          installments: selectedMSI || null,
          installmentBaseAmount: selectedMSI ? totalAmountCharged : null,
          dishCount:
            paymentType === "user-items"
              ? dishOrders.filter((d) => d.guest_name === userName).length
              : paymentType === "select-items"
                ? selectedItems.length
                : unpaidDishes.length,
          selectedItems: paymentType === "select-items" ? selectedItems : [], // Store selected items for filtering
          alreadyProcessed: true,
          // Payment method details
          cardLast4: selectedMethod?.lastFourDigits,
          cardBrand: selectedMethod?.cardType,
        };

        localStorage.setItem(
          "even-completed-payment",
          JSON.stringify(successData),
        );
      }
    } catch (error) {
      console.error("❌ Error processing payment success:", error);
      setIsProcessing(false);
    }
  };

  const handleAnimationComplete = useCallback(() => {
    // Navigate after animation completes
    const paymentId = "completed";
    navigateWithTable(
      `/payment-success?paymentId=${paymentId}&amount=${baseAmount}&type=${paymentType}&processed=true`,
    );
  }, [navigateWithTable, baseAmount, paymentType]);

  const getApplePaySDK = () =>
    new Promise<any>((resolve) => {
      if ((window as any).Pay?.ApplePay) {
        return resolve((window as any).Pay.ApplePay);
      }

      const interval = setInterval(() => {
        if ((window as any).Pay?.ApplePay) {
          clearInterval(interval);
          resolve((window as any).Pay.ApplePay);
        }
      }, 100);
    });

  const getGooglePaySDK = () =>
    new Promise<any>((resolve) => {
      if ((window as any).Pay?.GooglePay) {
        return resolve((window as any).Pay.GooglePay);
      }
      const interval = setInterval(() => {
        if ((window as any).Pay?.GooglePay) {
          clearInterval(interval);
          resolve((window as any).Pay.GooglePay);
        }
      }, 100);
    });

  // Inicializar Apple Pay SDK con ref guard para evitar doble registro de listeners
  useEffect(() => {
    if (
      isLoadingInitial ||
      totalAmountCharged <= 0 ||
      typeof window === "undefined"
    )
      return;
    if (applePayListenersRef.current) return;
    applePayListenersRef.current = true;

    (async () => {
      try {
        const orderResult = await paymentService.createApplePayOrder({
          amount: totalAmountCharged,
          currency: "MXN",
          tableNumber: undefined,
          restaurantId: restaurantId?.toString(),
          baseAmount,
          tipAmount,
          items: getEcartPayItems(),
        });

        const appleOrderId =
          (orderResult as any).orderId ?? orderResult.data?.orderId;
        if (!orderResult.success || !appleOrderId) {
          console.warn("⚠️ Apple Pay: no se pudo crear la orden", orderResult);
          applePayListenersRef.current = false;
          return;
        }

        const sdkAlreadyLoaded = !!(window as any).Pay?.ApplePay;
        const applePaySDK = await getApplePaySDK();
        if (!applePaySDK) {
          console.warn("⚠️ Apple Pay SDK no disponible en window.Pay.ApplePay");
          applePayListenersRef.current = false;
          return;
        }

        applePaySDK.on("ready", () => {
          setTimeout(() => setApplePayReady(true), 2800);
        });
        applePaySDK.on("unavailable", () => setApplePayUnavailable(true));
        applePaySDK.on("cancel", () => setIsApplePayProcessing(false));
        applePaySDK.on("error", (err: any) => {
          console.error("❌ Apple Pay error:", err);
          setIsApplePayProcessing(false);
          setApplePayUnavailable(true);
        });
        applePaySDK.on("success", async () => {
          const mockPaymentId = `apple-pay-${Date.now()}`;
          setIsApplePayProcessing(true);
          await handlePaymentSuccess(mockPaymentId, baseAmount, paymentType);
          setShowPaymentAnimation(true);
        });

        applePaySDK.render({
          container: "#apple-pay-container",
          orderId: appleOrderId,
          amount: totalAmountCharged,
          currency: "MXN",
          countryCode: "MX",
          supportedNetworks: ["visa", "masterCard", "amex"],
          buttonStyle: "black",
          buttonType: "pay",
          borderRadius: "8px",
        });

        if (sdkAlreadyLoaded) {
          setTimeout(() => setApplePayReady(true), 2800);
        }
      } catch (err) {
        applePayListenersRef.current = false;
        console.error("❌ Error inicializando Apple Pay:", err);
      }
    })();
  }, [isLoadingInitial, totalAmountCharged]);

  // Inicializar Google Pay SDK con ref guard para evitar doble registro de listeners
  useEffect(() => {
    if (
      isLoadingInitial ||
      totalAmountCharged <= 0 ||
      typeof window === "undefined"
    )
      return;
    if (googlePayListenersRef.current) return;
    googlePayListenersRef.current = true;

    (async () => {
      try {
        const orderResult = await paymentService.createGooglePayOrder({
          amount: totalAmountCharged,
          currency: "MXN",
          tableNumber: undefined,
          restaurantId: restaurantId?.toString(),
          baseAmount,
          tipAmount,
          items: getEcartPayItems(),
        });

        const googleOrderId =
          (orderResult as any).orderId ?? orderResult.data?.orderId;
        if (!orderResult.success || !googleOrderId) {
          console.warn("⚠️ Google Pay: no se pudo crear la orden", orderResult);
          googlePayListenersRef.current = false;
          return;
        }

        const googleSdkAlreadyLoaded = !!(window as any).Pay?.GooglePay;
        const googlePaySDK = await getGooglePaySDK();
        if (!googlePaySDK) {
          console.warn(
            "⚠️ Google Pay SDK no disponible en window.Pay.GooglePay",
          );
          googlePayListenersRef.current = false;
          return;
        }

        googlePaySDK.on("ready", () => {
          setTimeout(() => setGooglePayReady(true), 2800);
        });
        googlePaySDK.on("unavailable", () => setGooglePayUnavailable(true));
        googlePaySDK.on("cancel", () => setIsGooglePayProcessing(false));
        googlePaySDK.on("error", (err: any) => {
          console.error("❌ Google Pay error:", err);
          setIsGooglePayProcessing(false);
          setGooglePayUnavailable(true);
        });
        googlePaySDK.on("success", async (event: any) => {
          const mockPaymentId = event?.detail?.id || `google-pay-${Date.now()}`;
          setGooglePayPaymentId(mockPaymentId);
          setIsGooglePayProcessing(true);
          await handlePaymentSuccess(mockPaymentId, baseAmount, paymentType);
          setShowPaymentAnimation(true);
        });

        googlePaySDK.render({
          container: "#google-pay-container",
          orderId: googleOrderId,
          amount: totalAmountCharged,
          currency: "MXN",
          countryCode: "MX",
          allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX"],
          allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
          buttonColor: "black",
          buttonType: "pay",
        });

        if (googleSdkAlreadyLoaded) {
          setTimeout(() => setGooglePayReady(true), 2800);
        }
      } catch (err) {
        googlePayListenersRef.current = false;
        console.error("❌ Error inicializando Google Pay:", err);
      }
    })();
  }, [isLoadingInitial, totalAmountCharged]);

  const handlePayment = async (): Promise<void> => {
    // Validar selección de tarjeta si hay métodos de pago disponibles
    if (!selectedPaymentMethodId) {
      setErrorMessage("Por favor selecciona una tarjeta de pago");
      return;
    }

    setIsProcessing(true);

    try {
      // Set guest and table info for API service
      if (isGuest && guestId) {
        apiService.setGuestInfo(
          guestId,
          state.tableNumber || tableNumber || undefined,
        );
      }

      // Si se seleccionó la tarjeta del sistema, procesar pago directamente sin EcartPay
      if (selectedPaymentMethodId === "system-default-card") {
        // Simular un pago exitoso y procesar directamente
        const mockPaymentId = `system-payment-${Date.now()}`;

        await handlePaymentSuccess(mockPaymentId, baseAmount, paymentType);

        // Mostrar animación de pago
        setShowPaymentAnimation(true);
        return;
      }

      // Para tarjetas reales, continuar con el flujo normal de EcartPay
      // Check if user has payment methods
      const paymentMethodsResult = await paymentService.getPaymentMethods();

      if (!paymentMethodsResult.success) {
        throw new Error(
          paymentMethodsResult.error?.message ||
            "Failed to fetch payment methods",
        );
      }

      if (
        !paymentMethodsResult.data?.paymentMethods ||
        paymentMethodsResult.data.paymentMethods.length === 0
      ) {
        // No payment methods, redirect to add card page
        setIsProcessing(false);

        const queryParams = new URLSearchParams({
          amount: totalAmountCharged.toString(), // Total cobrado al cliente
          baseAmount: baseAmount.toString(), // Monto base (consumo)
          tipAmount: tipAmount.toString(),
          ivaTip: ivaTip.toString(),
          evenCommissionClient: evenCommissionClient.toString(),
          ivaEvenClient: ivaEvenClient.toString(),
          evenCommissionRestaurant: evenCommissionRestaurant.toString(),
          evenRestaurantCharge: evenRestaurantCharge.toString(),
          evenCommissionTotal: evenCommissionTotal.toString(),
          type: paymentType,
          ...(userName && { userName }),
        });

        navigateWithTable(`/add-card?${queryParams.toString()}`);
        return;
      }

      // Determinar qué método de pago usar
      const paymentMethods = paymentMethodsResult.data.paymentMethods;
      let paymentMethodToUse;

      if (!isGuest && selectedPaymentMethodId) {
        // Usuario registrado: usar tarjeta seleccionada
        paymentMethodToUse = paymentMethods.find(
          (pm) => pm.id === selectedPaymentMethodId,
        );
        if (!paymentMethodToUse) {
          throw new Error("Tarjeta seleccionada no encontrada");
        }
      } else {
        // Usuario invitado o fallback: usar tarjeta predeterminada/primera
        paymentMethodToUse =
          paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0];
      }

      // Process payment directly with selected/default payment method
      const paymentData = {
        paymentMethodId: paymentMethodToUse.id,
        amount: totalAmountCharged,
        currency: "MXN",
        description: `Even Restaurant Payment - Table ${tableNumber || state.tableNumber || "N/A"}${userName ? ` - ${userName}` : ""} - Tip: $${tipAmount.toFixed(2)} - Commission: $${(evenCommissionClient + ivaEvenClient).toFixed(2)}`,
        orderId: `order-${Date.now()}-attempt-${paymentAttempts + 1}`,
        tableNumber: tableNumber || state.tableNumber,
        restaurantId: restaurantId,
        installments: selectedMSI || undefined,
        baseAmount,
        tipAmount,
        items:
          selectedMSI ||
          (paymentType !== "user-items" && paymentType !== "select-items")
            ? undefined
            : getEcartPayItems(),
      };

      const paymentResult = await paymentService.processPayment(paymentData);

      if (!paymentResult.success) {
        console.error("❌ Payment failed:", paymentResult.error);
        throw new Error(
          paymentResult.error?.message || "Payment processing failed",
        );
      }

      const payment = paymentResult.data?.payment;
      const order = paymentResult.data?.order;

      if (
        payment?.type === "direct_charge" ||
        (payment && !payment.payLink && !order?.payLink)
      ) {
        await handlePaymentSuccess(payment.id, baseAmount, paymentType); // Usar baseAmount, no totalAmountWithTip

        // Show payment animation after processing
        setShowPaymentAnimation(true);
        return;
      }

      // Check if we have a payLink (fallback to EcartPay verification)
      const payLink = order?.payLink || payment?.payLink;
      if (payLink) {
        // Store order details for later reference
        if (typeof window !== "undefined") {
          // Get payment method details
          const selectedMethod = paymentMethods.find(
            (pm) => pm.id === selectedPaymentMethodId,
          );

          const paymentData = {
            orderId: order?.id || payment?.id,
            amount: baseAmount, // Monto base para BD (consumo)
            paymentType,
            userName: userName || name,
            tableNumber: state.tableNumber,
            dishOrders: dishOrders, // Todos los dish orders de la mesa
            tableSummary: state.tableSummary, // Resumen completo de la mesa
            baseAmount,
            tipAmount,
            ivaTip,
            evenCommissionClient,
            ivaEvenClient,
            evenCommissionRestaurant,
            evenRestaurantCharge,
            evenCommissionTotal,
            totalAmountCharged, // Total cobrado al cliente
            selectedItems: paymentType === "select-items" ? selectedItems : [], // Store selected items for filtering
            // Payment method details
            cardLast4: selectedMethod?.lastFourDigits,
            cardBrand: selectedMethod?.cardType,
          };

          localStorage.setItem(
            "even-pending-payment",
            JSON.stringify(paymentData),
          );
        }

        setPaymentAttempts((prev) => prev + 1);
        window.location.href = payLink;
        return;
      }

      if (payment || order) {
        const paymentId = payment?.id || order?.id || "completed";

        await handlePaymentSuccess(paymentId, baseAmount, paymentType); // Usar baseAmount, no totalAmountWithTip

        // Show payment animation after processing
        setShowPaymentAnimation(true);
        return;
      }

      throw new Error("Formato de respuesta de pago inesperado");
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Error desconocido";
      const errorTranslations: Record<string, string> = {
        "Transaction rejected by your bank, please try another card.":
          "Tu banco rechazó la transacción. Por favor intenta con otra tarjeta.",
        "Insufficient funds":
          "Fondos insuficientes. Por favor intenta con otra tarjeta.",
        "Card expired":
          "Tu tarjeta está vencida. Por favor agrega una tarjeta vigente.",
        "Invalid card number": "Número de tarjeta inválido.",
        "An unknown error occurred":
          "Ocurrió un error al procesar el pago. Por favor intenta de nuevo.",
      };
      setErrorMessage(errorTranslations[rawMessage] ?? rawMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddCard = (): void => {
    const queryParams = new URLSearchParams({
      amount: totalAmountCharged.toString(), // Total cobrado al cliente
      baseAmount: baseAmount.toString(), // Monto base (consumo)
      tipAmount: tipAmount.toString(),
      ivaTip: ivaTip.toString(),
      evenCommissionClient: evenCommissionClient.toString(),
      ivaEvenClient: ivaEvenClient.toString(),
      evenCommissionRestaurant: evenCommissionRestaurant.toString(),
      evenRestaurantCharge: evenRestaurantCharge.toString(),
      evenCommissionTotal: evenCommissionTotal.toString(),
      type: paymentType,
      scan: "false", // Auto-abrir scanner
      ...(userName && { userName }),
    });

    navigateWithTable(`/add-card?${queryParams.toString()}`);
  };

  const handleDeleteCard = async (paymentMethodId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta tarjeta?")) {
      return;
    }

    setDeletingCardId(paymentMethodId);
    try {
      await deletePaymentMethod(paymentMethodId);
    } catch (error) {
      setErrorMessage("Error al eliminar la tarjeta. Intenta de nuevo.");
    } finally {
      setDeletingCardId(null);
    }
  };

  // Calcular el total a mostrar según la opción MSI seleccionada
  const getDisplayTotal = () => {
    if (selectedMSI === null) {
      return totalAmountCharged;
    }

    // Obtener el tipo de tarjeta seleccionada
    const selectedMethod = allPaymentMethods.find(
      (pm) => pm.id === selectedPaymentMethodId,
    );
    const cardBrand = selectedMethod?.cardBrand;

    const msiOptions = cardBrand === "amex" ? msiConfig.amex : msiConfig.visaMc;

    const selectedOption = msiOptions.find((opt) => opt.months === selectedMSI);
    if (!selectedOption) return totalAmountCharged;

    // Cálculo EcartPay: markup sobre monto final
    return totalAmountCharged / (1 - (selectedOption.rate / 100) * 1.16);
  };

  const displayTotal = getDisplayTotal();

  const MINIMUM_AMOUNT = 20;
  const isUnderMinimum = totalAmountCharged < MINIMUM_AMOUNT;

  if (isLoadingInitial || isLoadingProvider) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
        <MenuHeaderBack
          restaurant={restaurantData}
          tableNumber={state.tableNumber}
        />

        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
          {/* Título skeleton */}
          <div className="bg-gradient-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
            <div className="py-6 px-8 flex flex-col justify-center">
              <div className="h-8 w-3/4 bg-white/20 rounded-full mt-2 mb-6 animate-pulse" />
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white rounded-t-4xl flex-1 flex flex-col px-8 overflow-hidden z-10">
              <div className="flex-1 overflow-y-auto py-8 pb-[120px] flex flex-col gap-4">
                {/* Subtotal row */}
                <div className="flex justify-between items-center">
                  <div className="h-4 w-20 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse" />
                </div>
                {/* Total row */}
                <div className="flex justify-between items-center border-t pt-3">
                  <div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse" />
                  <div className="h-5 w-28 bg-gray-200 rounded-full animate-pulse" />
                </div>

                {/* Label métodos de pago */}
                <div className="h-4 w-36 bg-gray-200 rounded-full animate-pulse mt-1" />

                {/* Card skeleton 1 */}
                <div className="h-12 w-full bg-gray-100 rounded-full animate-pulse" />
                {/* Card skeleton 2 */}
                <div className="h-12 w-full bg-gray-100 rounded-full animate-pulse" />

                {/* Botón agregar tarjeta */}
                <div className="h-12 w-full bg-gray-100 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior fija — skeleton */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-white mx-4 px-8 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-3 mt-6 mb-2 justify-between items-center">
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-6 w-28 bg-gray-200 rounded-full animate-pulse" />
            </div>
            <div className="h-12 w-36 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error de validación si existe
  if (validationError) {
    return <ValidationError errorType={validationError as any} />;
  }

  return (
    <>
      <PaymentAnimation
        isActive={showPaymentAnimation}
        onAnimationComplete={handleAnimationComplete}
      />

      <div
        className={`min-h-dvh bg-gradient-to-br from-[#0a8b9b] to-[#153f43] flex flex-col ${showPaymentAnimation ? "animate-fade-out" : ""}`}
      >
        {/* Header */}
        <MenuHeaderBack
          restaurant={restaurantData}
          tableNumber={state.tableNumber}
        />

        {/* Contenido scrolleable */}
        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
          <div className="bg-gradient-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
            <div className="py-6 px-8 flex flex-col justify-center">
              <h1 className="font-medium text-white text-3xl leading-7 mt-2 mb-6">
                Selecciona tu método de pago
              </h1>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white rounded-t-4xl flex-1 flex flex-col px-8 overflow-hidden z-50">
              <div className="flex-1 overflow-y-auto py-8 pb-[120px]">
                {/* Payment Summary */}
                <div className="space-y-2 mb-6">
                  {/* Resumen compacto del pedido */}
                  <div className="mb-3 space-y-2">
                    <div className="flex justify-between items-center text-base font-medium text-black">
                      <span>Subtotal</span>
                      <span>${baseAmount.toFixed(2)} MXN</span>
                    </div>
                    {tipAmount > 0 && (
                      <div className="flex justify-between items-center text-base font-medium text-black">
                        <span>Propina</span>
                        <span>${tipAmount.toFixed(2)} MXN</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                        Total a pagar
                      </span>
                      <CircleAlert
                        className="size-4 cursor-pointer text-gray-500"
                        strokeWidth={2.3}
                        onClick={() => setShowTotalModal(true)}
                      />
                    </div>
                    <div className="text-right">
                      {selectedMSI !== null ? (
                        <>
                          <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                            ${(displayTotal / selectedMSI).toFixed(2)} MXN x{" "}
                            {selectedMSI} meses
                          </span>
                        </>
                      ) : (
                        <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                          ${displayTotal.toFixed(2)} MXN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payment Options - Solo mostrar si es tarjeta de crédito */}
                  {(() => {
                    const selectedMethod = allPaymentMethods.find(
                      (pm) => pm.id === selectedPaymentMethodId,
                    );
                    return selectedMethod?.cardType === "credit" &&
                      msiConfig.isActive &&
                      totalAmountCharged >= 300 ? (
                      <div
                        className="py-2 cursor-pointer"
                        onClick={() => setShowPaymentOptionsModal(true)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-black text-base md:text-lg lg:text-xl">
                            Pago a meses
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedMSI !== null
                                ? "border-[#eab3f4] bg-[#eab3f4]"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedMSI !== null && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* Payment Method Selection - Siempre mostrar (incluye tarjeta del sistema) */}
                <div>
                  {/*
                <h3 className="text-sm font-medium text-black mb-4">
                  Selecciona tu método de pago
                </h3>*/}

                  {/* Payment Method Type Toggle */}
                  {/*
                <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                  <button
                    onClick={() => setPaymentMethodType("saved")}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      paymentMethodType === "saved"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Tarjetas guardadas
                  </button>
                   <button
                    onClick={() => setPaymentMethodType("new")}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      paymentMethodType === "new"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Nueva tarjeta
                  </button>
                </div>
                */}

                  {/* Saved Cards List */}
                  <div className="space-y-2.5 mb-2.5">
                    <h3 className="text-black font-medium mb-3">
                      Métodos de pago
                    </h3>
                    {allPaymentMethods
                      //.filter((pm) => isDev || pm.id !== "system-default-card")
                      .map((method) => (
                        <div
                          key={method.id}
                          className={`flex items-center py-1.5 px-5 pl-10 border rounded-full transition-colors ${
                            selectedPaymentMethodId === method.id
                              ? "border-teal-500 bg-teal-50"
                              : "border-black/50  bg-[#f9f9f9]"
                          }`}
                        >
                          <div
                            onClick={() => {
                              setSelectedPaymentMethodId(method.id);
                              setSelectedMSI(null);
                            }}
                            className="flex items-center justify-center gap-3 mx-auto cursor-pointer text-base md:text-lg lg:text-xl"
                          >
                            <div>{getCardTypeIcon(method.cardBrand)}</div>
                            <div>
                              <p className="text-black">
                                **** {method.lastFourDigits}
                              </p>
                            </div>
                          </div>

                          <div
                            onClick={() => {
                              setSelectedPaymentMethodId(method.id);
                              setSelectedMSI(null);
                            }}
                            className={`w-4 h-4 rounded-full border-2 cursor-pointer ${
                              selectedPaymentMethodId === method.id
                                ? "border-teal-500 bg-teal-500"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedPaymentMethodId === method.id && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>

                          {/* Delete Button - No mostrar para tarjeta del sistema */}
                          {!method.isSystemCard && (
                            <button
                              onClick={() => handleDeleteCard(method.id)}
                              disabled={deletingCardId === method.id}
                              className="pl-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                              title="Eliminar tarjeta"
                            >
                              {deletingCardId === method.id ? (
                                <Loader2 className="size-5 animate-spin" />
                              ) : (
                                <Trash2 className="size-5" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}

                    {/* Apple Pay Button */}
                    {!applePayUnavailable && (
                      <div className="relative w-full h-[48px]">
                        <div id="apple-pay-container" className="w-full" />
                        {!applePayReady && (
                          <div className="absolute inset-0 rounded-full bg-black flex items-center justify-center gap-2">
                            <span
                              className="text-white text-xl leading-none"
                              style={{
                                fontFamily:
                                  "-apple-system, BlinkMacSystemFont, sans-serif",
                              }}
                              aria-hidden="true"
                            >
                              {""}
                            </span>
                            <span className="text-white font-medium text-base tracking-wide">
                              Pay
                            </span>
                            <Loader2 className="size-4 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Google Pay Button */}
                    {!googlePayUnavailable && (
                      <div className="relative w-full h-[48px]">
                        <div id="google-pay-container" className="w-full" />
                        {!googlePayReady && (
                          <div className="absolute inset-0 rounded-full bg-black flex items-center justify-center gap-2">
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 18 18"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                                fill="#4285F4"
                              />
                              <path
                                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                                fill="#34A853"
                              />
                              <path
                                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                                fill="#FBBC05"
                              />
                              <path
                                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                                fill="#EA4335"
                              />
                            </svg>
                            <span className="text-white font-medium text-base tracking-wide">
                              Pay
                            </span>
                            <Loader2 className="size-4 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botón agregar tarjeta */}
                <div className="mb-2.5">
                  <button
                    onClick={handleAddCard}
                    className="border border-black/50 flex justify-center items-center gap-1 w-full text-black py-3 rounded-full cursor-pointer transition-colors bg-[#f9f9f9] hover:bg-gray-100 text-base md:text-lg lg:text-xl"
                  >
                    <Plus className="size-5" />
                    Agregar método de pago
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior fija — botón pagar */}
        <div
          className={`fixed bottom-0 left-0 right-0 bg-white mx-4 px-8 z-90 py-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-opacity duration-200 ${showPaymentAnimation ? "opacity-0 pointer-events-none" : ""}`}
        >
          {isAgentRequired && (
            <p className="text-red-500 text-xs text-center mb-4">
              El sistema de caja no está disponible en este momento. Intenta más
              tarde.
            </p>
          )}
          <button
            onClick={handlePayment}
            disabled={isProcessing || isUnderMinimum || isAgentRequired}
            className={`py-3 text-white rounded-full cursor-pointer font-normal h-fit w-full flex items-center justify-center text-base active:scale-95 transition-transform ${
              isProcessing ||
              isUnderMinimum ||
              isAgentRequired ||
              (hasPaymentMethods && !selectedPaymentMethodId)
                ? "bg-gradient-to-r from-[#34808C] to-[#173E44] opacity-50 cursor-not-allowed px-10"
                : "bg-gradient-to-r from-[#34808C] to-[#173E44] px-10 animate-pulse-button"
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Procesando...</span>
              </div>
            ) : isUnderMinimum ? (
              `Mínimo $${MINIMUM_AMOUNT} MXN`
            ) : hasPaymentMethods && !selectedPaymentMethodId ? (
              "Selecciona una tarjeta"
            ) : (
              "Pagar"
            )}
          </button>
        </div>

        {/* Modal de resumen del total */}
        {showTotalModal && (
          <div
            className="fixed inset-0 flex items-end justify-center backdrop-blur-sm"
            style={{ zIndex: 99999 }}
          >
            {/* Fondo */}
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setShowTotalModal(false)}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-t-4xl w-full mx-4">
              {/* Titulo */}
              <div className="px-6 pt-4">
                <div className="flex items-center justify-between pb-4 border-b border-[#8e8e8e]">
                  <h3 className="text-lg font-semibold text-black">
                    Resumen del total
                  </h3>
                  <button
                    onClick={() => setShowTotalModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="size-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="px-6 py-4">
                <p className="text-black mb-4">
                  El total se obtiene de la suma de:
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-black font-medium">+ Consumo</span>
                    <span className="text-black font-medium">
                      ${baseAmount.toFixed(2)} MXN
                    </span>
                  </div>
                  {tipAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-black font-medium">+ Propina</span>
                      <span className="text-black font-medium">
                        ${tipAmount.toFixed(2)} MXN
                      </span>
                    </div>
                  )}
                  {evenCommissionClient + ivaEvenClient > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-black font-medium">
                        + Comisión de servicio
                      </span>
                      <span className="text-black font-medium">
                        ${(evenCommissionClient + ivaEvenClient).toFixed(2)} MXN
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de opciones de pago */}
        {showPaymentOptionsModal && (
          <div
            className="fixed inset-0 flex items-end justify-center backdrop-blur-sm"
            style={{ zIndex: 99999 }}
          >
            {/* Fondo */}
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setShowPaymentOptionsModal(false)}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-t-4xl w-full mx-4 max-h-[70vh] overflow-y-auto">
              {/* Titulo */}
              <div className="px-6 pt-4 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between pb-4 border-b border-[#8e8e8e]">
                  <h3 className="text-lg font-semibold text-black">
                    Opciones de pago
                  </h3>
                  <button
                    onClick={() => setShowPaymentOptionsModal(false)}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="size-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="px-6 py-4">
                {(() => {
                  const selectedMethod = allPaymentMethods.find(
                    (pm) => pm.id === selectedPaymentMethodId,
                  );
                  const cardBrand = selectedMethod?.cardBrand;

                  const msiOptions =
                    cardBrand === "amex" ? msiConfig.amex : msiConfig.visaMc;

                  return (
                    <div className="space-y-2.5">
                      {/* Opción: Pago completo */}
                      <div
                        onClick={() => setSelectedMSI(null)}
                        className={`py-2 px-5 border rounded-full cursor-pointer transition-colors ${
                          selectedMSI === null
                            ? "border-teal-500 bg-teal-50"
                            : "border-black/50 bg-[#f9f9f9] hover:border-gray-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-black text-base md:text-lg">
                              Pago completo
                            </p>
                            <p className="text-xs md:text-sm text-gray-600">
                              ${totalAmountCharged.toFixed(2)} MXN
                            </p>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedMSI === null
                                ? "border-teal-500 bg-teal-500"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedMSI === null && (
                              <div className="w-full h-full rounded-full bg-white scale-50"></div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Separador */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">
                            Pago a meses
                          </span>
                        </div>
                      </div>

                      {/* Opciones MSI */}
                      {(() => {
                        const availableOptions = msiOptions.filter(
                          (option) => totalAmountCharged >= option.minAmount,
                        );
                        const hasUnavailableOptions =
                          availableOptions.length < msiOptions.length;
                        const minAmountNeeded = msiOptions[0]?.minAmount || 0;

                        return (
                          <>
                            {availableOptions.map((option) => {
                              // Cálculo EcartPay: markup sobre monto final
                              const totalWithCommission =
                                totalAmountCharged /
                                (1 - (option.rate / 100) * 1.16);
                              const monthlyPayment =
                                totalWithCommission / option.months;

                              return (
                                <div
                                  key={option.months}
                                  onClick={() => setSelectedMSI(option.months)}
                                  className={`py-2 px-5 border rounded-full cursor-pointer transition-colors ${
                                    selectedMSI === option.months
                                      ? "border-teal-500 bg-teal-50"
                                      : "border-black/50 bg-[#f9f9f9] hover:border-gray-400"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-black text-base md:text-lg">
                                        ${monthlyPayment.toFixed(2)} MXN x{" "}
                                        {option.months} meses
                                      </p>
                                      <p className="text-xs md:text-sm text-gray-600">
                                        Total ${totalWithCommission.toFixed(2)}{" "}
                                        MXN
                                      </p>
                                    </div>
                                    <div
                                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                        selectedMSI === option.months
                                          ? "border-teal-500 bg-teal-500"
                                          : "border-gray-300"
                                      }`}
                                    >
                                      {selectedMSI === option.months && (
                                        <div className="w-full h-full rounded-full bg-white scale-50"></div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {hasUnavailableOptions &&
                              totalAmountCharged < minAmountNeeded && (
                                <p className="text-xs md:text-sm text-gray-500 text-center mt-2">
                                  Monto mínimo ${minAmountNeeded.toFixed(2)} MXN
                                  para pagos a meses
                                </p>
                              )}
                          </>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>

              {/* Footer con botón de confirmar */}
              <div className="px-6 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
                <button
                  onClick={() => setShowPaymentOptionsModal(false)}
                  className="w-full bg-gradient-to-r from-[#34808C] to-[#173E44] text-white py-3 rounded-full cursor-pointer transition-colors text-base"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de error de pago */}
      {errorMessage && (
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50"
          onClick={() => setErrorMessage(null)}
        >
          <div
            className="bg-white rounded-t-4xl w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 max-w-2xl mx-auto">
              <div className="flex flex-col items-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <CircleAlert
                    className="size-7 text-red-500"
                    strokeWidth={2}
                  />
                </div>
                <h2 className="text-xl font-semibold text-black text-center">
                  Error al procesar el pago
                </h2>
              </div>

              <div className="bg-[#f9f9f9] border border-[#bfbfbf]/50 rounded-xl p-4 mb-6">
                <p className="text-gray-700 text-sm text-center">
                  {errorMessage}
                </p>
              </div>

              <button
                onClick={() => setErrorMessage(null)}
                className="w-full bg-gradient-to-r from-[#34808C] to-[#173E44] text-white py-3 rounded-full text-base"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
