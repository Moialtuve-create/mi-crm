import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ClienteOverlayProvider } from "@/components/providers/ClienteOverlayProvider";
import { InteraccionOverlayProvider } from "@/components/providers/InteraccionOverlayProvider";
import { SeguimientoOverlayProvider } from "@/components/providers/SeguimientoOverlayProvider";
import { VentaOverlayProvider } from "@/components/providers/VentaOverlayProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Vibe CRM",
  description:
    "CRM ligero para un negocio pequeño: organiza clientes y no pierdas ventas por falta de seguimiento.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#16A34A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>
          <SessionProvider>
            <ToastProvider>
              <ClienteOverlayProvider>
                <InteraccionOverlayProvider>
                  <SeguimientoOverlayProvider>
                    <VentaOverlayProvider>{children}</VentaOverlayProvider>
                  </SeguimientoOverlayProvider>
                </InteraccionOverlayProvider>
              </ClienteOverlayProvider>
            </ToastProvider>
          </SessionProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
