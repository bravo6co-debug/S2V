import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { SceneSequence } from './components/SceneSequence';
import { Transition } from './components/Transitions';
import { NarrationAudio } from './components/NarrationAudio';
import type { RemotionSceneData } from './types';

export interface LongformVideoProps {
  scenes: RemotionSceneData[];
  transitionDuration?: number;
  showSubtitles?: boolean;
  playAudio?: boolean;
  audioVolume?: number;
}

export const LongformVideo: React.FC<LongformVideoProps> = ({
  scenes,
  transitionDuration = 15,
  showSubtitles = true,
  playAudio = true,
  audioVolume = 1,
}) => {
  const { fps } = useVideoConfig();

  if (scenes.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#1f2937',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: 'white', fontSize: 24, textAlign: 'center' }}>
          씬을 추가하세요
        </div>
      </AbsoluteFill>
    );
  }

  let currentFrame = 0;
  const sceneFrames = scenes.map((scene) => {
    const startFrame = currentFrame;
    const durationInFrames = Math.round(scene.duration * fps);
    currentFrame += durationInFrames;
    return { scene, startFrame, durationInFrames };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {sceneFrames.map(({ scene, startFrame, durationInFrames }, index) => {
        const isLast = index === sceneFrames.length - 1;
        const nextScene = !isLast ? sceneFrames[index + 1] : null;

        return (
          <React.Fragment key={scene.id}>
            <Sequence from={startFrame} durationInFrames={durationInFrames}>
              <SceneSequence scene={scene} showSubtitle={showSubtitles} />
            </Sequence>

            {playAudio && scene.narrationAudio && (
              <Sequence from={startFrame} durationInFrames={durationInFrames}>
                <NarrationAudio
                  audio={scene.narrationAudio}
                  volume={audioVolume}
                  fadeIn
                  fadeOut
                />
              </Sequence>
            )}

            {nextScene && (
              <Sequence
                from={startFrame + durationInFrames - transitionDuration}
                durationInFrames={transitionDuration * 2}
              >
                <Transition
                  type="fade"
                  durationInFrames={transitionDuration}
                  fromImage={
                    scene.subImages && scene.subImages.length > 0
                      ? scene.subImages[scene.subImages.length - 1]  // 현재 씬의 마지막 sub-image
                      : scene.imageData
                  }
                  toImage={
                    nextScene.scene.subImages && nextScene.scene.subImages.length > 0
                      ? nextScene.scene.subImages[0]                  // 다음 씬의 첫 sub-image
                      : nextScene.scene.imageData
                  }
                />
              </Sequence>
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
