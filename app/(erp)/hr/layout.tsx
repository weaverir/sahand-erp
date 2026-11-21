
import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/modules/permissions/page-access";

export default async function HRLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModulePageAccess("hr");

  return <>{children}</>;
}
