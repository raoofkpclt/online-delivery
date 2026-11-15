import { AppError } from "./authService";
import { uploadFile, deleteFile } from "./uploadService";

/** Required size of an offer banner (px). */
export const OFFER_BANNER = { width: 1600, height: 600 } as const;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 5;

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

/** Throws unless the image is exactly 1600 × 600 px. */
export async function checkOfferImageSize(file: File): Promise<void> {
  const { width, height } = await readImageSize(file);
  if (width !== OFFER_BANNER.width || height !== OFFER_BANNER.height) {
    throw new AppError(
      `This image is ${width} × ${height} px. It must be exactly ${OFFER_BANNER.width} × ${OFFER_BANNER.height} px.`,
    );
  }
}

/** Checks the size, uploads to S3 under "offers/", and returns the public URL. */
export async function uploadOfferImage(file: File): Promise<string> {
  await checkOfferImageSize(file); // enforced here too, so it can't be bypassed
  const up = await uploadFile(file, {
    folder: "offers",
    allowedTypes: IMAGE_TYPES,
    maxSizeMB: MAX_MB,
  });
  return up.url;
}

/** Deletes an old offer image. Never throws; old Firebase URLs are ignored. */
export async function deleteOfferImage(url?: string | null): Promise<void> {
  if (!url) return;
  await deleteFile(url).catch((e) =>
    console.error("Could not delete offer image:", e),
  );
}
