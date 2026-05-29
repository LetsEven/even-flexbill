"use client";

import CartView from "@/app/components/CartView";
import ValidationError from "@/app/components/ValidationError";
import { useValidateAccess } from "@/app/hooks/useValidateAccess";
import { useEffect } from "react";

export default function CartPage() {
  const { validationError } = useValidateAccess();

  useEffect(() => {
    document.title = "Mi Carrito | Flex Bill";
    return () => {
      document.title = "Even Flex Bill";
    };
  }, []);

  // Mostrar error de validación si existe
  if (validationError) {
    return <ValidationError errorType={validationError as any} />;
  }

  return <CartView />;
}
