"use client";

import { useState } from "react";
import ProfileTab from "./dashboard/ProfileTab";
import CardsTab from "./dashboard/CardsTab";
import HistoryTab from "./dashboard/HistoryTab";
import SupportTab from "./dashboard/SupportTab";
import DashboardHeader from "./headers/DashboardHeader";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

interface DashboardViewProps {
  onClose?: () => void;
  onLogout?: () => void;
}

export default function DashboardView({
  onClose,
  onLogout,
}: DashboardViewProps = {}) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "cards" | "history" | "support"
  >("profile");

  // States for Support Tab (Pepper chat)
  const [supportMessages, setSupportMessages] = useState<
    Array<{ role: "user" | "pepper"; content: string }>
  >([]);
  const [supportSessionId, setSupportSessionId] = useState<string | null>(null);

  const { profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center ${onClose ? "h-full" : "h-dvh brand-evergreen"}`}
      >
        <Loader2 className="size-12 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-y-auto ${onClose ? "h-full" : "h-dvh brand-evergreen"}`}
    >
      <DashboardHeader onClose={onClose} />

      <div className="px-4 md:px-6 lg:px-8 w-full flex-1 flex flex-col">
        {/* Welcome Header */}
        <div
          className={`left-4 right-4 rounded-t-4xl translate-y-7 z-0 ${onClose ? "bg-black/5" : "bg-even-evergreen"}`}
        >
          <div className="py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-12 flex flex-col justify-center pb-12 md:pb-14 lg:pb-16">
            <h1
              className={`text-2xl md:text-3xl lg:text-4xl font-medium ${onClose ? "text-black/80" : "text-white"}`}
            >
              ¡Bienvenido{profile?.firstName ? ` ${profile.firstName}` : ""}!
            </h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="bg-white rounded-t-4xl flex-1 z-5 flex flex-col px-6 md:px-7 lg:px-8 min-h-0">
            {/* Tabs */}
            <div className="relative grid grid-cols-4 gap-2 my-6 md:my-7 lg:my-8 w-full">
              {/* Animated Background Indicator */}
              <div
                className="absolute top-0 h-full bg-black rounded-full transition-all duration-300 ease-out"
                style={{
                  left:
                    activeTab === "profile"
                      ? "0%"
                      : activeTab === "support"
                        ? "calc(25% + 0.125rem)"
                        : activeTab === "history"
                          ? "calc(50% + 0.25rem)"
                          : "calc(75% + 0.375rem)",
                  width: "calc(25% - 0.125rem)",
                }}
              />

              <button
                onClick={() => setActiveTab("profile")}
                className={`relative px-3 md:px-4 lg:px-5 py-0.5 md:py-1 lg:py-1.5 rounded-full cursor-pointer whitespace-nowrap text-base md:text-lg lg:text-xl transition-colors duration-300 ${
                  activeTab === "profile"
                    ? "text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Perfil
              </button>
              <button
                onClick={() => setActiveTab("support")}
                className={`relative px-3 py-0.5 rounded-full cursor-pointer whitespace-nowrap text-base md:text-lg lg:text-xl transition-colors duration-300 ${
                  activeTab === "support"
                    ? "text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Soporte
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`relative px-3 py-0.5 rounded-full cursor-pointer whitespace-nowrap text-base md:text-lg lg:text-xl transition-colors duration-300 ${
                  activeTab === "history"
                    ? "text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Historial
              </button>

              <button
                onClick={() => setActiveTab("cards")}
                className={`relative px-3 py-0.5 rounded-full cursor-pointer whitespace-nowrap text-base md:text-lg lg:text-xl transition-colors duration-300 ${
                  activeTab === "cards"
                    ? "text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Tarjetas
              </button>
            </div>

            {/* Tab Content */}
            <div
              className={`flex-1 flex flex-col overflow-y-auto pb-6 min-h-0 ${activeTab === "support" || activeTab === "cards" ? "relative" : ""}`}
            >
              {activeTab === "profile" && <ProfileTab onLogout={onLogout} />}
              {activeTab === "cards" && <CardsTab />}
              {activeTab === "history" && <HistoryTab />}
              {activeTab === "support" && (
                <SupportTab
                  messages={supportMessages}
                  setMessages={setSupportMessages}
                  sessionId={supportSessionId}
                  setSessionId={setSupportSessionId}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
