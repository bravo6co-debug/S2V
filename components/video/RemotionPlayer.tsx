import React, { useMemo, useState, useCallback } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { ShortFormVideo } from '../../remotion/ShortFormVideo';
import { scenesToRemotionScenes, type RemotionSceneData, type TransitionConfig } from '../../remotion/types';
import type { Scene, AspectRatio } from '../../types';

// 볼륨 아이콘
const VolumeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const VolumeMuteIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
  </svg>
);

interface RemotionPlayerProps {
  scenes: Scene[];
  aspectRatio?: AspectRatio;
  transitionType?: TransitionConfig['type'];
  transitionDuration?: number;
  showSubtitles?: boolean;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
}

export const RemotionPlayer: React.FC<RemotionPlayerProps> = ({
  scenes,
  aspectRatio = '16:9',
  transitionType = 'fade',
  transitionDuration = 15,
  showSubtitles = true,
  className = '',
  autoPlay = false,
  loop = false,
  onPlay,
  onPause,
  onEnded,
}) => {
  const playerRef = React.useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // 나레이션 오디오가 있는 씬이 있는지 확인
  const hasAudio = useMemo(() => {
    return scenes.some(scene => scene.narrationAudio?.data);
  }, [scenes]);

  // Scene 데이터를 Remotion 형식으로 변환
  const remotionScenes: RemotionSceneData[] = useMemo(() => {
    return scenesToRemotionScenes(scenes);
  }, [scenes]);

  // 총 재생 시간 계산 (프레임)
  const fps = 30;
  const totalDurationInFrames = useMemo(() => {
    return remotionScenes.reduce((acc, scene) => acc + Math.round(scene.duration * fps), 0);
  }, [remotionScenes]);

  // 비디오 크기 계산
  const videoDimensions = useMemo(() => {
    if (aspectRatio === '16:9') {
      return { width: 1920, height: 1080 };
    }
    return { width: 1080, height: 1920 };
  }, [aspectRatio]);

  // 재생 컨트롤
  const handlePlay = useCallback(() => {
    playerRef.current?.play();
    setIsPlaying(true);
    onPlay?.();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    playerRef.current?.pause();
    setIsPlaying(false);
    onPause?.();
  }, [onPause]);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);

  const handleSeekToStart = useCallback(() => {
    playerRef.current?.seekTo(0);
  }, []);

  // 볼륨 토글
  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // 볼륨 변경
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  // 실제 적용 볼륨 계산
  const effectiveVolume = isMuted ? 0 : volume;

  if (remotionScenes.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 rounded-lg ${className}`}>
        <div className="text-center text-gray-500 p-8">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
            />
          </svg>
          <p className="text-sm">이미지가 있는 씬이 없습니다</p>
          <p className="text-xs text-gray-600 mt-1">
            시나리오 탭에서 이미지를 생성하세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* 비디오 플레이어 */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <Player
          ref={playerRef}
          component={ShortFormVideo}
          inputProps={{
            scenes: remotionScenes,
            aspectRatio,
            transitionType,
            transitionDuration,
            showSubtitles,
            playAudio: !isMuted && volume > 0,
            audioVolume: isMuted ? 0 : volume,
          }}
          durationInFrames={Math.max(1, totalDurationInFrames)}
          compositionWidth={videoDimensions.width}
          compositionHeight={videoDimensions.height}
          fps={fps}
          style={{
            width: '100%',
            aspectRatio: aspectRatio === '16:9' ? '16/9' : '9/16',
          }}
          controls={false}
          loop={loop}
          autoPlay={autoPlay}
        />

        {/* 커스텀 컨트롤 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
          <button
            onClick={handleTogglePlay}
            className="w-16 h-16 flex items-center justify-center bg-white/90 rounded-full hover:bg-white transition-colors"
          >
            {isPlaying ? (
              <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 하단 컨트롤 바 */}
      <div className="flex items-center justify-between mt-3 px-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeekToStart}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="처음으로"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleTogglePlay}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* 볼륨 컨트롤 - 오디오가 있을 때만 표시 */}
          {hasAudio && (
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={handleToggleMute}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title={isMuted ? '음소거 해제' : '음소거'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeMuteIcon className="w-5 h-5" />
                ) : (
                  <VolumeIcon className="w-5 h-5" />
                )}
              </button>

              {/* 볼륨 슬라이더 */}
              {showVolumeSlider && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-gray-800 rounded-lg shadow-lg">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    style={{ writingMode: 'horizontal-tb' }}
                  />
                  <div className="text-xs text-center text-gray-400 mt-1">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 오디오 상태 표시 */}
          {hasAudio && (
            <div className="flex items-center gap-1 text-xs text-green-400" title="나레이션 오디오 있음">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
              <span>오디오</span>
            </div>
          )}
          <div className="text-sm text-gray-400">
            {remotionScenes.length}개 씬 · {Math.round(totalDurationInFrames / fps)}초
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemotionPlayer;
