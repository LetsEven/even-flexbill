"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import Loader from "./components/UI/Loader";

// Restaurant ID y Branch por defecto para testing
const DEFAULT_RESTAURANT_ID = 15;
const DEFAULT_BRANCH_NUMBER = 1;
const DEFAULT_TABLE = 1;

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for parameters in URL
    const tableParam = searchParams.get("table");
    const restaurantParam = searchParams.get("restaurant");
    const branchParam = searchParams.get("branch");

    const restaurantId = restaurantParam || DEFAULT_RESTAURANT_ID;
    const branchNumber = branchParam || DEFAULT_BRANCH_NUMBER;

    if (tableParam) {
      // Redirect to menu with table parameter
      const redirectUrl = `/${restaurantId}/${branchNumber}/menu?table=${tableParam}`;
      router.replace(redirectUrl);
    } else {
      // Default redirect to restaurant menu with default table
      const redirectUrl = `/${DEFAULT_RESTAURANT_ID}/${DEFAULT_BRANCH_NUMBER}/menu?table=${DEFAULT_TABLE}`;
      router.replace(redirectUrl);
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-new bg-gradient-to-br from-[#0a8b9b] to-[#153f43] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-5 md:px-8 lg:px-10 pb-12 md:py-10 lg:py-12">
        <div className="w-full max-w-md">
          {/* Logo and QR Code side by side */}
          <div className="mb-6 md:mb-8 lg:mb-10 text-center">
            <div className="flex items-center justify-center gap-4 md:gap-6 lg:gap-8 mb-4 md:mb-5 lg:mb-6">
              <img
                src="/logo-short-green.webp"
                alt="Even Logo"
                className="size-16 md:size-20 lg:size-24"
              />
            </div>
            <h1 className="text-white text-xl md:text-2xl lg:text-3xl font-medium mb-2 md:mb-3 lg:mb-4">
              Bienvenido a Even
            </h1>
            <p className="text-white/80 text-sm md:text-base lg:text-lg">
              Por favor tapee la tarjeta o escanee el código QR de su mesa para
              comenzar
            </p>
          </div>

          {/* Additional Info */}
          <div className="mt-6 md:mt-7 lg:mt-8 text-center">
            <p className="text-white/70 text-xs md:text-sm lg:text-base">
              Encontrará la tarjeta en su mesa. Cada tarjeta tiene un código
              único para acceder al menú digital.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<Loader />}>
      <HomeContent />
    </Suspense>
  );
}
