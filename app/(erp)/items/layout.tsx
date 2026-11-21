
import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/modules/permissions/page-access";

export default async function ItemsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireModulePageAccess("items");

  return <>{children}</>;
}
