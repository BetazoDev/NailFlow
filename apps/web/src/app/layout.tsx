import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NailFlow — Reserva tu cita",
  description: "Agenda tu cita de uñas fácil y rápido. Booking platform for nail techs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
