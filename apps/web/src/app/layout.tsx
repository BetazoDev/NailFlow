import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "NailFlow — Reserva tu cita",
  description: "Agenda tu cita de uñas fácil y rápido. Booking platform for nail techs.",
  icons: {
    icon: 'https://cdn.diabolicalservices.tech/nailssalon/favicon-nails.png',
    shortcut: 'https://cdn.diabolicalservices.tech/nailssalon/favicon-nails.png',
    apple: 'https://cdn.diabolicalservices.tech/nailssalon/favicon-nails.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="https://cdn.diabolicalservices.tech/nailssalon/favicon-nails.png" type="image/png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-25..0" />
      </head>
      <body className="antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
