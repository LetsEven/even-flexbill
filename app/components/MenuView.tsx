"use client";

import {
  lazy,
  Suspense,
  useState,
  useMemo,
  useEffect,
  useRef,
  useTransition,
  useDeferredValue,
} from "react";
import MenuHeader from "@/app/components/headers/MenuHeader";
import MenuCategory from "@/app/components/MenuCategory";
import ErrorScreen from "@/app/components/ErrorScreen";
import Loader from "@/app/components/UI/Loader";
import {
  Search,
  ShoppingCart,
  UserCircle,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useTableNavigation } from "@/app/hooks/useTableNavigation";
import { useCart } from "@/app/context/CartContext";
import { useRestaurant } from "@/app/context/RestaurantContext";
import { DEFAULT_IMAGES } from "@/app/constants/images";
import { useTable } from "@/app/context/TableContext";
import ReorderModal from "@/app/components/ReorderModal";

const ChatView = lazy(() => import("@/app/components/ChatView"));
const AuthView = lazy(() => import("./AuthView"));
const DashboardView = lazy(() => import("./DashboardView"));
const RestaurantClosedModal = lazy(
  () => import("@/app/components/RestaurantClosedModal"),
);

// Pure functions — defined outside to avoid re-creation on every render
function lockScroll() {
  const scrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";
  document.body.style.overflow = "hidden";
}

function unlockScroll() {
  const scrollY = parseInt(document.body.style.top || "0") * -1;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  document.body.style.overflow = "";
  window.scrollTo(0, scrollY);
}

interface UserAvatarProps {
  isAuthenticated: boolean;
  profile: { photoUrl?: string; firstName?: string } | null;
  iconSize?: string;
  textSize?: string;
}

function UserAvatar({
  isAuthenticated,
  profile,
  iconSize = "size-6 md:size-7 lg:size-8",
  textSize = "text-base md:text-lg lg:text-xl",
}: UserAvatarProps) {
  if (isAuthenticated && profile?.photoUrl) {
    return (
      <img
        src={profile.photoUrl}
        alt="Perfil"
        className="w-full h-full object-cover"
      />
    );
  }
  if (isAuthenticated && profile?.firstName) {
    return (
      <span className={`text-stone-800 font-semibold select-none ${textSize}`}>
        {profile.firstName.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <UserCircle className={`text-stone-500 ${iconSize}`} strokeWidth={1.2} />
  );
}

interface MenuViewProps {
  tableNumber?: string;
}

function MenuView({ tableNumber }: MenuViewProps) {
  const [filter, setFilter] = useState("Todo");
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();
  const [showPepperChat, setShowPepperChat] = useState(false);
  const [isPepperClosing, setIsPepperClosing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSettingsClosing, setIsSettingsClosing] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const stickyTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showPepperChat || showSettingsModal || showReorderModal) {
      lockScroll();
    } else {
      unlockScroll();
    }
    return unlockScroll;
  }, [showPepperChat, showSettingsModal, showReorderModal]);

  // Precargar chunks lazy después de que la página ya es interactiva
  useEffect(() => {
    const t = setTimeout(() => {
      import("./DashboardView");
      import("./AuthView");
      import("@/app/components/ChatView");
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const closePepperChat = () => {
    setIsPepperClosing(true);
    setTimeout(() => {
      setShowPepperChat(false);
      setIsPepperClosing(false);
    }, 380);
  };

  const closeSettingsModal = () => {
    setIsSettingsClosing(true);
    setTimeout(() => {
      setShowSettingsModal(false);
      setIsSettingsClosing(false);
    }, 380);
  };

  const { profile, isAuthenticated } = useAuth();
  const { navigateWithTable } = useTableNavigation();
  const { state: cartState } = useCart();
  const { state: tableState } = useTable();
  const { restaurant, menu, loading, error } = useRestaurant();

  // Mostrar barra sticky al hacer scroll past el trigger
  useEffect(() => {
    const trigger = stickyTriggerRef.current;
    if (!trigger) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(trigger);
    return () => observer.disconnect();
  }, []);

  // Obtener categorías únicas del menú de la BD ordenadas por display_order
  const categorias = useMemo(() => {
    const categories = ["Todo"];
    if (menu && menu.length > 0) {
      const sortedSections = [...menu].sort(
        (a, b) => a.display_order - b.display_order,
      );
      sortedSections.forEach((section) => {
        if (section.name) categories.push(section.name);
      });
    }
    return categories;
  }, [menu]);

  const gender = profile?.gender;
  const welcomeMessage = isAuthenticated
    ? gender === "female"
      ? "Bienvenida"
      : "Bienvenido"
    : "Bienvenido";

  const totalItems = cartState.totalItems;

  const deferredFilter = useDeferredValue(filter);
  const deferredSearch = useDeferredValue(searchQuery);

  // Filtrar menú usando valores diferidos — el render pesado ocurre en baja prioridad
  const filteredMenu = useMemo(() => {
    let filtered = menu;

    if (deferredFilter !== "Todo") {
      filtered = filtered.filter((section) => section.name === deferredFilter);
    }

    if (deferredSearch.trim()) {
      const query = deferredSearch.toLowerCase().trim();
      filtered = filtered
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.name.toLowerCase().includes(query) ||
              item.description?.toLowerCase().includes(query),
          ),
        }))
        .filter((section) => section.items.length > 0);
    }

    return [...filtered].sort((a, b) => a.display_order - b.display_order);
  }, [menu, deferredFilter, deferredSearch]);

  if (loading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorScreen
        title="Error al cargar el menú"
        description="No pudimos obtener la información del restaurante"
        detail={error}
      />
    );
  }

  if (!restaurant) {
    return (
      <ErrorScreen
        title="Restaurante no encontrado"
        description="No se pudo cargar la información del restaurante"
        detail="Por favor verifica el código QR"
      />
    );
  }

  return (
    <div className="min-h-screen bg-white relative">
      <img
        src={restaurant.banner_url || DEFAULT_IMAGES.RESTAURANT_BANNER}
        alt=""
        fetchPriority="high"
        className="absolute top-0 left-0 w-full h-[230px] md:h-96 lg:h-[28rem] object-cover banner-mobile z-0"
      />

      <MenuHeader restaurant={restaurant} tableNumber={tableNumber} />

      <main
        className="mt-48 md:mt-64 lg:mt-80 relative z-10"
        style={{ marginTop: "9rem" }}
      >
        <div className="bg-white rounded-t-4xl flex flex-col items-center px-6 md:px-8 lg:px-10">
          {/* Trigger invisible para IntersectionObserver */}
          <div
            ref={stickyTriggerRef}
            className="absolute top-0 h-px w-px pointer-events-none"
          />
          <div className="mt-6 md:mt-8 flex items-start justify-between w-full">
            {/* Settings Icon */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="bg-white rounded-full border border-gray-400 shadow-sm hover:bg-gray-50 transition-all active:scale-95 size-9 md:size-10 lg:size-12 overflow-hidden flex items-center justify-center"
            >
              <UserAvatar isAuthenticated={isAuthenticated} profile={profile} />
            </button>
            {/* Assistant Icon */}
            <button
              onClick={() => setShowPepperChat(true)}
              className="bg-white rounded-full text-black border border-gray-400 size-10 md:size-12 lg:size-14 shadow-sm overflow-hidden"
            >
              <video
                src="/videos/video-icon-pepper.webm"
                autoPlay
                loop
                muted
                playsInline
                preload="none"
                aria-hidden="true"
                disablePictureInPicture
                controls={false}
                controlsList="nodownload nofullscreen noremoteplayback"
                className="w-full h-full object-cover rounded-full"
              />
            </button>
          </div>

          {/* Name and photo */}
          <div className="flex flex-col items-center">
            <div className="size-28 md:size-36 lg:size-40 rounded-full bg-gray-200 overflow-hidden border border-gray-400 shadow-sm">
              <img
                src={restaurant.logo_url || DEFAULT_IMAGES.RESTAURANT_LOGO}
                alt="Profile Pic"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-black mt-3 md:mt-5 mb-6 md:mb-8 flex flex-col items-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium">
                ¡{welcomeMessage}
                {profile?.firstName ? ` ${profile.firstName}` : ""}!
              </h1>
              <h3 className="mt-1 text-black/70 text-xl md:text-2xl lg:text-3xl">
                Mesa {tableNumber}
              </h3>
              {Array.isArray(tableState.dishOrders) &&
                tableState.dishOrders.length > 0 && (
                  <button
                    onClick={() => setShowReorderModal(true)}
                    className="mt-3 bg-[#eab3f4] text-white border border-[#8e8e8e] rounded-full px-3 md:px-4 lg:px-5 py-1 md:py-1.5 text-sm md:text-base lg:text-lg font-medium flex items-center gap-1.5 active:scale-90 transition-all"
                  >
                    Reordenar
                    <RefreshCw className="size-4" />
                  </button>
                )}
            </div>
          </div>

          {/* Search Input */}
          <div className="w-full">
            <div className="flex items-center justify-center border-b border-black">
              <Search
                className="text-black size-5 md:size-6 lg:size-7"
                strokeWidth={1}
              />
              <input
                type="text"
                placeholder="Buscar artículo"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-black text-base md:text-lg lg:text-xl px-3 md:px-4 py-2 md:py-3 focus:outline-none"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 md:gap-3 mt-3 md:mt-5 mb-3 md:mb-5 w-full overflow-x-auto scrollbar-hide">
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => startTransition(() => setFilter(cat))}
                className={`px-3 md:px-5 lg:px-6 py-1 md:py-2 text-sm md:text-base lg:text-lg rounded-full whitespace-nowrap flex-shrink-0
                ${
                  filter === cat
                    ? "bg-black text-white hover:bg-slate-800"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Items */}
          {filteredMenu.length > 0 ? (
            filteredMenu.map((section) => (
              <MenuCategory
                key={section.id}
                section={section}
                showSectionName={deferredFilter === "Todo"}
                onRestaurantClosed={() => setShowClosedModal(true)}
              />
            ))
          ) : (
            <div className="text-center py-10 md:py-16">
              <p className="text-gray-500 text-base md:text-lg lg:text-xl">
                {searchQuery.trim()
                  ? `No se encontraron resultados para "${searchQuery}"`
                  : "No hay items disponibles"}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Carrito flotante */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 md:bottom-8 lg:bottom-10 left-0 right-0 z-50 flex justify-center">
          <button
            onClick={() => navigateWithTable("/cart")}
            className="bg-gradient-to-r from-[#34808C] to-[#173E44] text-white rounded-full px-6 md:px-8 lg:px-10 py-4 md:py-5 lg:py-6 shadow-lg flex items-center gap-3 md:gap-4 transition-all hover:scale-105 animate-bounce-in active:scale-90"
          >
            <ShoppingCart className="size-5 md:size-6 lg:size-7" />
            <span className="text-base md:text-lg lg:text-xl font-medium">
              Ver el carrito • {totalItems}
            </span>
          </button>
        </div>
      )}

      {/* Sticky Bar — aparece al hacer scroll down */}
      <div
        className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-4 pb-3"
        style={{
          opacity: showStickyBar ? 1 : 0,
          transition: "opacity 120ms ease",
          pointerEvents: showStickyBar ? "auto" : "none",
        }}
      >
        <div
          className="flex items-center gap-4 md:gap-5 rounded-full px-6 md:px-7 py-3 md:py-3.5 shadow-lg border border-white/40"
          style={{
            background: "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {/* Settings */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="size-11 md:size-12 rounded-full overflow-hidden flex items-center justify-center bg-white/60 border border-gray-200 hover:bg-white transition-colors active:scale-95"
          >
            <UserAvatar
              isAuthenticated={isAuthenticated}
              profile={profile}
              iconSize="size-6 md:size-7"
              textSize="text-base md:text-lg"
            />
          </button>

          {/* Carrito */}
          <div className="relative group">
            <button
              onClick={() => navigateWithTable("/cart")}
              className="size-11 md:size-12 rounded-full flex items-center justify-center bg-white/60 border border-gray-200 hover:bg-white transition-colors active:scale-95"
            >
              <ShoppingCart
                className="size-5 md:size-6 text-stone-700"
                strokeWidth={1.5}
              />
            </button>
            {cartState.totalItems > 0 && (
              <div className="absolute -top-1 -right-1 bg-[#eab3f4] text-white rounded-full size-5 flex items-center justify-center text-xs font-normal">
                {cartState.totalItems}
              </div>
            )}
          </div>

          {/* Orden */}
          <div className="relative group">
            <button
              onClick={() => navigateWithTable("/order")}
              className="size-11 md:size-12 rounded-full flex items-center justify-center bg-white/60 border border-gray-200 hover:bg-white transition-colors active:scale-95"
            >
              <ReceiptText
                className="size-5 md:size-6 text-stone-700"
                strokeWidth={1.5}
              />
            </button>
            {Array.isArray(tableState.dishOrders) &&
              tableState.dishOrders.length > 0 && (
                <div className="absolute -top-1 -right-1 bg-[#eab3f4] text-white rounded-full size-5 flex items-center justify-center text-xs font-normal">
                  {tableState.dishOrders.length}
                </div>
              )}
          </div>

          {/* Pepper */}
          <button
            onClick={() => setShowPepperChat(true)}
            className="size-11 md:size-12 rounded-full border border-gray-200 bg-white/60 overflow-hidden hover:bg-white transition-colors active:scale-95"
          >
            <video
              src="/videos/video-icon-pepper.webm"
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              aria-hidden="true"
              disablePictureInPicture
              controls={false}
              controlsList="nodownload nofullscreen noremoteplayback"
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>

      {/* Pepper Chat Modal */}
      {showPepperChat && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            style={{
              animation: isPepperClosing
                ? "fadeOut 0.38s cubic-bezier(0.32, 0.72, 0, 1) forwards"
                : "fadeIn 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
            onClick={closePepperChat}
          />
          <div
            className="fixed inset-x-0 z-50 flex flex-col rounded-t-3xl overflow-hidden shadow-2xl border-t border-white/30"
            style={{
              top: "12%",
              bottom: 0,
              paddingBottom: "env(safe-area-inset-bottom)",
              background: "rgba(255, 255, 255, 0.82)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              animation: isPepperClosing
                ? "slideDown 0.38s cubic-bezier(0.32, 0.72, 0, 1) forwards"
                : "slideUp 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300/80" />
            </div>
            <Suspense fallback={null}>
              <ChatView onBack={closePepperChat} />
            </Suspense>
          </div>
        </>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            style={{
              animation: isSettingsClosing
                ? "fadeOut 0.38s cubic-bezier(0.32, 0.72, 0, 1) forwards"
                : "fadeIn 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
            onClick={closeSettingsModal}
          />
          <div
            className="fixed inset-x-0 z-50 flex flex-col rounded-t-3xl shadow-2xl border-t border-white/20"
            style={{
              top: "5%",
              bottom: 0,
              paddingBottom: "env(safe-area-inset-bottom)",
              background: "rgba(255, 255, 255, 0.82)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              animation: isSettingsClosing
                ? "slideDown 0.38s cubic-bezier(0.32, 0.72, 0, 1) forwards"
                : "slideUp 0.38s cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/30" />
            </div>
            <Suspense fallback={null}>
              {isAuthenticated ? (
                <div className="flex-1 min-h-0">
                  <DashboardView
                    onClose={closeSettingsModal}
                    onLogout={closeSettingsModal}
                  />
                </div>
              ) : (
                <AuthView onClose={closeSettingsModal} />
              )}
            </Suspense>
          </div>
        </>
      )}

      {/* Reorder Modal */}
      <ReorderModal
        isOpen={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        dishOrders={tableState.dishOrders}
        tableNumber={tableNumber}
      />

      {/* Restaurant Closed Modal */}
      <Suspense fallback={null}>
        <RestaurantClosedModal
          isOpen={showClosedModal}
          onClose={() => setShowClosedModal(false)}
          openingHours={restaurant?.opening_hours}
          restaurantName={restaurant?.name}
          restaurantLogo={restaurant?.logo_url}
        />
      </Suspense>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(100%); opacity: 0.6; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default MenuView;
