
import { LoaderCircle } from "lucide-react";

export default function OrganizationLoading() {
  return (
    <main
      dir="rtl"
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div className="flex flex-col items-center gap-4">
        <LoaderCircle
          size={36}
          className="animate-spin text-blue-500"
        />

        <p className="text-sm text-gray-500">
          در حال بارگذاری ساختار سازمانی سهند...
        </p>
      </div>
    </main>
  );
}
