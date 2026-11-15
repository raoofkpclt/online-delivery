import { where } from "firebase/firestore";
import { createCrud } from "./firestoreCrud";
import type { Category } from "../utils/types";

const crud = createCrud<Category>("categories");

export const getCategories = (onlyActive = false) =>
  onlyActive ? crud.list(where("isActive", "==", true)) : crud.list();
export const addCategory = crud.create;
export const updateCategory = crud.update;
export const deleteCategory = crud.remove;
