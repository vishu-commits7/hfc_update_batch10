/**
 * Shared client-side image downscale/compress helper — used by both the
 * private on-device Progress Gallery (dataURL, kept in localStorage) and
 * the public Community Gallery (Blob, uploaded to Firebase Storage).
 */
const MAX_DIMENSION = 800;
const JPEG_QUALITY = 0.7;

function loadScaledCanvas(file: File, maxDim: number = MAX_DIMENSION): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressImageToDataUrl(
  file: File,
  maxDim: number = MAX_DIMENSION,
  quality: number = JPEG_QUALITY,
): Promise<string> {
  const canvas = await loadScaledCanvas(file, maxDim);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function compressImageToBlob(file: File): Promise<Blob> {
  const canvas = await loadScaledCanvas(file);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("Could not compress image"))), "image/jpeg", JPEG_QUALITY);
  });
}
