import { Composition } from 'remotion';
import { ShortFormVideo, ShortFormVideoProps } from './ShortFormVideo';

export const RemotionRoot: React.FC = () => {
  // 기본 비디오 설정
  const FPS = 30;
  const DEFAULT_DURATION_SECONDS = 60;

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
    </>
  );
};
