"use client";

import { Restaurant } from "../../interfaces/restaurante";
import { useTable } from "../../context/TableContext";
import { useTableNavigation } from "../../hooks/useTableNavigation";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiService } from "../../utils/api";

interface MenuHeaderProps {
  restaurant: Restaurant;
  tableNumber?: string;
}

interface UserImageData {
  imageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
}

export default function MenuHeaderBackOrder({
  restaurant,
  tableNumber,
}: MenuHeaderProps) {
  const router = useRouter();
  const { state } = useTable();
  const { navigateWithTable, goBack } = useTableNavigation();
  const pathname = usePathname();
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [usersImages, setUsersImages] = useState<Record<string, UserImageData>>(
    {},
  );
  const { user, profile, isLoading } = useAuth();

  const handleBack = () => {
    navigateWithTable("/menu");
  };

  // Extraer user_ids únicos y memoizarlos
  const userIdsString = useMemo(() => {
    const userIds = new Set<string>();

    if (Array.isArray(state.activeUsers)) {
      state.activeUsers.forEach((u) => {
        if (u && u.user_id) userIds.add(u.user_id);
      });
    }

    if (Array.isArray(state.dishOrders)) {
      state.dishOrders.forEach((order) => {
        if (order && order.user_id) userIds.add(order.user_id);
      });
    }

    // Convertir a string ordenado para comparación estable
    return Array.from(userIds).sort().join(",");
  }, [state.activeUsers, state.dishOrders]);

  // Cargar imágenes de usuarios autenticados
  // IMPORTANTE: Esto funciona tanto para usuarios autenticados como invitados
  // Los invitados también pueden ver las fotos de usuarios autenticados en la mesa
  useEffect(() => {
    const loadUsersImages = async () => {
      if (!userIdsString) return;

      const userIdsArray = userIdsString.split(",").filter(Boolean);
      if (userIdsArray.length === 0) return;

      try {
        const response = await apiService.getUsersInfo(userIdsArray);

        if (response.success && response.data) {
          // El backend retorna { success: true, data: { userId: {...} } }
          // Pero la estructura real tiene doble data, así que usamos response.data directamente
          const usersData = (response.data as any).data || response.data;
          setUsersImages(usersData as Record<string, UserImageData>);
        }
      } catch (error) {
        console.error("❌ Error loading users images:", error);
      }
    };

    loadUsersImages();
  }, [userIdsString]);

  // Extraer participantes únicos con información completa (guest_name y user_id)
  const participantsMap = new Map<
    string,
    { guest_name: string; user_id: string | null }
  >();

  // Agregar de activeUsers
  if (Array.isArray(state.activeUsers)) {
    state.activeUsers.forEach((activeUser) => {
      if (activeUser && activeUser.guest_name) {
        participantsMap.set(activeUser.guest_name, {
          guest_name: activeUser.guest_name,
          user_id: activeUser.user_id || null,
        });
      }
    });
  }

  // Agregar de dishOrders (solo si no existe ya)
  if (Array.isArray(state.dishOrders)) {
    state.dishOrders.forEach((order) => {
      if (order && order.guest_name && !participantsMap.has(order.guest_name)) {
        participantsMap.set(order.guest_name, {
          guest_name: order.guest_name,
          user_id: order.user_id || null,
        });
      }
    });
  }

  const participants = Array.from(participantsMap.values());
  const visibleParticipants = participants.slice(0, 2);
  const remainingCount = participants.length - 2;

  // Verificar si un participante es el usuario actual autenticado
  const isCurrentUser = (participant: {
    guest_name: string;
    user_id: string | null;
  }) => {
    return user && participant.user_id === user.id;
  };

  // Obtener el nombre a mostrar (nombre real si es usuario autenticado, o guest_name)
  const getDisplayName = (participant: {
    guest_name: string;
    user_id: string | null;
  }) => {
    // Si es el usuario actual, usar datos de profile directamente
    if (isCurrentUser(participant) && profile) {
      return profile.firstName && profile.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : profile.firstName || participant.guest_name;
    }

    // Si tiene user_id y tenemos sus datos cargados, usar el nombre real
    if (participant.user_id && usersImages[participant.user_id]) {
      const userData = usersImages[participant.user_id];
      return userData.fullName || userData.firstName || participant.guest_name;
    }

    // Si no, usar guest_name
    return participant.guest_name;
  };

  // Obtener imagen de usuario (para usuarios que no son el actual)
  const getUserImage = (participant: {
    guest_name: string;
    user_id: string | null;
  }) => {
    if (participant.user_id && usersImages[participant.user_id]) {
      return usersImages[participant.user_id].imageUrl;
    }
    return null;
  };

  // Generar inicial
  const getInitials = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // Generar colos segun el nombre (siempre el mismo color para ese nombre)
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-red-500",
      "bg-yellow-500",
      "bg-teal-500",
      "bg-orange-500",
      "bg-cyan-500",
      "bg-emerald-500",
      "bg-violet-500",
      "bg-rose-500",
      "bg-lime-500",
      "bg-amber-500",
      "bg-sky-500",
      "bg-fuchsia-500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <header className="container mx-auto px-5 md:px-8 lg:px-10 pt-5 md:pt-7 lg:pt-9 z-10">
      <div className="relative flex items-center justify-between z-10">
        {/* Back */}
        <div className="flex items-center z-10">
          <div
            onClick={handleBack}
            className="size-10 md:size-12 lg:size-14 bg-white border border-gray-300 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-200 active:scale-95 transition-transform duration-200"
          >
            <ChevronLeft className="text-primary size-5 md:size-6 lg:size-7" />
          </div>
        </div>

        {/* Even Logo */}
        <div className="absolute left-1/2 transform -translate-x-1/2 size-10 md:size-12 lg:size-14">
          <img src="/logo-short-green.webp" alt="Even Logo" />
        </div>

        {/* Participantes */}
        {isLoading ? (
          // Loading
          <div className="flex items-center space-x-1">
            <div className="size-10 md:size-12 lg:size-14 bg-gray-300 animate-pulse rounded-full border border-white shadow-sm"></div>
          </div>
        ) : participants.length > 0 ? (
          <div className="flex items-center space-x-1">
            {remainingCount > 0 && (
              <div
                onClick={() => setIsParticipantsModalOpen(true)}
                className="size-10 md:size-12 lg:size-14 bg-white rounded-full flex items-center justify-center text-black text-base md:text-lg lg:text-xl font-medium border border-[#8e8e8e] shadow-sm cursor-pointer"
              >
                +{remainingCount}
              </div>
            )}
            {visibleParticipants.map((participant, index) => {
              const isCurrent = isCurrentUser(participant);
              const displayName = getDisplayName(participant);
              const userImage =
                isCurrent && profile?.photoUrl
                  ? profile.photoUrl
                  : getUserImage(participant);
              const hasImage = !!userImage;

              return (
                <div
                  key={participant.guest_name}
                  onClick={() => setIsParticipantsModalOpen(true)}
                  className={`size-10 md:size-12 lg:size-14 rounded-full flex items-center justify-center text-white text-base md:text-lg lg:text-xl font-medium border border-white shadow-sm cursor-pointer overflow-hidden ${!hasImage ? getAvatarColor(displayName) : ""}`}
                  style={{
                    marginLeft: remainingCount > 0 || index > 0 ? "-12px" : "0",
                  }}
                >
                  {hasImage ? (
                    <img
                      src={userImage}
                      alt={displayName}
                      className="size-10 md:size-12 lg:size-14 rounded-full object-cover"
                    />
                  ) : (
                    getInitials(displayName)
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Cart and order buttons - Available if needed */}
      </div>

      {/* Modal participantes */}
      {isParticipantsModalOpen && (
        <div
          className="fixed inset-0 flex items-end justify-center"
          style={{ zIndex: 99999 }}
        >
          {/* Fondo */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsParticipantsModalOpen(false)}
          ></div>

          {/* Modal */}
          <div className="relative bg-white rounded-t-4xl w-full mx-4 md:mx-6 lg:mx-8">
            {/* Titulo */}
            <div className="px-6 md:px-8 lg:px-10 pt-4 md:pt-5 lg:pt-6">
              <div className="flex items-center justify-between pb-4 md:pb-5 border-b border-[#8e8e8e]">
                <h3 className="text-lg md:text-xl lg:text-2xl font-semibold text-black">
                  Participantes
                </h3>
                <button
                  onClick={() => setIsParticipantsModalOpen(false)}
                  className="p-1 md:p-1.5 lg:p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <X className="size-5 md:size-6 lg:size-7 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Lista de participantes */}
            <div className="px-6 md:px-8 lg:px-10 py-4 md:py-5 lg:py-6 space-y-3 md:space-y-4 lg:space-y-5 max-h-80 md:max-h-96 lg:max-h-[28rem] overflow-y-auto">
              {participants.map((participant) => {
                const isCurrent = isCurrentUser(participant);
                const displayName = getDisplayName(participant);
                const userImage =
                  isCurrent && profile?.photoUrl
                    ? profile.photoUrl
                    : getUserImage(participant);
                const hasImage = !!userImage;

                return (
                  <div
                    key={participant.guest_name}
                    className="flex items-center gap-3 md:gap-4"
                  >
                    <div
                      className={`size-12 md:size-14 lg:size-16 rounded-full flex items-center justify-center text-white text-base md:text-lg lg:text-xl font-semibold overflow-hidden ${!hasImage ? getAvatarColor(displayName) : ""}`}
                    >
                      {hasImage ? (
                        <img
                          src={userImage}
                          alt={displayName}
                          className="size-12 md:size-14 lg:size-16 rounded-full object-cover"
                        />
                      ) : (
                        getInitials(displayName)
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-black text-base md:text-lg lg:text-xl">
                        {displayName}
                        {isCurrent && (
                          <span className="ml-2 text-xs md:text-sm lg:text-base text-primary">
                            (Tú)
                          </span>
                        )}
                      </p>
                      <p className="text-sm md:text-base lg:text-lg text-[#8e8e8e]">
                        {(() => {
                          const userOrders = Array.isArray(state.dishOrders)
                            ? state.dishOrders.filter(
                                (order) =>
                                  order &&
                                  order.guest_name === participant.guest_name,
                              )
                            : [];

                          const dishCount = userOrders.length;
                          const totalValue = userOrders.reduce(
                            (sum, order) => sum + (order?.total_price || 0),
                            0,
                          );

                          // También mostrar información de activeUsers si está disponible
                          const activeUser = Array.isArray(state.activeUsers)
                            ? state.activeUsers.find(
                                (u) =>
                                  u && u.guest_name === participant.guest_name,
                              )
                            : null;

                          if (dishCount === 0 && activeUser) {
                            return "Usuario activo en mesa";
                          }

                          return `$${totalValue.toFixed(2)}`;
                        })()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
