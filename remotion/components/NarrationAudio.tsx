import React, { useMemo, useEffect, useRef } from 'react';
import { Audio } from '@remotion/media';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { NarrationAudio as NarrationAudioType } from '../../types';

interface NarrationAudioProps {
  audio: NarrationAudioType;
  volume?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
}

/**
 * Base64 문자열을 Blob URL로 변환
 */
function base64ToBlobUrl(base64Data: string, mimeType: string): string {
  try {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to convert base64 to blob URL:', error);
    // Fallback to data URL
    return `data:${mimeType};base64,${base64Data}`;
  }
}

/**
 * Remotion audio component for TTS narration
 * Renders base64-encoded audio data as an audio track using Blob URL
 */
export const NarrationAudio: React.FC<NarrationAudioProps> = ({
  audio,
  volume = 1,
  fadeIn = true,
  fadeOut = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const blobUrlRef = useRef<string | null>(null);

  // Convert base64 to Blob URL for better browser compatibility
  const audioUrl = useMemo(() => {
    if (!audio?.data) return null;

    // Cleanup previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    const url = base64ToBlobUrl(audio.data, audio.mimeType || 'audio/wav');
    blobUrlRef.current = url;
    return url;
  }, [audio?.data, audio?.mimeType]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  if (!audioUrl) return null;

  // Calculate volume with fade effects
  const fadeFrames = Math.round(fps * 0.3); // 0.3초 페이드
  let currentVolume = volume;

  if (fadeIn && fadeOut) {
    currentVolume = interpolate(
      frame,
      [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
      [0, volume, volume, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  } else if (fadeIn) {
    currentVolume = interpolate(
      frame,
      [0, fadeFrames],
      [0, volume],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  } else if (fadeOut) {
    currentVolume = interpolate(
      frame,
      [durationInFrames - fadeFrames, durationInFrames],
      [volume, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  }

  return (
    <Audio
      src={audioUrl}
      volume={currentVolume}
      startFrom={0}
      endAt={durationInFrames}
    />
  );
};

export default NarrationAudio;
