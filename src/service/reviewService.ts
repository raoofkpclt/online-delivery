import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firbase/firebase";
import type { Review } from "../utils/types";

/** One review per order, and one per product in that order. */
export const reviewId = (orderId: string, productId: string | null) =>
  `${orderId}_${productId ?? "order"}`;

export type ReviewInput = {
  orderId: string;
  productId: string | null; // null = review of the whole order
  productName?: string;
  userId: string;
  userName: string;
  rating: number; // 1–5
  comment: string;
};

const toReview = (d: { id: string; data: () => unknown }) => ({
  id: d.id,
  ...(d.data() as Omit<Review, "id">),
});

/** Customer: every review this person has written (for the Orders page). */
export async function getMyReviews(userId: string): Promise<Review[]> {
  const snap = await getDocs(
    query(collection(db, "reviews"), where("userId", "==", userId)),
  );
  return snap.docs.map(toReview);
}

/** Storefront: reviews for one product, newest first (for a product page). */
export async function getProductReviews(productId: string): Promise<Review[]> {
  const snap = await getDocs(
    query(collection(db, "reviews"), where("productId", "==", productId)),
  );
  return snap.docs
    .map(toReview)
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

/** Creates the review, or edits it if it already exists. */
export async function saveReview(input: ReviewInput) {
  const ref = doc(db, "reviews", reviewId(input.orderId, input.productId));
  const comment = input.comment.trim();
  const existing = await getDoc(ref);

  if (existing.exists()) {
    await updateDoc(ref, {
      rating: input.rating,
      comment,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      orderId: input.orderId,
      productId: input.productId,
      productName: input.productName ?? "",
      userId: input.userId,
      userName: input.userName,
      rating: input.rating,
      comment,
      createdAt: serverTimestamp(),
    });
  }
}
