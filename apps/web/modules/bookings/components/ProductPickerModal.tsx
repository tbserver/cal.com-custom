"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────

interface ShopifyVariant {
  variantId: string;
  title: string;
  price: string;
  currency: string;
  image: string | null;
}

interface ShopifyProduct {
  productId: string;
  title: string;
  handle: string;
  image: string | null;
  minPrice: string;
  currency: string;
  variants: ShopifyVariant[];
}

export interface SelectedProduct {
  productId: string;
  title: string;
  variantId: string;
  variantTitle: string;
  quantity: number;
  price: string;
  currency: string;
  image: string | null;
}

interface ProductPickerModalProps {
  open: boolean;
  onSkip: () => void;
  onContinue: (products: SelectedProduct[]) => void;
}

// ── Helpers ────────────────────────────────────────────────────

function formatPrice(amount: string, currency: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(num);
}

function selectionKey(productId: string, variantId: string) {
  return `${productId}::${variantId}`;
}

// ── Component ──────────────────────────────────────────────────

export function ProductPickerModal({ open, onSkip, onContinue }: ProductPickerModalProps) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selections, setSelections] = useState<Map<string, SelectedProduct>>(new Map());
  // Track which variant is selected per product (for dropdown)
  const [variantChoices, setVariantChoices] = useState<Map<string, string>>(new Map());

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Fetch products
  const fetchProducts = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("limit", "24");
      const res = await fetch(`/api/shopify/products?${params.toString()}`);
      const data = await res.json();
      if (data.error && data.items.length === 0) {
        setError(data.error);
        setProducts([]);
      } else {
        setProducts(data.items || []);
      }
    } catch {
      setError("Impossible de charger les produits");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchProducts(debouncedSearch);
    }
  }, [open, debouncedSearch, fetchProducts]);

  // Reset when closing
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setSelections(new Map());
      setVariantChoices(new Map());
    }
  }, [open]);

  const getSelectedVariant = useCallback(
    (product: ShopifyProduct): ShopifyVariant | null => {
      if (product.variants.length === 0) return null;
      const chosen = variantChoices.get(product.productId);
      return product.variants.find((v) => v.variantId === chosen) || product.variants[0];
    },
    [variantChoices]
  );

  const toggleProduct = useCallback(
    (product: ShopifyProduct) => {
      const variant = getSelectedVariant(product);
      if (!variant) return;
      const key = selectionKey(product.productId, variant.variantId);
      setSelections((prev) => {
        const next = new Map(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.set(key, {
            productId: product.productId,
            title: product.title,
            variantId: variant.variantId,
            variantTitle: variant.title,
            quantity: 1,
            price: variant.price,
            currency: variant.currency,
            image: product.image,
          });
        }
        return next;
      });
    },
    [getSelectedVariant]
  );

  const updateQuantity = useCallback((key: string, delta: number) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const item = next.get(key);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        next.delete(key);
      } else {
        next.set(key, { ...item, quantity: Math.min(newQty, 99) });
      }
      return next;
    });
  }, []);

  const removeSelection = useCallback((key: string) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const selectedList = useMemo(() => Array.from(selections.values()), [selections]);

  const totalPrice = useMemo(
    () => selectedList.reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0),
    [selectedList]
  );

  const totalCurrency = selectedList[0]?.currency || "EUR";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}>
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-100 px-6 pt-6 pb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Souhaitez-vous réserver des articles ?
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Parcourez notre sélection et ajoutez des produits à votre rendez-vous.
          </p>

          {/* Search */}
          <div className="relative mt-4">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        {/* Product grid - scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square rounded-xl bg-gray-100" />
                  <div className="mt-2 h-4 w-3/4 rounded bg-gray-100" />
                  <div className="mt-1 h-3 w-1/2 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <p className="mt-3 text-sm text-gray-500">{error}</p>
              <button
                onClick={() => fetchProducts(debouncedSearch)}
                className="mt-3 text-sm font-medium text-gray-900 underline">
                Réessayer
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <p className="mt-3 text-sm text-gray-500">
                {search ? "Aucun produit trouvé" : "Aucun produit disponible"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {products.map((product) => {
                const variant = getSelectedVariant(product);
                const key = variant ? selectionKey(product.productId, variant.variantId) : "";
                const isSelected = selections.has(key);

                return (
                  <div
                    key={product.productId}
                    className={`group relative cursor-pointer rounded-xl border-2 p-2 transition ${
                      isSelected
                        ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                        : "border-transparent bg-gray-50 hover:border-gray-200"
                    }`}
                    onClick={() => toggleProduct(product)}>
                    {/* Image */}
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                      {/* Checkmark badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="mt-2 px-1">
                      <p className="truncate text-sm font-medium text-gray-900">{product.title}</p>
                      <p className="text-sm text-gray-500">
                        {variant ? formatPrice(variant.price, variant.currency) : formatPrice(product.minPrice, product.currency)}
                      </p>

                      {/* Variant selector (only if >1 variant and not just "Default Title") */}
                      {product.variants.length > 1 && (
                        <select
                          className="mt-1.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-gray-400"
                          value={variantChoices.get(product.productId) || product.variants[0]?.variantId}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            const newVariantId = e.target.value;
                            setVariantChoices((prev) => new Map(prev).set(product.productId, newVariantId));
                            // If already selected, update selection with new variant
                            const oldVariant = getSelectedVariant(product);
                            if (oldVariant) {
                              const oldKey = selectionKey(product.productId, oldVariant.variantId);
                              if (selections.has(oldKey)) {
                                const newVariant = product.variants.find((v) => v.variantId === newVariantId);
                                if (newVariant) {
                                  setSelections((prev) => {
                                    const next = new Map(prev);
                                    const old = next.get(oldKey);
                                    if (old) {
                                      next.delete(oldKey);
                                      next.set(selectionKey(product.productId, newVariantId), {
                                        ...old,
                                        variantId: newVariantId,
                                        variantTitle: newVariant.title,
                                        price: newVariant.price,
                                        currency: newVariant.currency,
                                      });
                                    }
                                    return next;
                                  });
                                }
                              }
                            }
                          }}>
                          {product.variants.map((v) => (
                            <option key={v.variantId} value={v.variantId}>
                              {v.title} — {formatPrice(v.price, v.currency)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected products summary */}
        {selectedList.length > 0 && (
          <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Sélection ({selectedList.length} article{selectedList.length > 1 ? "s" : ""})
            </p>
            <div className="max-h-32 space-y-2 overflow-y-auto">
              {selectedList.map((item) => {
                const key = selectionKey(item.productId, item.variantId);
                return (
                  <div key={key} className="flex items-center gap-3 text-sm">
                    {/* Thumbnail */}
                    <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded bg-white">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <div className="h-full w-full bg-gray-200" />
                      )}
                    </div>
                    {/* Name + variant */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">{item.title}</p>
                      {item.variantTitle !== "Default Title" && (
                        <p className="truncate text-xs text-gray-500">{item.variantTitle}</p>
                      )}
                    </div>
                    {/* Qty controls */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(key, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-100">
                        <span className="text-xs font-bold">−</span>
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(key, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-100">
                        <span className="text-xs font-bold">+</span>
                      </button>
                    </div>
                    {/* Price */}
                    <span className="flex-shrink-0 text-sm font-medium text-gray-900">
                      {formatPrice(String(parseFloat(item.price) * item.quantity), item.currency)}
                    </span>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeSelection(key)}
                      className="flex-shrink-0 text-gray-400 transition hover:text-gray-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Total */}
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatPrice(String(totalPrice), totalCurrency)}</span>
            </div>
          </div>
        )}

        {/* Footer buttons */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-gray-500 transition hover:text-gray-700">
            Ignorer cette étape
          </button>
          <button
            type="button"
            onClick={() => onContinue(selectedList)}
            disabled={selectedList.length === 0}
            className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition ${
              selectedList.length > 0
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "cursor-not-allowed bg-gray-200 text-gray-400"
            }`}>
            {selectedList.length > 0
              ? `Confirmer (${selectedList.length} article${selectedList.length > 1 ? "s" : ""})`
              : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
