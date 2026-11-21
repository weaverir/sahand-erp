
import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/modules/permissions/page-access";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModulePageAccess("dashboard");

  return <>{children}</>;
}
