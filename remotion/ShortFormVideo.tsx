import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { SceneSequence } from './components/SceneSequence';
import { Transition } from './components/Transitions';
import { NarrationAudio } from './components/NarrationAudio';
import type { RemotionSceneData, TransitionConfig } from './types';
import type { AspectRatio } from '../types';

export interface ShortFormVideoProps {
  scenes: RemotionSceneData[];
  aspectRatio: AspectRatio;
  transitionType?: TransitionConfig['type'];
  transitionDuration?: number; // 프레임 단위
  showSubtitles?: boolean;
  playAudio?: boolean;  // 나레이션 오디오 재생 여부
}

export const ShortFormVideo: React.FC<ShortFormVideoProps> = ({
  scenes,
  aspectRatio,
  transitionType = 'fade',
  transitionDuration = 15, // 기본 0.5초 (30fps 기준)
  showSubtitles = true,
  playAudio = true,  // 기본적으로 오디오 재생
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

  // 각 장면의 시작 프레임 계산
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
            {/* 메인 장면 */}
            <Sequence from={startFrame} durationInFrames={durationInFrames}>
              <SceneSequence
                scene={scene}
                showSubtitle={showSubtitles}
              />
            </Sequence>

            {/* 나레이션 오디오 (해당 장면에 오디오가 있는 경우) */}
            {playAudio && scene.narrationAudio && (
              <Sequence from={startFrame} durationInFrames={durationInFrames}>
                <NarrationAudio
                  audio={scene.narrationAudio}
                  volume={1}
                  fadeIn={true}
                  fadeOut={true}
                />
              </Sequence>
            )}

            {/* 트랜지션 (마지막 장면 제외) */}
            {nextScene && transitionType !== 'none' && (
              <Sequence
                from={startFrame + durationInFrames - transitionDuration}
                durationInFrames={transitionDuration * 2}
              >
                <Transition
                  type={transitionType}
                  durationInFrames={transitionDuration}
                  fromImage={scene.imageData}
                  toImage={nextScene.scene.imageData}
                />
              </Sequence>
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
