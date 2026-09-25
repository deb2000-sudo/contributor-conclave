import { Navbar } from "@/components/shell/navbar";
import { RouteFocus } from "@/components/shell/route-focus";
import { SiteFooter } from "@/components/shell/site-footer";
import { focusRing } from "@/components/ui/styles";
import { getCurrentUser } from "@/lib/auth/session";
import { readAuthorProfile } from "@/lib/site/author";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Contributor Conclave",
    template: "%s · Contributor Conclave",
  },
  description: "Mentorship around GitHub contributions and pull-request review.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#content"
          className={`sr-only rounded-md focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-30 focus:bg-paper focus:px-3 focus:py-2 focus:text-ink ${focusRing}`}
        >
          Skip to content
        </a>
        <Suspense fallback={null}>
          <RouteFocus />
        </Suspense>
        <Navbar user={user} />
        <div id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
        <SiteFooter author={readAuthorProfile()} />
      </body>
    </html>
  );
}
