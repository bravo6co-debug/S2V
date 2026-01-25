import React from 'react';
import { Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { NarrationAudio as NarrationAudioType } from '../../types';

interface NarrationAudioProps {
  audio: NarrationAudioType;
  volume?: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
}

/**
 * Remotion audio component for TTS narration
 * Renders base64-encoded audio data as an audio track
 */
export const NarrationAudio: React.FC<NarrationAudioProps> = ({
  audio,
  volume = 1,
  fadeIn = true,
  fadeOut = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  if (!audio?.data) return null;

  // Create data URL from base64 audio data
  const audioUrl = `data:${audio.mimeType || 'audio/wav'};base64,${audio.data}`;

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
    />
  );
};

export default NarrationAudio;
