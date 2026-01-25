import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AnimationConfig, ImageData } from '../../types';

interface KenBurnsEffectProps {
  imageData: ImageData;
  animation?: AnimationConfig;
  durationInFrames?: number;
}

export const KenBurnsEffect: React.FC<KenBurnsEffectProps> = ({
  imageData,
  animation = { type: 'kenBurns', direction: 'in', intensity: 0.5 },
  durationInFrames: propDuration,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames: configDuration } = useVideoConfig();
  const durationInFrames = propDuration || configDuration;

  const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;

  // 애니메이션 강도 (0-1 범위)
  const intensity = animation.intensity ?? 0.5;
  const maxScale = 1 + intensity * 0.3; // 최대 1.3배 확대
  const maxTranslate = intensity * 5; // 최대 5% 이동

  // 애니메이션 진행률 (0-1)
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  switch (animation.type) {
    case 'kenBurns':
      // Ken Burns: 서서히 확대하면서 이동
      if (animation.direction === 'in') {
        scale = interpolate(progress, [0, 1], [1, maxScale]);
        translateX = interpolate(progress, [0, 1], [0, maxTranslate]);
        translateY = interpolate(progress, [0, 1], [0, -maxTranslate * 0.5]);
      } else {
        scale = interpolate(progress, [0, 1], [maxScale, 1]);
        translateX = interpolate(progress, [0, 1], [maxTranslate, 0]);
        translateY = interpolate(progress, [0, 1], [-maxTranslate * 0.5, 0]);
      }
      break;

    case 'zoom':
      // 줌: 확대 또는 축소만
      if (animation.direction === 'in') {
        scale = interpolate(progress, [0, 1], [1, maxScale]);
      } else {
        scale = interpolate(progress, [0, 1], [maxScale, 1]);
      }
      break;

    case 'pan':
      // 팬: 이동만
      scale = 1.1; // 약간 확대해서 이동 공간 확보
      switch (animation.direction) {
        case 'left':
          translateX = interpolate(progress, [0, 1], [maxTranslate, -maxTranslate]);
          break;
        case 'right':
          translateX = interpolate(progress, [0, 1], [-maxTranslate, maxTranslate]);
          break;
        default:
          translateY = interpolate(progress, [0, 1], [maxTranslate, -maxTranslate]);
      }
      break;

    case 'none':
    default:
      // 정적 이미지
      scale = 1;
      translateX = 0;
      translateY = 0;
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={imageSrc}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  );
};
