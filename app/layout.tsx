import "./globals.css";
import type { Metadata } from "next";
import Shell from "@/components/Shell";
export const metadata: Metadata = { title: "LIFEOS", description: "Assistant personnel de gestion du temps" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr" suppressHydrationWarning><body><Shell>{children}</Shell></body></html>;
}
