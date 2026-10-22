import React, { useState, useEffect } from 'react';

const thumbnailCache = new Map<string, string>();

interface ThumbnailImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  maxSize?: number;
}

/**
 * ThumbnailImage downsamples oversized base64/URL images to a lightweight 160px square
 * thumbnail using canvas and caches the result. Also enforces loading="lazy" and decoding="async".
 */
export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  src,
  alt = '',
  className = '',
  maxSize = 160,
  ...props
}) => {
  const [thumbSrc, setThumbSrc] = useState<string>(() => thumbnailCache.get(src) || src);

  useEffect(() => {
    if (!src) return;
    if (thumbnailCache.has(src)) {
      setThumbSrc(thumbnailCache.get(src)!);
      return;
    }

    // If source is already lightweight or not a data URL, use directly
    if (!src.startsWith('data:image/') || src.length < 50_000) {
      thumbnailCache.set(src, src);
      setThumbSrc(src);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      if (!isMounted) return;
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          thumbnailCache.set(src, dataUrl);
          if (isMounted) setThumbSrc(dataUrl);
        }
      } catch {
        if (isMounted) setThumbSrc(src);
      }
    };

    img.onerror = () => {
      if (isMounted) setThumbSrc(src);
    };

    img.src = src;

    return () => {
      isMounted = false;
    };
  }, [src, maxSize]);

  return (
    <img
      src={thumbSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      {...props}
    />
  );
};
