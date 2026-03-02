/**
 * Input sanitization utilities to prevent XSS attacks
 */

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strips all HTML tags from a string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Sanitizes user input by trimming and removing potentially dangerous characters
 */
export function sanitizeInput(input: string, maxLength: number = 500): string {
  return stripHtml(input).trim().slice(0, maxLength);
}

/**
 * Validates and sanitizes a URL
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Validates file MIME type against allowed types
 */
export function validateFileType(
  file: File,
  allowedTypes: string[]
): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Validates file size
 */
export function validateFileSize(
  file: File,
  maxSizeInMB: number
): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  file: File,
  options: {
    maxSizeMB: number;
    allowedTypes: string[];
  }
): { valid: boolean; error?: string } {
  if (!validateFileSize(file, options.maxSizeMB)) {
    return {
      valid: false,
      error: `File must be smaller than ${options.maxSizeMB}MB`,
    };
  }

  if (!validateFileType(file, options.allowedTypes)) {
    return {
      valid: false,
      error: "Invalid file type",
    };
  }

  return { valid: true };
}
