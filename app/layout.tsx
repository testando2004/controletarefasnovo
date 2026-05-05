import type { Metadata } from "next";
import { SistemaProvider } from "@/app/context/SistemaContext";
import { ThemeProvider } from "@/app/context/ThemeContext";
import { ModalManagerProvider } from "@/app/components/modals/ModalManager";
import ThemeToggle from "@/app/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Controle de Tarefas",
  description: "Gerenciamento de Processos e Departamentos",
  icons: {
    icon: "/triar.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen transition-colors" suppressHydrationWarning>
        <ThemeProvider>
          <SistemaProvider>
            <ModalManagerProvider>
              {/* Global theme toggle (also visible on login) */}
              <div className="fixed top-4 right-4 z-[1100]">
                <ThemeToggle />
              </div>
              {children}
            </ModalManagerProvider>
          </SistemaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
