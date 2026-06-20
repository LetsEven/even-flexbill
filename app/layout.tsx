import type { Metadata, Viewport } from "next";
import { DM_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "./context/CartContext";
import { TableProvider } from "./context/TableContext";
import { GuestProvider } from "./context/GuestContext";
import { PaymentProvider } from "./context/PaymentContext";
import { RestaurantProvider } from "./context/RestaurantContext";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { PepperProvider } from "./context/PepperContext";
import Script from "next/script";
import { headers } from "next/headers";

// DM Mono — voz funcional de Even (UI, body, labels, datos)
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

// Plus Jakarta Sans — display (sustituto provisional de Noka para headlines)
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Even Flex Bill",
  description: "Divide y paga tu cuenta desde tu dispositivo",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;
  void nonce;

  return (
    <html lang="es">
      <body
        className={`${dmMono.variable} ${jakarta.variable} antialiased`}
        style={{ fontFamily: "var(--font-dm-mono)" }}
      >
        <Script
          src="https://ecartpay.com/sdk/pay.js?v=2"
          strategy="afterInteractive"
        />
        <AuthProvider>
          <RestaurantProvider>
            <PepperProvider>
              <GuestProvider>
                <SocketProvider>
                  <CartProvider>
                    <TableProvider>
                      <PaymentProvider>{children}</PaymentProvider>
                    </TableProvider>
                  </CartProvider>
                </SocketProvider>
              </GuestProvider>
            </PepperProvider>
          </RestaurantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
