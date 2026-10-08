import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "A Brilliant Cobra Duel",
  description:
    "A simultaneous snake strategy arena with local Laya and built-in agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("font-sans min-h-[100dvh] relative")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <div className="fixed bottom-2 left-2">
            <ThemeToggle></ThemeToggle>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
