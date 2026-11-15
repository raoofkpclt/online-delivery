import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { OrderItem, Product } from "../../utils/types";
import { packPrice } from "../../utils/weight";

export type CartItem = {
  productId: string;
  name: string;
  /**
   * Normal products: price of ONE unit when it was added (offer price included).
   * Products sold per kg: the price of the WHOLE weight in the cart (ratePerKg × grams / 1000).
   */
  price: number;
  /** Units for normal products. Always 1 for products sold per kg. */
  quantity: number;
  image?: string;
  unit?: string;
  /** Latest known stock (units, or kg for products sold per kg). Used as the limit. */
  stock: number;
  /** Total weight in the cart in grams. Only set for products sold per kg. */
  grams?: number;
  /** Per-kg rate the customer saw (offer price included). Only for products sold per kg. */
  ratePerKg?: number;
};

/** What addItem accepts: a product, plus the weight when it is sold per kg. */
export type CartProduct = Product & { grams?: number; ratePerKg?: number };

type CartContextValue = {
  items: CartItem[];
  /** Number of units in the cart (for the navbar badge). A kg product counts as 1. */
  count: number;
  subtotal: number;
  /** Adds to the cart without going over stock. Returns false if nothing could be added. */
  addItem: (product: CartProduct, qty?: number) => boolean;
  /** Sets an exact quantity. 0 removes the item. (Ignored for products sold per kg, use setWeight.) */
  setQuantity: (productId: string, qty: number) => void;
  /** Sets the exact weight in grams of a product sold per kg. 0 or less removes it. */
  setWeight: (productId: string, grams: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  /** Updates the known stock of cart lines. Map is productId -> stock from Firestore. */
  syncStock: (stockById: Record<string, number>) => void;
  /** Cart lines in the shape orders are saved with (weight and rate included for kg products) */
  toOrderItems: () => OrderItem[];
};

const STORAGE_KEY = "rahath_cart";

const CartContext = createContext<CartContextValue | null>(null);

function isCartItem(x: unknown): x is CartItem {
  const i = x as CartItem;
  return (
    !!i &&
    typeof i.productId === "string" &&
    typeof i.name === "string" &&
    typeof i.price === "number" &&
    Number.isInteger(i.quantity) &&
    i.quantity > 0 &&
    typeof i.stock === "number" &&
    (i.grams === undefined || (typeof i.grams === "number" && i.grams > 0))
  );
}

function readStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

const maxGramsOf = (stockKg: number) => Math.max(0, Math.floor(stockKg * 1000));

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readStorage);

  // keep the cart saved between visits
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full or blocked: the cart still works for this visit */
    }
  }, [items]);

  // keep several open tabs in step
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addItem = useCallback((product: CartProduct, qty = 1) => {
    if (product.stock <= 0 || qty < 1) return false;
    let added = false;

    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);

      /* ---- product sold per kg: one line, the weight adds up ---- */
      if (product.grams && product.grams > 0) {
        const rate = product.ratePerKg ?? Math.round(((product.price * 1000) / product.grams) * 100) / 100;
        const current = existing?.grams ?? 0;
        const next = Math.min(current + product.grams, maxGramsOf(product.stock));
        if (next <= current) return prev; // already at the stock limit
        added = true;
        const line: CartItem = {
          productId: product.id,
          name: product.name,
          price: packPrice(rate, next),
          quantity: 1,
          image: product.images?.[0],
          unit: product.unit,
          stock: product.stock,
          grams: next,
          ratePerKg: rate,
        };
        return existing ? prev.map((i) => (i.productId === product.id ? line : i)) : [...prev, line];
      }

      /* ---- normal product: quantity ---- */
      const current = existing?.quantity ?? 0;
      const next = Math.min(current + qty, product.stock);
      if (next <= current) return prev; // already at the stock limit
      added = true;
      const line: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: next,
        image: product.images?.[0],
        unit: product.unit,
        stock: product.stock,
      };
      return existing ? prev.map((i) => (i.productId === product.id ? line : i)) : [...prev, line];
    });
    return added;
  }, []);

  const setQuantity = useCallback((productId: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) =>
            i.productId === productId && !i.grams // kg products are changed with setWeight
              ? { ...i, quantity: Math.min(Math.floor(qty), i.stock) }
              : i
          )
    );
  }, []);

  const setWeight = useCallback((productId: string, grams: number) => {
    setItems((prev) => {
      if (grams <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => {
        if (i.productId !== productId || !i.grams) return i;
        const g = Math.min(Math.floor(grams), maxGramsOf(i.stock));
        const rate = i.ratePerKg ?? Math.round(((i.price * 1000) / i.grams) * 100) / 100;
        return { ...i, grams: g, ratePerKg: rate, price: packPrice(rate, g) };
      });
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const syncStock = useCallback((stockById: Record<string, number>) => {
    setItems((prev) => {
      let changed = false;
      const next = prev.map((i) => {
        const s = stockById[i.productId];
        if (s === undefined || s === i.stock) return i;
        changed = true;
        return { ...i, stock: s };
      });
      return changed ? next : prev;
    });
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.price * i.quantity, 0),
      addItem,
      setQuantity,
      setWeight,
      removeItem,
      clear,
      syncStock,
      toOrderItems: () =>
        items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          // saved on the order so the bill and admin can show how much was bought
          ...(i.grams ? { grams: i.grams, ratePerKg: i.ratePerKg } : {}),
        })),
    }),
    [items, addItem, setQuantity, setWeight, removeItem, clear, syncStock]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>.");
  return ctx;
}