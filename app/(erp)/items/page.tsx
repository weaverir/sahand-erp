
"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Package,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  Boxes,
  Layers3,
  ClipboardList,
  Factory,
  ArrowLeft,
  Save,
  Settings2,
  CheckCircle2,
  CircleDot,
  Cable,
  CircleHelp,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

type ItemType =
  | "RAW_MATERIAL"
  | "COMPONENT"
  | "FINISHED_GOOD"
  | "SEMI_FINISHED"
  | "PACKAGING"
  | "CONSUMABLE";

type UnitOfMeasure =
  | "PIECE"
  | "METER"
  | "KILOGRAM"
  | "GRAM"
  | "LITER"
  | "BOX"
  | "ROLL"
  | "SET";

type Item = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  itemType: ItemType;
  baseUnit: UnitOfMeasure;
  isActive: boolean;
  createdAt: string;
};

type BomComponent = {
  id: string;
  itemId: string;
  quantity: number;
  unit: UnitOfMeasure;
  wastePercent: number;
  description: string;
};

type Bom = {
  id: string;
  code: string;
  productId: string;
  version: number;
  name: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  outputQuantity: number;
  outputUnit: UnitOfMeasure;
  components: BomComponent[];
  createdAt: string;
};

const itemTypeLabels: Record<ItemType, string> = {
  RAW_MATERIAL: "مواد اولیه",
  COMPONENT: "قطعات",
  FINISHED_GOOD: "محصول نهایی",
  SEMI_FINISHED: "نیمه‌ساخته",
  PACKAGING: "بسته‌بندی",
  CONSUMABLE: "مصرفی",
};

const unitLabels: Record<UnitOfMeasure, string> = {
  PIECE: "عدد",
  METER: "متر",
  KILOGRAM: "کیلوگرم",
  GRAM: "گرم",
  LITER: "لیتر",
  BOX: "جعبه",
  ROLL: "رول",
  SET: "ست",
};

const statusLabels = {
  DRAFT: "پیش‌نویس",
  ACTIVE: "فعال",
  ARCHIVED: "بایگانی",
};

const typeColors: Record<ItemType, string> = {
  RAW_MATERIAL: "bg-amber-500/10 text-amber-600",
  COMPONENT: "bg-blue-500/10 text-blue-600",
  FINISHED_GOOD: "bg-emerald-500/10 text-emerald-600",
  SEMI_FINISHED: "bg-violet-500/10 text-violet-600",
  PACKAGING: "bg-orange-500/10 text-orange-600",
  CONSUMABLE: "bg-slate-500/10 text-slate-500",
};

const initialItems: Item[] = [
  {
    id: "1",
    sku: "CBL-001",
    name: "کابل USB-C",
    itemType: "FINISHED_GOOD",
    baseUnit: "PIECE",
    isActive: true,
    createdAt: "2026-11-01",
  },
  {
    id: "2",
    sku: "WR-001",
    name: "سیم مسی",
    itemType: "RAW_MATERIAL",
    baseUnit: "METER",
    isActive: true,
    createdAt: "2026-11-01",
  },
  {
    id: "3",
    sku: "CON-001",
    name: "کانکتور USB-C",
    itemType: "COMPONENT",
    baseUnit: "PIECE",
    isActive: true,
    createdAt: "2026-11-01",
  },
  {
    id: "4",
    sku: "PVC-001",
    name: "روکش PVC",
    itemType: "RAW_MATERIAL",
    baseUnit: "METER",
    isActive: true,
    createdAt: "2026-11-01",
  },
  {
    id: "5",
    sku: "BOX-001",
    name: "جعبه بسته‌بندی",
    itemType: "PACKAGING",
    baseUnit: "PIECE",
    isActive: true,
    createdAt: "2026-11-01",
  },
  {
    id: "6",
    sku: "CHP-001",
    name: "چیپ هوشمند",
    itemType: "COMPONENT",
    baseUnit: "PIECE",
    isActive: true,
    createdAt: "2026-11-01",
  },
];

const initialBoms: Bom[] = [
  {
    id: "BOM-001",
    code: "BOM-CBL-001",
    productId: "1",
    version: 1,
    name: "ساختار تولید کابل USB-C",
    description: "ساختار استاندارد تولید کابل USB-C یک متری",
    status: "ACTIVE",
    outputQuantity: 1,
    outputUnit: "PIECE",
    createdAt: "2026-11-01",
    components: [
      {
        id: "C1",
        itemId: "2",
        quantity: 1.05,
        unit: "METER",
        wastePercent: 5,
        description: "سیم مسی داخلی",
      },
      {
        id: "C2",
        itemId: "3",
        quantity: 2,
        unit: "PIECE",
        wastePercent: 0,
        description: "کانکتور دو طرف کابل",
      },
      {
        id: "C3",
        itemId: "4",
        quantity: 1.05,
        unit: "METER",
        wastePercent: 5,
        description: "روکش خارجی",
      },
      {
        id: "C4",
        itemId: "5",
        quantity: 1,
        unit: "PIECE",
        wastePercent: 0,
        description: "بسته‌بندی محصول",
      },
    ],
  },
];

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";

const cardClass =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm";

const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ItemsPage() {
  const [activeTab, setActiveTab] = useState<"items" | "bom">("items");

  const [items, setItems] = useState<Item[]>(initialItems);
  const [boms, setBoms] = useState<Bom[]>(initialBoms);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [itemForm, setItemForm] = useState({
    sku: "",
    name: "",
    description: "",
    itemType: "RAW_MATERIAL" as ItemType,
    baseUnit: "PIECE" as UnitOfMeasure,
  });

  const [bomModal, setBomModal] = useState(false);
  const [editingBom, setEditingBom] = useState<Bom | null>(null);

  const [selectedBomId, setSelectedBomId] = useState<string | null>(
    initialBoms[0]?.id ?? null
  );

  const [bomForm, setBomForm] = useState({
    productId: "",
    name: "",
    description: "",
    version: 1,
    outputQuantity: 1,
    outputUnit: "PIECE" as UnitOfMeasure,
    components: [] as BomComponent[],
  });

  const [componentForm, setComponentForm] = useState({
    itemId: "",
    quantity: 1,
    unit: "PIECE" as UnitOfMeasure,
    wastePercent: 0,
    description: "",
  });

  const [showComponentForm, setShowComponentForm] = useState(false);
  const [bomSearch, setBomSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase());

      const matchesType =
        typeFilter === "ALL" || item.itemType === typeFilter;

      return matchesSearch && matchesType;
    });
  }, [items, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

  const paginatedItems = filteredItems.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const selectedBom = boms.find((bom) => bom.id === selectedBomId);

  const products = items.filter(
    (item) => item.itemType === "FINISHED_GOOD" && item.isActive
  );

  const componentItems = items.filter(
    (item) =>
      item.itemType !== "FINISHED_GOOD" &&
      item.isActive
  );

  const filteredBoms = boms.filter((bom) => {
    const product = items.find((item) => item.id === bom.productId);

    return (
      bom.name.toLowerCase().includes(bomSearch.toLowerCase()) ||
      bom.code.toLowerCase().includes(bomSearch.toLowerCase()) ||
      product?.name.toLowerCase().includes(bomSearch.toLowerCase())
    );
  });

  const activeBomCount = boms.filter((b) => b.status === "ACTIVE").length;

  function openCreateItem() {
    setEditingItem(null);
    setItemForm({
      sku: "",
      name: "",
      description: "",
      itemType: "RAW_MATERIAL",
      baseUnit: "PIECE",
    });
    setItemModal(true);
  }

  function openEditItem(item: Item) {
    setEditingItem(item);
    setItemForm({
      sku: item.sku,
      name: item.name,
      description: item.description || "",
      itemType: item.itemType,
      baseUnit: item.baseUnit,
    });
    setItemModal(true);
  }

  function saveItem() {
    if (!itemForm.sku.trim() || !itemForm.name.trim()) {
      toast.error("کد کالا و نام کالا الزامی است");
      return;
    }

    if (editingItem) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? { ...item, ...itemForm }
            : item
        )
      );
      toast.success("کالا ویرایش شد");
    } else {
      if (items.some((item) => item.sku === itemForm.sku)) {
        toast.error("کد کالا تکراری است");
        return;
      }

      const newItem: Item = {
        id: uid(),
        ...itemForm,
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      setItems((prev) => [newItem, ...prev]);
      toast.success("کالای جدید اضافه شد");
    }

    setItemModal(false);
  }

  function deactivateItem(id: string) {
    const usedInBom = boms.some((bom) =>
      bom.components.some((component) => component.itemId === id)
    );

    if (usedInBom) {
      toast.error("این کالا در ساختار BOM استفاده شده است");
      setConfirmDelete(null);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isActive: false } : item
      )
    );

    toast.success("کالا غیرفعال شد");
    setConfirmDelete(null);
  }

  function openCreateBom() {
    setEditingBom(null);
    setBomForm({
      productId: products[0]?.id || "",
      name: "",
      description: "",
      version: 1,
      outputQuantity: 1,
      outputUnit: "PIECE",
      components: [],
    });
    setBomModal(true);
  }

  function openEditBom(bom: Bom) {
    setEditingBom(bom);
    setBomForm({
      productId: bom.productId,
      name: bom.name,
      description: bom.description,
      version: bom.version,
      outputQuantity: bom.outputQuantity,
      outputUnit: bom.outputUnit,
      components: [...bom.components],
    });
    setBomModal(true);
  }

  function addComponent() {
    if (!componentForm.itemId || componentForm.quantity <= 0) {
      toast.error("قطعه و مقدار مصرف را مشخص کنید");
      return;
    }

    if (
      bomForm.components.some(
        (component) => component.itemId === componentForm.itemId
      )
    ) {
      toast.error("این کالا قبلاً به BOM اضافه شده است");
      return;
    }

    setBomForm((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        {
          ...componentForm,
          id: uid(),
        },
      ],
    }));

    setComponentForm({
      itemId: "",
      quantity: 1,
      unit: "PIECE",
      wastePercent: 0,
      description: "",
    });

    setShowComponentForm(false);
    toast.success("ماده به ساختار اضافه شد");
  }

  function removeComponent(id: string) {
    setBomForm((prev) => ({
      ...prev,
      components: prev.components.filter((c) => c.id !== id),
    }));
  }

  function saveBom() {
    if (!bomForm.productId || !bomForm.name.trim()) {
      toast.error("محصول و نام ساختار الزامی است");
      return;
    }

    if (bomForm.components.length === 0) {
      toast.error("حداقل یک ماده یا قطعه باید اضافه شود");
      return;
    }

    if (editingBom) {
      const updated: Bom = {
        ...editingBom,
        ...bomForm,
      };

      setBoms((prev) =>
        prev.map((bom) =>
          bom.id === editingBom.id ? updated : bom
        )
      );

      setSelectedBomId(updated.id);
      toast.success("ساختار BOM ویرایش شد");
    } else {
      const newBom: Bom = {
        id: uid(),
        code: `BOM-${Date.now().toString().slice(-6)}`,
        ...bomForm,
        status: "DRAFT",
        createdAt: new Date().toISOString(),
      };

      setBoms((prev) => [newBom, ...prev]);
      setSelectedBomId(newBom.id);
      toast.success("ساختار BOM ایجاد شد");
    }

    setBomModal(false);
  }

  function changeBomStatus(bom: Bom) {
    const nextStatus = bom.status === "ACTIVE" ? "DRAFT" : "ACTIVE";

    setBoms((prev) =>
      prev.map((item) =>
        item.id === bom.id
          ? { ...item, status: nextStatus }
          : item
      )
    );

    toast.success(
      nextStatus === "ACTIVE"
        ? "ساختار فعال شد"
        : "ساختار به پیش‌نویس تغییر کرد"
    );
  }

  function duplicateBom(bom: Bom) {
    const copy: Bom = {
      ...bom,
      id: uid(),
      code: `BOM-${Date.now().toString().slice(-6)}`,
      name: `${bom.name} - نسخه جدید`,
      version: bom.version + 1,
      status: "DRAFT",
      components: bom.components.map((component) => ({
        ...component,
        id: uid(),
      })),
      createdAt: new Date().toISOString(),
    };

    setBoms((prev) => [copy, ...prev]);
    setSelectedBomId(copy.id);
    toast.success("نسخه جدید ساختار ایجاد شد");
  }

  function deleteBom(id: string) {
    setBoms((prev) => prev.filter((bom) => bom.id !== id));

    if (selectedBomId === id) {
      setSelectedBomId(null);
    }

    setConfirmDelete(null);
    toast.success("ساختار حذف شد");
  }

  function getItem(id: string) {
    return items.find((item) => item.id === id);
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat("fa-IR", {
      maximumFractionDigits: 3,
    }).format(value);
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen space-y-6 p-4 text-[var(--foreground)] md:p-6"
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Factory size={16} />
            <span>مدیریت تولید</span>
            <ChevronLeft size={14} />
            <span>کالاها و ساختار محصول</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            مدیریت کالاها و BOM
          </h1>

          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            مدیریت اطلاعات کالاها، مواد اولیه و ساختار مواد موردنیاز تولید
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              toast.info("اطلاعات فعلاً به صورت نمایشی نگهداری می‌شوند")
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm transition hover:bg-[var(--muted)]"
          >
            <RefreshCw size={16} />
            بروزرسانی
          </button>

          <button
            onClick={
              activeTab === "items"
                ? openCreateItem
                : openCreateBom
            }
            className={buttonPrimary}
          >
            <Plus size={17} />
            {activeTab === "items" ? "کالای جدید" : "ساختار BOM جدید"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="کل کالاها"
          value={items.length}
          icon={<Package size={21} />}
          color="blue"
        />

        <StatCard
          title="مواد و قطعات"
          value={
            items.filter(
              (item) =>
                item.itemType === "RAW_MATERIAL" ||
                item.itemType === "COMPONENT"
            ).length
          }
          icon={<Boxes size={21} />}
          color="amber"
        />

        <StatCard
          title="محصولات نهایی"
          value={products.length}
          icon={<Cable size={21} />}
          color="emerald"
        />

        <StatCard
          title="ساختارهای فعال BOM"
          value={activeBomCount}
          icon={<Layers3 size={21} />}
          color="violet"
        />
      </div>

      {/* Tabs */}
      <div className={`${cardClass} flex gap-2 p-2`}>
        <button
          onClick={() => setActiveTab("items")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition md:flex-none ${
            activeTab === "items"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <Package size={17} />
          بانک اطلاعات کالاها
        </button>

        <button
          onClick={() => setActiveTab("bom")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition md:flex-none ${
            activeTab === "bom"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          }`}
        >
          <Layers3 size={17} />
          ساختار BOM
          <span className="rounded-lg bg-black/10 px-2 py-0.5 text-xs">
            {boms.length}
          </span>
        </button>
      </div>

      {/* ITEMS TAB */}
      {activeTab === "items" && (
        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-col justify-between gap-3 border-b border-[var(--border)] p-4 md:flex-row md:items-center">
            <div>
              <h2 className="font-semibold">لیست کالاها</h2>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                مدیریت مواد اولیه، قطعات، محصولات و اقلام مصرفی
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="جست‌وجوی نام یا کد کالا..."
                  className={`${inputClass} pr-10 sm:w-64`}
                />
              </div>

              <div className="relative">
                <Filter
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                />
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className={`${inputClass} pr-9 sm:w-48`}
                >
                  <option value="ALL">همه دسته‌بندی‌ها</option>
                  {Object.entries(itemTypeLabels).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-right text-sm">
              <thead className="bg-[var(--muted)] text-xs text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-5 py-4 font-medium">کد کالا</th>
                  <th className="px-5 py-4 font-medium">نام کالا</th>
                  <th className="px-5 py-4 font-medium">دسته‌بندی</th>
                  <th className="px-5 py-4 font-medium">واحد</th>
                  <th className="px-5 py-4 font-medium">وضعیت</th>
                  <th className="px-5 py-4 font-medium">عملیات</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--border)]">
                {paginatedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="transition hover:bg-[var(--muted)]/50"
                  >
                    <td className="px-5 py-4 font-mono text-xs font-semibold">
                      {item.sku}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {item.description}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${typeColors[item.itemType]}`}
                      >
                        {itemTypeLabels[item.itemType]}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-[var(--muted-foreground)]">
                      {unitLabels[item.baseUnit]}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${
                          item.isActive
                            ? "text-emerald-600"
                            : "text-slate-500"
                        }`}
                      >
                        <CircleDot size={13} />
                        {item.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditItem(item)}
                          className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-500/10"
                          title="ویرایش"
                        >
                          <Pencil size={16} />
                        </button>

                        {item.isActive && (
                          <button
                            onClick={() => setConfirmDelete(item.id)}
                            className="rounded-lg p-2 text-red-500 transition hover:bg-red-500/10"
                            title="غیرفعال‌سازی"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <Package
                        size={35}
                        className="mx-auto mb-3 text-[var(--muted-foreground)]"
                      />
                      <p className="font-medium">کالایی پیدا نشد</p>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        عبارت جست‌وجو یا فیلتر را تغییر دهید
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] p-4 text-xs text-[var(--muted-foreground)]">
            <span>
              نمایش {paginatedItems.length} از {filteredItems.length} کالا
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>

              <span>
                صفحه {formatNumber(page)} از {formatNumber(totalPages)}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-[var(--border)] p-2 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* BOM TAB */}
      {activeTab === "bom" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* BOM List */}
          <aside className={`${cardClass} overflow-hidden`}>
            <div className="border-b border-[var(--border)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">ساختارهای محصول</h2>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    لیست BOMهای تعریف‌شده
                  </p>
                </div>

                <button
                  onClick={openCreateBom}
                  className="rounded-xl bg-blue-600 p-2 text-white transition hover:bg-blue-700"
                  title="ساختار جدید"
                >
                  <Plus size={17} />
                </button>
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                />
                <input
                  value={bomSearch}
                  onChange={(e) => setBomSearch(e.target.value)}
                  placeholder="جست‌وجوی ساختار..."
                  className={`${inputClass} pr-9`}
                />
              </div>
            </div>

            <div className="max-h-[620px] space-y-2 overflow-y-auto p-3">
              {filteredBoms.map((bom) => {
                const product = getItem(bom.productId);
                const selected = selectedBomId === bom.id;

                return (
                  <button
                    key={bom.id}
                    onClick={() => setSelectedBomId(bom.id)}
                    className={`w-full rounded-xl border p-3 text-right transition ${
                      selected
                        ? "border-blue-500 bg-blue-500/5"
                        : "border-[var(--border)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {bom.name}
                        </p>

                        <p className="mt-1 font-mono text-[10px] text-[var(--muted-foreground)]">
                          {bom.code}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${
                          bom.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {statusLabels[bom.status]}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                      <span>{product?.name || "محصول نامشخص"}</span>
                      <span>نسخه {formatNumber(bom.version)}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                      <Boxes size={13} />
                      {formatNumber(bom.components.length)} قلم مواد
                    </div>
                  </button>
                );
              })}

              {filteredBoms.length === 0 && (
                <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">
                  ساختاری پیدا نشد
                </div>
              )}
            </div>
          </aside>

          {/* BOM Detail */}
          <section className={`${cardClass} min-w-0 overflow-hidden`}>
            {selectedBom ? (
              <>
                <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] p-5 lg:flex-row lg:items-center">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600">
                        {selectedBom.code}
                      </span>

                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs ${
                          selectedBom.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {statusLabels[selectedBom.status]}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold">
                      {selectedBom.name}
                    </h2>

                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {selectedBom.description || "بدون توضیحات"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => duplicateBom(selectedBom)}
                      className="rounded-xl border border-[var(--border)] p-2.5 transition hover:bg-[var(--muted)]"
                      title="ایجاد نسخه جدید"
                    >
                      <Copy size={16} />
                    </button>

                    <button
                      onClick={() => openEditBom(selectedBom)}
                      className="rounded-xl border border-[var(--border)] p-2.5 text-blue-600 transition hover:bg-blue-500/10"
                      title="ویرایش"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() => changeBomStatus(selectedBom)}
                      className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                        selectedBom.status === "ACTIVE"
                          ? "border border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {selectedBom.status === "ACTIVE"
                        ? "غیرفعال‌سازی"
                        : "فعال‌سازی"}
                    </button>

                    <button
                      onClick={() => setConfirmDelete(selectedBom.id)}
                      className="rounded-xl border border-red-500/20 p-2.5 text-red-500 transition hover:bg-red-500/10"
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Product Summary */}
                <div className="grid grid-cols-2 gap-3 border-b border-[var(--border)] p-5 md:grid-cols-4">
                  <InfoBox
                    label="محصول خروجی"
                    value={getItem(selectedBom.productId)?.name || "-"}
                    icon={<Package size={17} />}
                  />

                  <InfoBox
                    label="مقدار خروجی"
                    value={`${formatNumber(selectedBom.outputQuantity)} ${unitLabels[selectedBom.outputUnit]}`}
                    icon={<Factory size={17} />}
                  />

                  <InfoBox
                    label="نسخه ساختار"
                    value={formatNumber(selectedBom.version)}
                    icon={<Layers3 size={17} />}
                  />

                  <InfoBox
                    label="تعداد اقلام"
                    value={formatNumber(selectedBom.components.length)}
                    icon={<Boxes size={17} />}
                  />
                </div>

                {/* Components */}
                <div className="p-5">
                  <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-semibold">
                        مواد و قطعات موردنیاز
                      </h3>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        اقلام مصرفی برای تولید هر واحد محصول
                      </p>
                    </div>

                    <button
                      onClick={() => openEditBom(selectedBom)}
                      className={buttonPrimary}
                    >
                      <Pencil size={15} />
                      ویرایش اقلام
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full min-w-[650px] text-right text-sm">
                      <thead className="bg-[var(--muted)] text-xs text-[var(--muted-foreground)]">
                        <tr>
                          <th className="px-4 py-3">ردیف</th>
                          <th className="px-4 py-3">کد کالا</th>
                          <th className="px-4 py-3">نام ماده / قطعه</th>
                          <th className="px-4 py-3">مقدار مصرف</th>
                          <th className="px-4 py-3">ضایعات ٪</th>
                          <th className="px-4 py-3">مصرف کل</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[var(--border)]">
                        {selectedBom.components.map((component, index) => {
                          const item = getItem(component.itemId);

                          const total =
                            component.quantity *
                            (1 + component.wastePercent / 100);

                          return (
                            <tr
                              key={component.id}
                              className="hover:bg-[var(--muted)]/40"
                            >
                              <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                                {formatNumber(index + 1)}
                              </td>

                              <td className="px-4 py-3 font-mono text-xs">
                                {item?.sku || "-"}
                              </td>

                              <td className="px-4 py-3">
                                <div className="font-medium">
                                  {item?.name || "کالای حذف‌شده"}
                                </div>
                                <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                                  {component.description}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                {formatNumber(component.quantity)}{" "}
                                {unitLabels[component.unit]}
                              </td>

                              <td className="px-4 py-3">
                                <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600">
                                  {formatNumber(component.wastePercent)}%
                                </span>
                              </td>

                              <td className="px-4 py-3 font-semibold text-blue-600">
                                {formatNumber(total)}{" "}
                                {unitLabels[component.unit]}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <div className="flex items-start gap-3">
                      <CircleHelp
                        size={19}
                        className="mt-0.5 shrink-0 text-blue-600"
                      />

                      <div>
                        <p className="text-sm font-semibold">
                          نکته درباره محاسبات BOM
                        </p>
                        <p className="mt-1 text-xs leading-6 text-[var(--muted-foreground)]">
                          مقدار مصرف کل با درنظرگرفتن درصد ضایعات محاسبه
                          می‌شود. این اطلاعات مبنای محاسبه نیاز مواد اولیه
                          در برنامه‌ریزی تولید خواهد بود.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[450px] flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 rounded-2xl bg-blue-500/10 p-5 text-blue-600">
                  <Layers3 size={35} />
                </div>

                <h3 className="font-semibold">
                  ساختاری انتخاب نشده است
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted-foreground)]">
                  از فهرست سمت راست یک ساختار را انتخاب کنید یا ساختار
                  جدیدی برای محصولات خود تعریف کنید.
                </p>

                <button
                  onClick={openCreateBom}
                  className={`${buttonPrimary} mt-5`}
                >
                  <Plus size={16} />
                  ایجاد ساختار BOM
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ITEM MODAL */}
      {itemModal && (
        <Modal
          title={editingItem ? "ویرایش کالا" : "تعریف کالای جدید"}
          onClose={() => setItemModal(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="کد کالا *">
                <input
                  className={inputClass}
                  value={itemForm.sku}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, sku: e.target.value })
                  }
                  placeholder="مثلاً CBL-001"
                />
              </Field>

              <Field label="نام کالا *">
                <input
                  className={inputClass}
                  value={itemForm.name}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, name: e.target.value })
                  }
                  placeholder="نام کالا"
                />
              </Field>

              <Field label="نوع کالا">
                <select
                  className={inputClass}
                  value={itemForm.itemType}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      itemType: e.target.value as ItemType,
                    })
                  }
                >
                  {Object.entries(itemTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="واحد پایه">
                <select
                  className={inputClass}
                  value={itemForm.baseUnit}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      baseUnit: e.target.value as UnitOfMeasure,
                    })
                  }
                >
                  {Object.entries(unitLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="توضیحات">
              <textarea
                className={inputClass}
                rows={3}
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    description: e.target.value,
                  })
                }
                placeholder="توضیحات تکمیلی کالا..."
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button
                onClick={() => setItemModal(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm"
              >
                انصراف
              </button>

              <button onClick={saveItem} className={buttonPrimary}>
                <Save size={16} />
                ذخیره کالا
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* BOM MODAL */}
      {bomModal && (
        <Modal
          title={
            editingBom
              ? "ویرایش ساختار BOM"
              : "تعریف ساختار BOM جدید"
          }
          onClose={() => setBomModal(false)}
          wide
        >
          <div className="space-y-5">
            <div className="rounded-xl bg-blue-500/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-600">
                <ClipboardList size={17} />
                اطلاعات اصلی ساختار
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="محصول نهایی *">
                  <select
                    className={inputClass}
                    value={bomForm.productId}
                    onChange={(e) =>
                      setBomForm({
                        ...bomForm,
                        productId: e.target.value,
                      })
                    }
                  >
                    <option value="">انتخاب محصول</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="نام ساختار *">
                  <input
                    className={inputClass}
                    value={bomForm.name}
                    onChange={(e) =>
                      setBomForm({ ...bomForm, name: e.target.value })
                    }
                    placeholder="مثلاً ساختار تولید کابل USB-C"
                  />
                </Field>

                <Field label="مقدار خروجی">
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    className={inputClass}
                    value={bomForm.outputQuantity}
                    onChange={(e) =>
                      setBomForm({
                        ...bomForm,
                        outputQuantity: Number(e.target.value),
                      })
                    }
                  />
                </Field>

                <Field label="واحد خروجی">
                  <select
                    className={inputClass}
                    value={bomForm.outputUnit}
                    onChange={(e) =>
                      setBomForm({
                        ...bomForm,
                        outputUnit: e.target.value as UnitOfMeasure,
                      })
                    }
                  >
                    {Object.entries(unitLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="توضیحات" full>
                  <textarea
                    rows={2}
                    className={inputClass}
                    value={bomForm.description}
                    onChange={(e) =>
                      setBomForm({
                        ...bomForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="توضیحات ساختار..."
                  />
                </Field>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">
                    مواد و قطعات موردنیاز
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    اقلام موردنیاز برای تولید مقدار خروجی تعریف‌شده
                  </p>
                </div>

                <button
                  onClick={() => setShowComponentForm(!showComponentForm)}
                  className={buttonPrimary}
                >
                  <Plus size={16} />
                  افزودن قلم
                </button>
              </div>

              {showComponentForm && (
                <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="انتخاب ماده یا قطعه">
                      <select
                        className={inputClass}
                        value={componentForm.itemId}
                        onChange={(e) => {
                          const selected = getItem(e.target.value);

                          setComponentForm({
                            ...componentForm,
                            itemId: e.target.value,
                            unit: selected?.baseUnit || "PIECE",
                          });
                        }}
                      >
                        <option value="">انتخاب کالا</option>
                        {componentItems
                          .filter(
                            (item) =>
                              !bomForm.components.some(
                                (c) => c.itemId === item.id
                              )
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.sku} - {item.name}
                            </option>
                          ))}
                      </select>
                    </Field>

                    <Field label="مقدار مصرف">
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        className={inputClass}
                        value={componentForm.quantity}
                        onChange={(e) =>
                          setComponentForm({
                            ...componentForm,
                            quantity: Number(e.target.value),
                          })
                        }
                      />
                    </Field>

                    <Field label="واحد مصرف">
                      <select
                        className={inputClass}
                        value={componentForm.unit}
                        onChange={(e) =>
                          setComponentForm({
                            ...componentForm,
                            unit: e.target.value as UnitOfMeasure,
                          })
                        }
                      >
                        {Object.entries(unitLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="درصد ضایعات">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        className={inputClass}
                        value={componentForm.wastePercent}
                        onChange={(e) =>
                          setComponentForm({
                            ...componentForm,
                            wastePercent: Number(e.target.value),
                          })
                        }
                      />
                    </Field>

                    <Field label="شرح مصرف" full>
                      <input
                        className={inputClass}
                        value={componentForm.description}
                        onChange={(e) =>
                          setComponentForm({
                            ...componentForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="مثلاً سیم داخلی کابل"
                      />
                    </Field>
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => setShowComponentForm(false)}
                      className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
                    >
                      انصراف
                    </button>

                    <button
                      onClick={addComponent}
                      className={buttonPrimary}
                    >
                      <Plus size={15} />
                      اضافه کردن
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full min-w-[600px] text-right text-sm">
                  <thead className="bg-[var(--muted)] text-xs text-[var(--muted-foreground)]">
                    <tr>
                      <th className="px-3 py-3">کالا</th>
                      <th className="px-3 py-3">مقدار</th>
                      <th className="px-3 py-3">ضایعات</th>
                      <th className="px-3 py-3">مصرف کل</th>
                      <th className="px-3 py-3">حذف</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--border)]">
                    {bomForm.components.map((component) => {
                      const item = getItem(component.itemId);

                      return (
                        <tr key={component.id}>
                          <td className="px-3 py-3">
                            <div className="font-medium">
                              {item?.name || "-"}
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                              {item?.sku}
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            {formatNumber(component.quantity)}{" "}
                            {unitLabels[component.unit]}
                          </td>

                          <td className="px-3 py-3">
                            {formatNumber(component.wastePercent)}%
                          </td>

                          <td className="px-3 py-3 font-semibold text-blue-600">
                            {formatNumber(
                              component.quantity *
                                (1 + component.wastePercent / 100)
                            )}{" "}
                            {unitLabels[component.unit]}
                          </td>

                          <td className="px-3 py-3">
                            <button
                              onClick={() =>
                                removeComponent(component.id)
                              }
                              className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {bomForm.components.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-10 text-center text-xs text-[var(--muted-foreground)]"
                        >
                          هنوز ماده یا قطعه‌ای اضافه نشده است
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              <button
                onClick={() => setBomModal(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm"
              >
                انصراف
              </button>

              <button onClick={saveBom} className={buttonPrimary}>
                <Save size={16} />
                ذخیره ساختار
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <Modal
          title="تأیید عملیات"
          onClose={() => setConfirmDelete(null)}
        >
          <div className="py-2">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <Trash2 size={23} />
            </div>

            <p className="font-medium">
              آیا از انجام این عملیات اطمینان دارید؟
            </p>

            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {items.some((item) => item.id === confirmDelete)
                ? "این کالا غیرفعال خواهد شد."
                : "این ساختار BOM حذف خواهد شد."}
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm"
              >
                انصراف
              </button>

              <button
                onClick={() => {
                  if (items.some((item) => item.id === confirmDelete)) {
                    deactivateItem(confirmDelete);
                  } else {
                    deleteBom(confirmDelete);
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
              >
                تأیید
              </button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* Reusable Components */

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-600",
    amber: "bg-amber-500/10 text-amber-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    violet: "bg-violet-500/10 text-violet-600",
  };

  return (
    <div className={`${cardClass} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-[var(--muted-foreground)]">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {value.toLocaleString("fa-IR")}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-3">
      <div className="mb-2 flex items-center gap-2 text-[var(--muted-foreground)]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>

      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="mb-2 block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        className={`max-h-[92vh] w-full ${
          wide ? "max-w-4xl" : "max-w-xl"
        } overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-2xl`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)]"
          >
            <X size={19} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
