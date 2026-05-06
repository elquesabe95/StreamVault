/**
 * Utility functions for scrapers to handle encryption and obfuscation
 */

/**
 * Decodes a base64 string safely
 */
export function decodeBase64(str: string): string {
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch (e) {
    console.error("Error decoding base64:", e);
    return "";
  }
}

/**
 * Decodes a XOR encrypted string with a given key
 */
export function decodeXOR(encodedStr: string, key: string): string {
  let result = '';
  for (let i = 0; i < encodedStr.length; i++) {
    result += String.fromCharCode(encodedStr.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/**
 * Extract an attribute value from an HTML string using regex
 */
export function extractAttribute(html: string, selector: string, attribute: string): string | null {
  // Simple regex-based extraction for speed in serverless environments
  const regex = new RegExp(`${selector}[^>]*${attribute}=["']([^"']+)["']`, 'i');
  const match = regex.exec(html);
  return match ? match[1] : null;
}

/**
 * Clean HTML tags from a string
 */
export function cleanHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
