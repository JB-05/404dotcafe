import type { Metadata } from "next";
import { Bebas_Neue, Outfit, Permanent_Marker, Special_Elite } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

const marker = Permanent_Marker({
  variable: "--font-marker",
  weight: "400",
  subsets: ["latin"],
});

const special = Special_Elite({
  variable: "--font-special",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "404 Café | CafeOS",
  description: "Digital menu and ordering for 404 Café, Muthoor, Thiruvalla",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${bebas.variable} ${marker.variable} ${special.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
