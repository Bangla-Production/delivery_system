// Shrinks a photo in the browser before upload (phone photos are 3-8 MB; this makes them ~100-400 KB).
// Returns a JPEG Blob.
export function compressToBlob(file, max = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process that image"))), "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = url;
  });
}
