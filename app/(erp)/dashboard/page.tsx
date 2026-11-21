import DashboardClient from "./page-client";
import { requirePagePermission } from "@/modules/permissions/page-access";

export default async function DashboardPage() {
  await requirePagePermission("dashboard.dashboard.view");
  return <DashboardClient />;
}
