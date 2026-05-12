"use client";

// NOTE: This page is maintained for users who want to manage payment methods separately
// Main payment flows now use EcartPay SDK directly in payment/page.tsx and add-tip/page.tsx

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@/app/context/TableContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { useGuest, useIsGuest } from "@/app/context/GuestContext";
import { usePayment } from "@/app/context/PaymentContext";
import { getRestaurantData } from "@/app/utils/restaurantData";
import { apiService } from "@/app/utils/api";
import MenuHeaderBack from "@/app/components/headers/MenuHeaderBack";
import CardScanner from "@/app/components/CardScanner";
import Loader from "@/app/components/UI/Loader";
import { useAuth } from "@/app/context/AuthContext";

function AddCardContent() {
  const { state } = useTable();
  const { navigateWithTable } = useTableNavigation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantData = getRestaurantData();
  const isGuestUser = useIsGuest();
  const { guestId, tableNumber } = useGuest();
  const { addPaymentMethod, refreshPaymentMethods, paymentMethods } =
    usePayment();
  const { user } = useAuth();

  const [fullName, setFullName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expDate, setExpDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isLoadingParams, setIsLoadingParams] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    cardNumber?: string;
    expDate?: string;
    cvv?: string;
    general?: string;
  }>({});

  // Refresh payment methods on mount to ensure we have the latest data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    refreshPaymentMethods();
  }, []);

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const textOnlyRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]*$/;

    if (textOnlyRegex.test(value)) {
      setFullName(value);
      if (errors.fullName)
        setErrors((prev) => ({ ...prev, fullName: undefined }));
    }
  };

  const fillTestCard = () => {
    setFullName("Test User");
    setCardNumber("4242 4242 4242 4242");
    setExpDate("12/25");
    setCvv("123");
  };

  const handleSave = async () => {
    const newErrors: typeof errors = {};

    if (!fullName.trim()) newErrors.fullName = "Ingresa tu nombre completo";
    if (!cardNumber.trim())
      newErrors.cardNumber = "Ingresa el número de tarjeta";
    if (!expDate.trim()) newErrors.expDate = "Ingresa la fecha de expiración";
    if (!cvv.trim()) newErrors.cvv = "Ingresa el CVV";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Validar tarjeta repetida
    const lastFourDigits = cardNumber
      .replace(/\s+/g, "")
      .slice(-4)
      .substring(0, 3);
    const isDuplicate = paymentMethods.some(
      (method) => method.lastFourDigits === lastFourDigits,
    );

    if (isDuplicate) {
      setErrors({
        cardNumber: `Ya existe una tarjeta terminada en ${lastFourDigits}`,
      });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      if (user) {
        console.log("💳 Adding card for registered user:", user.id);
      } else if (isGuestUser && guestId && tableNumber) {
        console.log("💳 Adding card for guest:", guestId);
        apiService.setGuestInfo(guestId, tableNumber.toString());
      }

      const result = await apiService.addPaymentMethod({
        fullName,
        cardNumber,
        expDate,
        cvv,
      });

      if (result.success) {
        if (result.data?.paymentMethod) {
          addPaymentMethod(result.data.paymentMethod);
        } else {
          await refreshPaymentMethods();
        }

        // Force refresh para garantizar sync con el servidor
        await refreshPaymentMethods();

        // Check if we came from saved-cards page
        const fromSavedCards = document.referrer.includes("/saved-cards");

        if (fromSavedCards) {
          navigateWithTable("/saved-cards");
        } else {
          router.back();
        }
      } else {
        setErrors({
          general:
            result.error?.message ||
            "No se pudo agregar la tarjeta. Intenta de nuevo.",
        });
      }
    } catch (error) {
      console.error("Error saving card:", error);
      setErrors({
        general:
          "No se pudo agregar la tarjeta. Verifica tu conexión e intenta de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatExpDate = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numbersOnlyRegex = /^[0-9\s]*$/;

    if (numbersOnlyRegex.test(value)) {
      const formatted = formatCardNumber(value);
      setCardNumber(formatted);
      if (errors.cardNumber)
        setErrors((prev) => ({ ...prev, cardNumber: undefined }));
    }
  };

  const handleExpDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const expDateRegex = /^[0-9/]*$/;

    if (expDateRegex.test(value)) {
      const formatted = formatExpDate(value);
      setExpDate(formatted);
      if (errors.expDate)
        setErrors((prev) => ({ ...prev, expDate: undefined }));
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numbersOnlyRegex = /^[0-9]*$/;

    if (numbersOnlyRegex.test(value)) {
      setCvv(value.substring(0, 4));
      if (errors.cvv) setErrors((prev) => ({ ...prev, cvv: undefined }));
    }
  };

  const handleScanSuccess = (result: {
    cardNumber: string;
    expiryDate: string;
    cardholderName: string;
  }) => {
    // Auto-completar campos con datos escaneados
    setCardNumber(formatCardNumber(result.cardNumber));
    setExpDate(result.expiryDate);
    setFullName(result.cardholderName);
    setShowScanner(false);
  };

  // Auto-abrir scanner si viene el parámetro scan=true
  useEffect(() => {
    const shouldAutoScan = searchParams.get("scan") === "true";
    if (shouldAutoScan) {
      setShowScanner(true);
    }
    // Marcar que ya terminó de leer los parámetros
    setIsLoadingParams(false);
  }, [searchParams]);

  if (isLoadingParams) {
    return <Loader />;
  }

  return (
    <>
      {showScanner && (
        <CardScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="min-h-new bg-gradient-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
        <MenuHeaderBack
          restaurant={restaurantData}
          tableNumber={state.tableNumber}
        />

        <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col justify-end">
          <div className="left-4 right-4 bg-gradient-to-tl from-[#0a8b9b] to-[#1d727e] rounded-t-4xl translate-y-7 z-0">
            <div className="pt-6 md:pt-7 lg:pt-8 pb-12 md:pb-14 lg:pb-16 px-8 md:px-10 lg:px-12 flex flex-col justify-center">
              <h2 className="font-medium text-white text-3xl md:text-4xl lg:text-5xl leading-7 mt-2 md:mt-3 lg:mt-4 mb-2 md:mb-3 lg:mb-4">
                Agrega tu tarjeta para continuar
              </h2>
              <p className="text-white/80 text-sm md:text-base lg:text-lg">
                Tu tarjeta se guardará de forma segura para pagos futuros
              </p>
            </div>
          </div>

          <div className="flex-1 h-full flex flex-col">
            <div className="min-h-full bg-white rounded-t-4xl flex-1 z-5 flex flex-col px-6 md:px-8 lg:px-10 py-6 md:py-8 lg:py-10">
              {/* Test Card Helper */}
              {process.env.NODE_ENV === "development" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-800 font-medium text-sm">
                        Development Mode
                      </p>
                      <p className="text-blue-600 text-xs">
                        Use eCartpay test card data
                      </p>
                    </div>
                    <button
                      onClick={fillTestCard}
                      className="px-3 py-2 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Fill Test Card
                    </button>
                  </div>
                </div>
              )}
              {/* Add Card Form */}
              <div className="space-y-4 md:space-x-5 text-sm md:text-base lg:text-lg">
                <div>
                  <label className="block text-gray-700 mb-2">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={handleFullNameChange}
                    placeholder="John Doe"
                    className={`w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 border text-black rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent ${errors.fullName ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                  />
                  {errors.fullName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.fullName}
                    </p>
                  )}
                </div>

                <div className="text-sm md:text-base lg:text-lg">
                  <label className="block text-gray-700 mb-2">
                    Número de tarjeta
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="**** 2098"
                    maxLength={19}
                    className={`w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 text-black rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent ${errors.cardNumber ? "border border-red-500 bg-red-50" : "bg-gray-100 border border-gray-200"}`}
                  />
                  {errors.cardNumber && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.cardNumber}
                    </p>
                  )}
                </div>

                {/* Exp Date Field */}
                <div className="text-sm md:text-base lg:text-lg">
                  <label className="block text-gray-700 mb-2">
                    Fecha de expiración
                  </label>
                  <input
                    type="text"
                    value={expDate}
                    onChange={handleExpDateChange}
                    placeholder="02/24"
                    maxLength={5}
                    className={`w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent text-black ${errors.expDate ? "border border-red-500 bg-red-50" : "bg-gray-100 border border-gray-200"}`}
                  />
                  {errors.expDate && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.expDate}
                    </p>
                  )}
                </div>

                {/* CVV Field */}
                <div className="text-sm md:text-base lg:text-lg">
                  <label className="block text-gray-700 mb-2">CVV</label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={handleCvvChange}
                    placeholder="123"
                    maxLength={4}
                    className={`w-full px-4 md:px-5 lg:px-6 py-3 md:py-4 lg:py-5 text-black rounded-lg focus:outline-none focus:ring focus:ring-teal-500 focus:border-transparent ${errors.cvv ? "border border-red-500 bg-red-50" : "border border-gray-300"}`}
                  />
                  {errors.cvv && (
                    <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="bg-black hover:bg-stone-950 text-base md:text-lg lg:text-xl w-full text-white py-3 md:py-4 lg:py-5 rounded-full cursor-pointer transition-colors mt-8 disabled:bg-stone-600 disabled:cursor-not-allowed"
              >
                {isLoading ? "Guardando..." : "Guardar"}
              </button>
              {errors.general && (
                <p className="text-red-500 text-sm text-center mt-3">
                  {errors.general}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AddCardPage() {
  return (
    <Suspense fallback={<Loader />}>
      <AddCardContent />
    </Suspense>
  );
}
