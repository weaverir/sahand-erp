import ItemsClient from "./page-client";
import { requirePagePermission } from "@/modules/permissions/page-access";

export default async function ItemsPage() {
  await requirePagePermission("items.items.view");
  return <ItemsClient />;
}
