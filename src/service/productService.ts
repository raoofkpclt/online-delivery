import { where, type QueryConstraint } from "firebase/firestore";
import { createCrud } from "./firestoreCrud";
import type { Product } from "../utils/types";

const crud = createCrud<Product>("products");

/** Shop page: pass onlyActive for customers, nothing for admin. */
export function getProducts(
  opts: { categoryId?: string; onlyActive?: boolean } = {},
) {
  const constraints: QueryConstraint[] = [];
  if (opts.onlyActive) constraints.push(where("isActive", "==", true));
  if (opts.categoryId)
    constraints.push(where("categoryId", "==", opts.categoryId));
  return crud.list(...constraints);
}

export const getProduct = crud.get;

/** Simple client-side search (fine for small catalogues). */
export async function searchProducts(text: string) {
  const all = await getProducts({ onlyActive: true });
  const q = text.trim().toLowerCase();
  return q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
}

export async function isProductCodeTaken(code: string, ignoreId?: string) {
  const found = await crud.list(where("code", "==", code.trim().toUpperCase()));
  return found.some((p) => p.id !== ignoreId);
}

/* Admin: Product Management */
export const addProduct = crud.create;
export const updateProduct = crud.update;
export const deleteProduct = crud.remove;
