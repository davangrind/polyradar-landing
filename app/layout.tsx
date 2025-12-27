import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const gilroy = localFont({
  src: [
    { path: "../public/fonts/Gilroy-Light.otf", weight: "400", style: "normal" },
    { path: "../public/fonts/Gilroy-ExtraBold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-gilroy",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://polymarketradar.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Polyradar | Analytics Tool for Polymarket",
    template: "%s | Polyradar",
  },
  description: "Know what whales do on Polymarket right as it happens",

  applicationName: "Polyradar",
  creator: "Polyradar",
  publisher: "Polyradar",

  alternates: {
    canonical: "/", // глобальный canonical на главную
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  openGraph: {
    type: "website",
    url: "/",
    siteName: "Polyradar",
    title: "Polyradar | Analytics Tool for Polymarket",
    description: "Know what whales do on Polymarket right as it happens",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1024,
        height: 1024,
        alt: "Polyradar",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Polyradar | Analytics Tool for Polymarket",
    description: "Know what whales do on Polymarket right as it happens",
    images: ["/twitter-image.png"],
    // creator: "@your_handle", // если есть
  },

  icons: {
    icon: [{ url: "/icon.png" }],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${gilroy.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
