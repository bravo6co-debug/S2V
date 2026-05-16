import React from 'react';
import { AbsoluteFill } from 'remotion';
import { KenBurnsEffect } from './KenBurnsEffect';
import { Subtitles } from './Subtitles';
import type { RemotionSceneData } from '../types';

interface SceneSequenceProps {
  scene: RemotionSceneData;
  showSubtitle?: boolean;
}

export const SceneSequence: React.FC<SceneSequenceProps> = ({
  scene,
  showSubtitle = true,
}) => {
  return (
    <AbsoluteFill>
      {/* 배경 이미지 + 애니메이션 (롱폼2: subImages 시간순 자동 교체) */}
      <KenBurnsEffect
        imageData={scene.imageData}
        subImages={scene.subImages}
        animation={scene.animation}
      />

      {/* 자막 (오디오 시간 내에서만 세그먼트 분할 표시) */}
      {showSubtitle && scene.narration && (
        <Subtitles
          text={scene.narration}
          audioDurationMs={scene.narrationAudio?.durationMs}
          position="bottom"
          fadeIn={true}
          fadeOut={true}
        />
      )}
    </AbsoluteFill>
  );
};
