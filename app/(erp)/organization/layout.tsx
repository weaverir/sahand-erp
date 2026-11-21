
import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/modules/permissions/page-access";

export default async function OrganizationLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModulePageAccess("organization");

  return <>{children}</>;
}
