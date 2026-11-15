import { createCrud } from "./firestoreCrud";
import type { UserProfile } from "../utils/types";

const crud = createCrud<UserProfile>("users");

/* Admin: User Management */
export async function getAllUsers() {
  const users = await crud.list();
  // sorted here so users without a createdAt field are not hidden
  return users.sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
  );
}
export const getUser = crud.get;
export const setUserBlocked = (id: string, blocked: boolean) =>
  crud.update(id, { status: blocked ? "blocked" : "active" });

/* Customer: update own profile (name / phone only) */
export const updateMyProfile = (
  id: string,
  data: Pick<Partial<UserProfile>, "name" | "phone">,
) => crud.update(id, data);
