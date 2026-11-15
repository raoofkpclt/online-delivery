import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../config/firbase/firebase";
import { AppError } from "./authService";
// the S3 upload helper you shared; change the path if your file has another name
import { uploadFile, deleteFile } from "./uploadService";

/**
 * Site content (banners and posters) lives in ONE Firestore document: cms/banners
 * Each slot holds { url, link, alt } or null when empty. Images live in S3 under "cms/".
 */

export type BannerSlot =
  | "mainBanner" // big banner at the top of the home page
  | "poster1" // row of three posters on the home page, under the categories
  | "poster2"
  | "poster3"
  | "smallBanner" // 1600 x 300 banner between the two product lists on the home page
  | "bottomBanner" // last banner on the home page
  | "shopBanner"; // slim banner at the top of the shop page

export type Banner = {
  url: string;
  /** Where the banner goes when tapped: "/shop", "/product/123" or a full https:// address. Empty = not clickable. */
  link: string;
  /** Short description for screen readers. */
  alt: string;
};

export type Banners = Record<BannerSlot, Banner | null>;

export const BANNER_SLOTS: BannerSlot[] = [
  "mainBanner",
  "poster1",
  "poster2",
  "poster3",
  "smallBanner",
  "bottomBanner",
  "shopBanner",
];

/** The ONE place where required image sizes are defined (px). */
export const BANNER_SIZES: Record<
  BannerSlot,
  { width: number; height: number }
> = {
  mainBanner: { width: 1600, height: 600 },
  smallBanner: { width: 1600, height: 300 },
  bottomBanner: { width: 1600, height: 300 },
  shopBanner: { width: 1600, height: 300 },
  poster1: { width: 600, height: 400 },
  poster2: { width: 600, height: 400 },
  poster3: { width: 600, height: 400 },
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;

const bannersRef = doc(db, "cms", "banners");

/** Reads the real pixel size of an image file in the browser. */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AppError("This file could not be read as an image."));
    };
    img.src = url;
  });
}

/** Throws unless the image is exactly the size this slot needs. */
export async function checkImageSize(
  slot: BannerSlot,
  file: File,
): Promise<void> {
  const { width, height } = await readImageSize(file);
  const need = BANNER_SIZES[slot];
  if (width !== need.width || height !== need.height) {
    throw new AppError(
      `This image is ${width} × ${height} px. It must be exactly ${need.width} × ${need.height} px.`,
    );
  }
}

/** Reads every slot. Missing slots come back as null, so this never needs seeding. */
export async function getBanners(): Promise<Banners> {
  const snap = await getDoc(bannersRef);
  const data = snap.exists() ? snap.data() : {};

  const out = {} as Banners;
  for (const slot of BANNER_SLOTS) {
    const v = data[slot];
    out[slot] = v?.url
      ? { url: v.url, link: v.link ?? "", alt: v.alt ?? "" }
      : null;
  }
  return out;
}

const validLink = (link: string) =>
  link === "" || link.startsWith("/") || /^https?:\/\//i.test(link);

/**
 * Saves one slot (admin).
 *  - with `file`: checks the size, uploads the new image, then removes the old one from S3
 *  - without `file`: keeps the current image and only updates link / alt
 */
export async function saveBanner(
  slot: BannerSlot,
  input: { file?: File | null; link: string; alt: string },
  current: Banner | null,
): Promise<Banner> {
  const link = input.link.trim();
  const alt = input.alt.trim();
  if (!validLink(link))
    throw new AppError(
      'The link must start with "/" (for example /shop) or "https://".',
    );

  let url = current?.url;
  let uploadedUrl: string | undefined;

  if (input.file) {
    await checkImageSize(slot, input.file); // fixed-size rule, enforced here so it can't be bypassed
    const up = await uploadFile(input.file, {
      folder: "cms",
      allowedTypes: IMAGE_TYPES,
      maxSizeMB: MAX_MB,
    });
    url = up.url;
    uploadedUrl = up.url;
  }
  if (!url) throw new AppError("Choose an image first.");

  const banner: Banner = { url, link, alt };

  try {
    await setDoc(
      bannersRef,
      { [slot]: banner, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.error(err);
    if (uploadedUrl) await deleteFile(uploadedUrl).catch(() => {}); // don't leave an unused upload behind
    throw new AppError("Could not save the banner. Please try again.");
  }

  // the old image is no longer used
  if (uploadedUrl && current?.url && current.url !== uploadedUrl) {
    await deleteFile(current.url).catch((e) =>
      console.error("Could not delete old banner image:", e),
    );
  }

  return banner;
}

/** Empties one slot and deletes its image from S3 (admin). */
export async function removeBanner(
  slot: BannerSlot,
  current: Banner | null,
): Promise<void> {
  try {
    await setDoc(
      bannersRef,
      { [slot]: null, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.error(err);
    throw new AppError("Could not remove the banner. Please try again.");
  }
  if (current?.url) {
    await deleteFile(current.url).catch((e) =>
      console.error("Could not delete banner image:", e),
    );
  }
}
