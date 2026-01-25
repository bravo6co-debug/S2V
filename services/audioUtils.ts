/**
 * Audio utilities using Mediabunny
 * For calculating audio duration from base64 data or URLs
 */

import { Input, ALL_FORMATS, UrlSource } from 'mediabunny';

/**
 * Get audio duration from a URL
 * @param src - URL of the audio file
 * @returns Duration in seconds
 */
export const getAudioDuration = async (src: string): Promise<number> => {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new UrlSource(src, {
      getRetryDelay: () => null,
    }),
  });

  const durationInSeconds = await input.computeDuration();
  return durationInSeconds;
};

/**
 * Get audio duration from base64 data
 * @param base64Data - Base64 encoded audio data
 * @param mimeType - MIME type of the audio (e.g., 'audio/wav')
 * @returns Duration in milliseconds
 */
export const getAudioDurationFromBase64 = async (
  base64Data: string,
  mimeType: string = 'audio/wav'
): Promise<number> => {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  const durationInSeconds = await getAudioDuration(dataUrl);
  return Math.round(durationInSeconds * 1000); // Convert to milliseconds
};
