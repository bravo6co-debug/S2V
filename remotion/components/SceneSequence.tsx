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
      {/* 배경 이미지 + 애니메이션 */}
      <KenBurnsEffect
        imageData={scene.imageData}
        animation={scene.animation}
      />

      {/* 자막 */}
      {showSubtitle && scene.narration && (
        <Subtitles
          text={scene.narration}
          position="bottom"
          fadeIn={true}
          fadeOut={true}
        />
      )}
    </AbsoluteFill>
  );
};
