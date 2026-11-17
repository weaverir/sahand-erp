import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import ErpShell from "@/components/layout/erp-shell";

import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.constants";
import { getAuthenticatedUser } from "@/modules/auth/auth.service";

interface ErpLayoutProps {
  children: ReactNode;
}

async function ProtectedErpContent({
  children,
}: ErpLayoutProps) {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(
    AUTH_COOKIE_NAMES.access
  )?.value;

  if (!accessToken) {
    redirect("/");
  }

  try {
    await getAuthenticatedUser(accessToken);
  } catch {
    redirect("/");
  }

  return <ErpShell>{children}</ErpShell>;
}

export default function ErpLayout({
  children,
}: ErpLayoutProps) {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          dir="rtl"
        >
          در حال بررسی دسترسی...
        </div>
      }
    >
      <ProtectedErpContent>
        {children}
      </ProtectedErpContent>
    </Suspense>
  );
}