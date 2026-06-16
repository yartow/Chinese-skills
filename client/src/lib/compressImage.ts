const MAX_DIMENSION = 512;
const JPEG_QUALITY = 0.85;

/** Resize and re-encode an image in the browser before upload (server finalizes to 256×256). */
export async function compressImageForUpload(file: File): Promise<File> {
  const img = await loadImage(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");

    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToJpegBlob(canvas, JPEG_QUALITY);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid or unsupported image format"));
    };
    img.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image"))),
      "image/jpeg",
      quality,
    );
  });
}
