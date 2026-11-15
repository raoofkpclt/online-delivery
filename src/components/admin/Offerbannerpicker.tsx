import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  OFFER_BANNER,
  checkOfferImageSize,
} from "../../service/offerImage";

type Props = {
  /** The image already saved on the offer (if any). */
  currentUrl?: string;

  /** A newly chosen image that is not uploaded yet. */
  file: File | null;

  onFile: (file: File | null) => void;

  /** Removes the currently saved banner from the offer. */
  onRemoveCurrent: () => void;

  disabled?: boolean;
};

const sizeLabel = `${OFFER_BANNER.width} × ${OFFER_BANNER.height} px`;

/**
 * Chooses an offer banner and rejects images that are not
 * exactly the required dimensions.
 */
export default function OfferBannerPicker({
  currentUrl,
  file,
  onFile,
  onRemoveCurrent,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  // Create and clean up the local preview URL.
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // Handle image selection and validate dimensions.
  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;

    // Allows selecting the same file again.
    e.target.value = "";

    if (!selectedFile) return;

    try {
      await checkOfferImageSize(selectedFile);

      setError("");
      onFile(selectedFile);
    } catch (err) {
      onFile(null);

      setError(
        err instanceof Error
          ? err.message
          : "Could not read this image."
      );
    }
  }

  // Display the newly selected image first, otherwise saved image.
  const shown = preview || currentUrl || "";

  return (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-stone-700">
          Offer banner
        </span>

        <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
          Required size {sizeLabel}
        </span>
      </div>

      {/* Image preview */}
      <div
        className="relative w-full overflow-hidden rounded-md border border-dashed border-stone-300 bg-stone-50"
        style={{
          aspectRatio: `${OFFER_BANNER.width} / ${OFFER_BANNER.height}`,
        }}
      >
        {shown ? (
          <img
            src={shown}
            alt="Offer banner preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-stone-400">
            No image yet
          </div>
        )}

        {/* Unsaved image indicator */}
        {file && (
          <span className="absolute left-2 top-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            Not saved yet
          </span>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={pick}
        disabled={disabled}
      />

      {/* Action buttons */}
      <div className="mt-2 flex flex-wrap gap-2">
        {/* Choose image */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          {shown ? "Choose another image" : "Choose image"} (exactly{" "}
          {sizeLabel})
        </button>

        {/* Discard newly selected image */}
        {file && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onFile(null);
              setError("");
            }}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-60"
          >
            Discard new image
          </button>
        )}

        {/* Remove existing saved image */}
        {currentUrl && !file && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemoveCurrent}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Remove current banner
          </button>
        )}
      </div>

      {/* Validation error */}
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
    </div>
  );
}
