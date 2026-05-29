"use client";

import MenuView from "@/app/components/MenuView";
import { useRestaurant } from "@/app/context/RestaurantContext";
import Loader from "@/app/components/UI/Loader";
import ValidationError from "@/app/components/ValidationError";
import ErrorScreen from "@/app/components/ErrorScreen";
import { useValidateAccess } from "@/app/hooks/useValidateAccess";
import { useEffect } from "react";

export default function RestaurantMenuPage() {
  const { validationError, tableNumber } = useValidateAccess();
  const { restaurant, loading, error } = useRestaurant();

  useEffect(() => {
    if (restaurant?.name) {
      document.title = restaurant.name + " | Flex Bill";
      return () => {
        document.title = "Even Flex Bill";
      };
    }
  }, [restaurant?.name]);

  // Mostrar error de validación
  if (validationError) {
    return <ValidationError errorType={validationError as any} />;
  }

  // Mostrar loader mientras valida o carga
  if (loading || !restaurant) {
    return <Loader />;
  }

  // Mostrar error si falla la carga
  if (error) {
    return (
      <ErrorScreen
        title="Error al cargar el restaurante"
        description="No pudimos obtener la información del menú"
        detail={error}
      />
    );
  }

  return <MenuView tableNumber={tableNumber || ""} />;
}
