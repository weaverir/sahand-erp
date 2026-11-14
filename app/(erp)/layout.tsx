
import type { ReactNode } from "react";
import ErpShell from "@/components/layout/erp-shell";

interface ErpLayoutProps {
  children: ReactNode;
}

export default function ErpLayout({
  children,
}: ErpLayoutProps) {
  return <ErpShell>{children}</ErpShell>;
}
