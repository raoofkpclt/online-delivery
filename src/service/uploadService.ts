import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client, {
  S3_BUCKET_NAME,
  AWS_REGION,
} from "../config/s3Bucket/s3Bucket";

export interface UploadedFile {
  url: string;
  key: string;
  name: string;
  type: string;
  size: number;
}

export interface UploadOptions {
  folder?: string;
  allowedTypes?: string[];
  maxSizeMB?: number;
}

/** Errors with a message that is safe to show to the admin. */
export class UploadError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "UploadError";
  }
}

const sanitizeFileName = (fileName: string): string =>
  fileName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "");

/** Public base URL of the bucket, e.g. https://my-bucket.s3.ap-south-1.amazonaws.com/ */
const bucketBaseUrl = () =>
  `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/`;

/* ───────── upload ───────── */

export const uploadFile = async (
  file: File,
  options: UploadOptions = {},
): Promise<UploadedFile> => {
  const {
    folder = "uploads",
    allowedTypes = ["image/", "video/"],
    maxSizeMB = 50,
  } = options;

  if (!file) throw new UploadError("File is required.");

  const isAllowed = allowedTypes.some((type) =>
    type.endsWith("/") ? file.type.startsWith(type) : file.type === type,
  );
  if (!isAllowed) {
    const kinds = allowedTypes.map((t) => t.replace(/\/$/, "")).join(" or ");
    throw new UploadError(`Only ${kinds} files are allowed.`);
  }

  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new UploadError(`"${file.name}" is larger than ${maxSizeMB} MB.`);
  }

  if (!S3_BUCKET_NAME)
    throw new UploadError("S3 bucket name is missing in your .env file.");
  if (!AWS_REGION)
    throw new UploadError("AWS region is missing in your .env file.");

  const cleanFileName = sanitizeFileName(file.name) || "file";
  const uniqueFileName = `${Date.now()}-${crypto.randomUUID()}-${cleanFileName}`;
  const cleanFolder = folder
    .split("/")
    .filter(Boolean)
    .map(sanitizeFileName)
    .join("/");
  const key = cleanFolder ? `${cleanFolder}/${uniqueFileName}` : uniqueFileName;

  try {
    const body = new Uint8Array(await file.arrayBuffer());

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: file.type,
        ContentLength: file.size,
        // file names are unique, so browsers can cache them for a long time
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (error) {
    console.error("S3 upload error:", error);
    throw new UploadError(
      "Could not upload the image. Please try again.",
      error,
    );
  }

  const encodedKey = key.split("/").map(encodeURIComponent).join("/");

  return {
    url: `${bucketBaseUrl()}${encodedKey}`,
    key,
    name: file.name,
    type: file.type,
    size: file.size,
  };
};

/** Uploads all files. If one fails, the ones already uploaded are removed again. */
export const uploadMultipleFiles = async (
  files: File[],
  options: UploadOptions = {},
): Promise<UploadedFile[]> => {
  const results = await Promise.allSettled(
    files.map((f) => uploadFile(f, options)),
  );

  const ok = results.flatMap((r) =>
    r.status === "fulfilled" ? [r.value] : [],
  );
  const failed = results.find(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );

  if (failed) {
    await deleteFilesByUrl(ok.map((f) => f.url));
    throw failed.reason;
  }
  return ok;
};

/* ───────── delete ───────── */

/** Pulls the S3 key out of one of our file URLs. Returns null for any other URL. */
export const getKeyFromUrl = (url: string): string | null => {
  const base = bucketBaseUrl();
  if (!url.startsWith(base)) return null;
  return decodeURIComponent(url.slice(base.length).split("?")[0]);
};

/** Deletes one file. Accepts the file URL or the S3 key. */
export const deleteFile = async (urlOrKey: string): Promise<void> => {
  const key = /^https?:\/\//.test(urlOrKey)
    ? getKeyFromUrl(urlOrKey)
    : urlOrKey;
  if (!key) return; // not an S3 file of ours (for example an old Firebase image), so leave it
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key }),
  );
};

/** Best-effort delete of several files. Never throws. */
export const deleteFilesByUrl = async (urls: string[]): Promise<void> => {
  const results = await Promise.allSettled(urls.map((u) => deleteFile(u)));
  results.forEach((r) => {
    if (r.status === "rejected") console.error("S3 delete error:", r.reason);
  });
};
