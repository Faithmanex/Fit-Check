/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Returns a human-readable validation error, or null when the file is acceptable. */
export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/') || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return `“${file.name || 'That file'}” is not a supported image. Please use PNG, JPEG, WEBP, AVIF or HEIC.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That image is ${formatBytes(file.size)} — please choose one under ${formatBytes(MAX_UPLOAD_BYTES)}.`;
  }
  if (file.size === 0) {
    return 'That file appears to be empty. Please choose a different image.';
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uid(prefix = ''): string {
  const core = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return prefix ? `${prefix}_${core}` : core;
}

export function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Normalizes any image source (remote URL or data URL) into a data URL.
 * Tries a plain fetch first, then falls back to drawing the image onto a
 * canvas (requires CORS-clean source). Needed because Gemini inline parts
 * only accept base64 data URLs.
 */
export async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await readFileAsDataUrl(await response.blob());
  } catch {
    return new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.setAttribute('crossOrigin', 'anonymous');
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context.'));
        ctx.drawImage(image, 0, 0);
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Canvas export failed.'));
        }
      };
      image.onerror = () => reject(new Error('Could not load image.'));
      image.src = url;
    });
  }
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function formatDateRelative(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, totalPages };
}

export function getFriendlyErrorMessage(error: unknown, context: string): string {
    let rawMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        rawMessage = error.message;
    } else if (typeof error === 'string') {
        rawMessage = error;
    } else if (error) {
        rawMessage = String(error);
    }

    // Check for specific unsupported MIME type error from Gemini API
    if (rawMessage.includes("Unsupported MIME type")) {
        try {
            const errorJson = JSON.parse(rawMessage);
            const nestedMessage = errorJson?.error?.message;
            if (nestedMessage && nestedMessage.includes("Unsupported MIME type")) {
                const mimeType = nestedMessage.split(': ')[1] || 'unsupported';
                return `File type '${mimeType}' is not supported. Please use a format like PNG, JPEG, or WEBP.`;
            }
        } catch (e) {
            // Not a JSON string, but contains the text. Fallthrough to generic message.
        }
        return `Unsupported file format. Please upload an image format like PNG, JPEG, or WEBP.`;
    }

    if (/rate.?limit|resource.?exhausted|429|too many requests/i.test(rawMessage)) {
        return 'You are generating too quickly. Please wait a moment and try again.';
    }

    if (/network|failed to fetch|offline|navigator/i.test(rawMessage)) {
        return 'Network problem — check your connection and try again.';
    }

    return `${context}. ${rawMessage}`;
}
