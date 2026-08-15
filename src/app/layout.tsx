import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted variable fonts (latin subset). next/font/google fetches from
// Google at build time, which flakes on Vercel build machines and kills the
// deploy — local files make the build deterministic.
const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const montserrat = localFont({
  src: "./fonts/montserrat-latin-var.woff2",
  variable: "--font-montserrat",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Last Man Standing | Premier League",
    template: "%s | Last Man Standing",
  },
  description:
    "Pick one Premier League team a week. Win and you go through, slip up and you are out. Last player standing takes it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="bg-canvas text-ink flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
