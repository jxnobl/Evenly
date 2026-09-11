import { supabase } from "./supabase";

/**
 * Resizes and compresses an image to maximum dimensions and WebP/JPEG format
 * Shrinks 5MB phone screenshots to ~50KB without losing QR readability.
 */
export async function compressQrImage(file: File, maxDimension = 600, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Deletes a file from the qr-codes bucket given its public URL
 */
export async function deleteQrFromStorage(publicUrl?: string | null) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split("/qr-codes/");
    if (pathParts.length > 1) {
      const filePath = decodeURIComponent(pathParts[1]);
      await supabase.storage.from("qr-codes").remove([filePath]);
    }
  } catch (err) {
    console.error("Failed to delete old storage file:", err);
  }
}