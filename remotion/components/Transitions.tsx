import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import type { ImageData } from '../../types';
import type { TransitionConfig } from '../types';

interface TransitionProps {
  type: TransitionConfig['type'];
  durationInFrames: number;
  fromImage: ImageData;
  toImage: ImageData;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export const Transition: React.FC<TransitionProps> = ({
  type,
  durationInFrames,
  fromImage,
  toImage,
  direction = 'left',
}) => {
  const frame = useCurrentFrame();

  const fromSrc = `data:${fromImage.mimeType};base64,${fromImage.data}`;
  const toSrc = `data:${toImage.mimeType};base64,${toImage.data}`;

  // 트랜지션 진행률 (0-1)
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  switch (type) {
    case 'fade':
      return (
        <AbsoluteFill>
          <AbsoluteFill>
            <Img
              src={fromSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 1 - progress,
              }}
            />
          </AbsoluteFill>
          <AbsoluteFill>
            <Img
              src={toSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: progress,
              }}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      );

    case 'dissolve':
      // 크로스 디졸브 (양쪽 이미지가 겹쳐지면서 전환)
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{ mixBlendMode: 'normal' }}>
            <Img
              src={fromSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 1 - progress * 0.5,
              }}
            />
          </AbsoluteFill>
          <AbsoluteFill style={{ mixBlendMode: 'normal' }}>
            <Img
              src={toSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: progress,
              }}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      );

    case 'slide': {
      // 슬라이드 트랜지션
      const getSlideTransform = () => {
        const slideAmount = interpolate(progress, [0, 1], [0, 100]);
        switch (direction) {
          case 'left':
            return { from: `translateX(${-slideAmount}%)`, to: `translateX(${100 - slideAmount}%)` };
          case 'right':
            return { from: `translateX(${slideAmount}%)`, to: `translateX(${-100 + slideAmount}%)` };
          case 'up':
            return { from: `translateY(${-slideAmount}%)`, to: `translateY(${100 - slideAmount}%)` };
          case 'down':
            return { from: `translateY(${slideAmount}%)`, to: `translateY(${-100 + slideAmount}%)` };
          default:
            return { from: `translateX(${-slideAmount}%)`, to: `translateX(${100 - slideAmount}%)` };
        }
      };

      const transforms = getSlideTransform();

      return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <AbsoluteFill style={{ transform: transforms.from }}>
            <Img
              src={fromSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </AbsoluteFill>
          <AbsoluteFill style={{ transform: transforms.to }}>
            <Img
              src={toSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }

    case 'zoom': {
      // 줌 트랜지션
      const fromScale = interpolate(progress, [0, 1], [1, 1.5]);
      const toScale = interpolate(progress, [0, 1], [0.5, 1]);
      const fromOpacity = interpolate(progress, [0, 0.5, 1], [1, 0.5, 0]);
      const toOpacity = interpolate(progress, [0, 0.5, 1], [0, 0.5, 1]);

      return (
        <AbsoluteFill>
          <AbsoluteFill>
            <Img
              src={fromSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${fromScale})`,
                opacity: fromOpacity,
              }}
            />
          </AbsoluteFill>
          <AbsoluteFill>
            <Img
              src={toSrc}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${toScale})`,
                opacity: toOpacity,
              }}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }

    case 'none':
    default:
      // 즉시 전환
      return (
        <AbsoluteFill>
          <Img
            src={progress < 0.5 ? fromSrc : toSrc}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </AbsoluteFill>
      );
  }
};
