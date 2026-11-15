import { where } from "firebase/firestore";
import { createCrud } from "./firestoreCrud";
import type { Offer } from "../utils/types";

const crud = createCrud<Offer>("offers");

/* Admin */
export const getOffers = () => crud.list();
export const addOffer = crud.create;
export const updateOffer = crud.update;
export const deleteOffer = crud.remove;

/* Customer: offers running right now (Home banners, Shop prices) */
export async function getActiveOffers() {
  const offers = await crud.list(where("isActive", "==", true));
  const now = Date.now();
  return offers.filter(
    (o) => o.startsAt.toMillis() <= now && o.endsAt.toMillis() >= now,
  );
}
