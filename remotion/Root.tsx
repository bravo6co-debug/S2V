import React from 'react';
import { Composition } from 'remotion';
import { ShortFormVideo, ShortFormVideoProps } from './ShortFormVideo';
import { LongformVideo, LongformVideoProps } from './LongformVideo';

export const RemotionRoot: React.FC = () => {
  // 기본 비디오 설정
  const FPS = 30;
  const DEFAULT_DURATION_SECONDS = 60;
  const LONGFORM_DEFAULT_DURATION = 30 * 60; // 30분

  return (
    <>
      <Composition
        id="ShortFormVideo"
        component={ShortFormVideo}
        durationInFrames={DEFAULT_DURATION_SECONDS * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          scenes: [],
          aspectRatio: '9:16',
        } as ShortFormVideoProps}
      />
      <Composition
        id="ShortFormVideoHorizontal"
        component={ShortFormVideo}
        durationInFrames={DEFAULT_DURATION_SECONDS * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: [],
          aspectRatio: '16:9',
        } as ShortFormVideoProps}
      />
      <Composition
        id="LongformVideo"
        component={LongformVideo}
        durationInFrames={LONGFORM_DEFAULT_DURATION * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: [],
        } as LongformVideoProps}
      />
    </>
  );
};
