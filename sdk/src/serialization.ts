/**
 * @module serialization
 * @description Base64 URL-safe encoding / decoding and typed envelope
 * serialization for the OpenRails V1 arc-policy-envelope transport format.
 *
 * The wire format is: `Base64URL( JSON.stringify(payload) )`.
 */

import { PayloadSerializationError } from './errors';

/**
 * Encode a UTF-8 string into a Base64 URL-safe token.
 *
 * Standard Base64 characters are replaced:
 * - `+` → `-`
 * - `/` → `_`
 * - trailing `=` padding is stripped
 *
 * @param data - raw UTF-8 string to encode
 * @returns Base64 URL-safe encoded string
 */
export function base64UrlEncode(data: string): string {
  return encodeBase64(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode a Base64 URL-safe token back into a UTF-8 string.
 *
 * Re-adds mathematical padding (`=`) and reverses the URL-safe character swap
 * before decoding.
 *
 * @param token - Base64 URL-safe encoded string
 * @returns decoded UTF-8 string
 */
export function base64UrlDecode(token: string): string {
  // Reverse URL-safe substitutions
  let base64 = token.replace(/-/g, '+').replace(/_/g, '/');

  // Re-add padding: standard Base64 length is always a multiple of 4
  const padLength = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padLength);

  return decodeBase64(base64);
}

export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  return encodeBase64Bytes(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function base64UrlDecodeBytes(token: string): Uint8Array {
  let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padLength);
  return decodeBase64Bytes(base64);
}

/**
 * Serialize an arbitrary payload object into a Base64 URL-safe envelope token.
 *
 * @param payload - JSON-serializable object
 * @returns Base64 URL-safe encoded token
 * @throws {PayloadSerializationError} if JSON stringification fails
 */
export function serializeEnvelope(payload: object): string {
  try {
    const json = JSON.stringify(payload);
    return base64UrlEncode(json);
  } catch (err) {
    throw new PayloadSerializationError(
      `Failed to serialize envelope: ${(err as Error).message}`,
    );
  }
}

/**
 * Deserialize a Base64 URL-safe envelope token back into a typed object.
 *
 * @typeParam T - expected shape of the decoded payload
 * @param token - Base64 URL-safe encoded token
 * @returns parsed payload of type T
 * @throws {PayloadSerializationError} if decoding or JSON parsing fails
 */
export function deserializeEnvelope<T>(token: string): T {
  try {
    const json = base64UrlDecode(token);
    return JSON.parse(json) as T;
  } catch (err) {
    if (err instanceof PayloadSerializationError) throw err;
    throw new PayloadSerializationError(
      `Failed to deserialize envelope: ${(err as Error).message}`,
    );
  }
}

function encodeBase64(data: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data, 'utf-8').toString('base64');
  }

  const bytes = new TextEncoder().encode(data);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(data: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data, 'base64').toString('utf-8');
  }

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function encodeBase64Bytes(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Bytes(data: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(data, 'base64'));
  }

  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
