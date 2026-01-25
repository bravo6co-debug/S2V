import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface SubtitlesProps {
  text: string;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  position?: 'top' | 'center' | 'bottom';
  fadeIn?: boolean;
  fadeOut?: boolean;
  scrollMode?: 'none' | 'scroll' | 'auto';  // 스크롤 모드
}

// 한국어 기준 초당 읽을 수 있는 글자 수
const CHARS_PER_SECOND = 5;

export const Subtitles: React.FC<SubtitlesProps> = ({
  text,
  fontSize = 48,  // 32 → 48 증가
  fontColor = '#ffffff',
  backgroundColor = 'rgba(0, 0, 0, 0.75)',
  position = 'bottom',
  fadeIn = true,
  fadeOut = true,
  scrollMode = 'auto',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width } = useVideoConfig();

  if (!text) return null;

  // 페이드 인/아웃 효과
  const fadeFrames = Math.round(fps * 0.3); // 0.3초
  let opacity = 1;

  if (fadeIn && fadeOut) {
    opacity = interpolate(
      frame,
      [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
      [0, 1, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  } else if (fadeIn) {
    opacity = interpolate(frame, [0, fadeFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  } else if (fadeOut) {
    opacity = interpolate(
      frame,
      [durationInFrames - fadeFrames, durationInFrames],
      [1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  }

  // 위치 스타일 (bottom: 10% → 5% 로 더 하단에 위치)
  const positionStyles: React.CSSProperties = {
    top: position === 'top' ? '8%' : position === 'center' ? '50%' : undefined,
    bottom: position === 'bottom' ? '5%' : undefined,
    transform: position === 'center' ? 'translateY(-50%)' : undefined,
  };

  // 스크롤이 필요한지 계산 (auto 모드)
  const durationInSeconds = durationInFrames / fps;
  const maxReadableChars = durationInSeconds * CHARS_PER_SECOND;
  const needsScroll = scrollMode === 'scroll' ||
    (scrollMode === 'auto' && text.length > maxReadableChars * 1.5);

  // 스크롤 애니메이션 계산
  const containerWidth = width * 0.94;  // 화면 너비의 94%
  const estimatedTextWidth = text.length * fontSize * 0.6;  // 글자 너비 추정

  // 스크롤 시 translateX 계산 (오른쪽에서 왼쪽으로)
  const scrollTranslateX = needsScroll
    ? interpolate(
        frame,
        [0, durationInFrames],
        [containerWidth * 0.3, -estimatedTextWidth],
        { extrapolateRight: 'clamp' }
      )
    : 0;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: needsScroll ? 'flex-end' : 'flex-end',
        padding: '0 3%',
        ...positionStyles,
      }}
    >
      <div
        style={{
          backgroundColor,
          padding: '16px 32px',
          borderRadius: 12,
          maxWidth: needsScroll ? '100%' : '94%',
          overflow: needsScroll ? 'hidden' : 'visible',
          opacity,
        }}
      >
        <p
          style={{
            fontSize,
            fontWeight: 600,
            color: fontColor,
            textAlign: needsScroll ? 'left' : 'center',
            margin: 0,
            lineHeight: 1.4,
            fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
            wordBreak: needsScroll ? 'keep-all' : 'keep-all',
            whiteSpace: needsScroll ? 'nowrap' : 'normal',
            transform: needsScroll ? `translateX(${scrollTranslateX}px)` : undefined,
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
          }}
        >
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
};
