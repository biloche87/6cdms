/**
 * Client-side high-performance and resilient image compressor
 * Handles smartphone/tablet camera photos (including large raw camera captures)
 * Resizes to max 1280px and JPEG 0.82 for optimal performance and SQLite storage.
 * Fallback-safe: never rejects; always produces a usable data URL.
 */

export const compressImageFile = async (
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<string> => {
  // Method 1: Try createImageBitmap (modern, respects orientation, fastest)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file);
      let { width, height } = bitmap;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
        return canvas.toDataURL('image/jpeg', quality);
      }
      bitmap.close();
    } catch {
      // Fall through to traditional Image element if createImageBitmap fails
    }
  }

  // Method 2: Standard FileReader + HTMLImageElement + Canvas
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      // Emergency dummy fallback if FileReader completely fails
      resolve('');
    };

    reader.onload = (e) => {
      const rawDataUrl = (e.target?.result as string) || '';
      if (!rawDataUrl) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onerror = () => {
        // Return raw data URL if image decoding fails (e.g. unknown MIME)
        resolve(rawDataUrl);
      };

      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
};

export const compressDataUrl = (
  dataUrl: string,
  maxDim = 1280,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve('');
      return;
    }

    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
};
