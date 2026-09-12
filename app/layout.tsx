import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OperatorOS",
  description: "Reusable operating system for solo operators and small teams.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
