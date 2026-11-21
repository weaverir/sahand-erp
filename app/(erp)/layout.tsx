
import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import ErpShell from "@/components/layout/erp-shell";
import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.cookies";
import { getAuthenticatedUser } from "@/modules/auth/auth.service";

interface ErpLayoutProps {
  children: ReactNode;
}

async function AuthenticatedErpContent({
  children,
}: {
  children: ReactNode;
}) {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAMES.access)?.value;

  if (!token) {
    redirect("/");
  }

  try {
    await getAuthenticatedUser(token);
  } catch {
    redirect("/");
  }

  return <ErpShell>{children}</ErpShell>;
}

export default function ErpLayout({
  children,
}: ErpLayoutProps) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedErpContent>
        {children}
      </AuthenticatedErpContent>
    </Suspense>
  );
}
