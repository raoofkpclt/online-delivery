import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "../config/firbase/firebase";

export const withId = <T>(id: string, data: DocumentData) =>
  ({ id, ...data }) as T;

/** Small reusable CRUD helper so every service stays short. */
export function createCrud<T extends { id: string }>(collectionName: string) {
  const col = collection(db, collectionName);

  return {
    async list(...constraints: QueryConstraint[]): Promise<T[]> {
      const snap = await getDocs(query(col, ...constraints));
      return snap.docs.map((d) => withId<T>(d.id, d.data()));
    },

    async get(id: string): Promise<T | null> {
      const snap = await getDoc(doc(db, collectionName, id));
      return snap.exists() ? withId<T>(snap.id, snap.data()) : null;
    },

    async create(data: Omit<T, "id" | "createdAt">): Promise<string> {
      const ref = await addDoc(col, { ...data, createdAt: serverTimestamp() });
      return ref.id;
    },

    async update(id: string, data: Partial<Omit<T, "id">>): Promise<void> {
      await updateDoc(doc(db, collectionName, id), { ...data } as DocumentData);
    },

    async remove(id: string): Promise<void> {
      await deleteDoc(doc(db, collectionName, id));
    },
  };
}
