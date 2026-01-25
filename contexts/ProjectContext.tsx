import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  Project,
  CharacterAsset,
  PropAsset,
  BackgroundAsset,
  Scenario,
  Scene,
  VideoTimeline,
  AppMode,
  AspectRatio,
  ImageStyle,
} from '../types';

// =============================================
// Context Value Interface
// =============================================

interface ProjectContextValue {
  // 프로젝트
  project: Project | null;
  createNewProject: (name: string) => void;
  loadProject: (project: Project) => void;
  saveProject: () => Project | null;

  // 캐릭터
  characters: CharacterAsset[];
  addCharacter: (char: CharacterAsset) => void;
  updateCharacter: (id: string, updates: Partial<CharacterAsset>) => void;
  removeCharacter: (id: string) => void;

  // 소품
  props: PropAsset[];
  addProp: (prop: PropAsset) => void;
  updateProp: (id: string, updates: Partial<PropAsset>) => void;
  removeProp: (id: string) => void;

  // 배경
  backgrounds: BackgroundAsset[];
  addBackground: (bg: BackgroundAsset) => void;
  updateBackground: (id: string, updates: Partial<BackgroundAsset>) => void;
  removeBackground: (id: string) => void;

  // 시나리오
  scenario: Scenario | null;
  setScenario: (scenario: Scenario | null) => void;
  updateScene: (sceneId: string, updates: Partial<Scene>) => void;
  addScene: (scene: Scene, afterSceneId?: string) => void;
  removeScene: (sceneId: string) => void;
  reorderScenes: (sceneIds: string[]) => void;

  // 타임라인
  timeline: VideoTimeline | null;
  setTimeline: (timeline: VideoTimeline | null) => void;

  // UI 상태
  currentTab: AppMode;
  setCurrentTab: (tab: AppMode) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  imageStyle: ImageStyle;
  setImageStyle: (style: ImageStyle) => void;

  // 활성화된 에셋 (시나리오 이미지 생성용)
  activeCharacterIds: string[];
  setActiveCharacterIds: (ids: string[]) => void;
  toggleActiveCharacter: (id: string) => void;
  activePropIds: string[];
  setActivePropIds: (ids: string[]) => void;
  toggleActiveProp: (id: string) => void;
  activeBackgroundId: string | null;
  setActiveBackgroundId: (id: string | null) => void;

  // 유틸리티
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
}

// =============================================
// Context Creation
// =============================================

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

// =============================================
// Provider Component
// =============================================

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  // 프로젝트 상태
  const [project, setProject] = useState<Project | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // 에셋 상태
  const [characters, setCharacters] = useState<CharacterAsset[]>([]);
  const [props, setProps] = useState<PropAsset[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundAsset[]>([]);

  // 시나리오 상태
  const [scenario, setScenarioState] = useState<Scenario | null>(null);

  // 타임라인 상태
  const [timeline, setTimelineState] = useState<VideoTimeline | null>(null);

  // UI 상태
  const [currentTab, setCurrentTab] = useState<AppMode>('character');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [imageStyle, setImageStyle] = useState<ImageStyle>('photorealistic');
  const [activeCharacterIds, setActiveCharacterIds] = useState<string[]>([]);
  const [activePropIds, setActivePropIds] = useState<string[]>([]);
  const [activeBackgroundId, setActiveBackgroundId] = useState<string | null>(null);

  // =============================================
  // 프로젝트 관리
  // =============================================

  const createNewProject = useCallback((name: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      characters: [],
      props: [],
      backgrounds: [],
      scenario: null,
      videoTimeline: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProject(newProject);
    setCharacters([]);
    setProps([]);
    setBackgrounds([]);
    setScenarioState(null);
    setTimelineState(null);
    setActiveCharacterIds([]);
    setActivePropIds([]);
    setActiveBackgroundId(null);
    setIsDirty(false);
  }, []);

  const loadProject = useCallback((projectData: Project) => {
    setProject(projectData);
    setCharacters(projectData.characters);
    setProps(projectData.props);
    setBackgrounds(projectData.backgrounds);
    setScenarioState(projectData.scenario);
    setTimelineState(projectData.videoTimeline);
    setIsDirty(false);
  }, []);

  const saveProject = useCallback((): Project | null => {
    if (!project) return null;

    const savedProject: Project = {
      ...project,
      characters,
      props,
      backgrounds,
      scenario,
      videoTimeline: timeline,
      updatedAt: Date.now(),
    };

    setProject(savedProject);
    setIsDirty(false);
    return savedProject;
  }, [project, characters, props, backgrounds, scenario, timeline]);

  // =============================================
  // 캐릭터 관리
  // =============================================

  const addCharacter = useCallback((char: CharacterAsset) => {
    setCharacters(prev => [...prev, char]);
    setIsDirty(true);
  }, []);

  const updateCharacter = useCallback((id: string, updates: Partial<CharacterAsset>) => {
    setCharacters(prev => prev.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
    ));
    setIsDirty(true);
  }, []);

  const removeCharacter = useCallback((id: string) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
    setActiveCharacterIds(prev => prev.filter(cid => cid !== id));
    setIsDirty(true);
  }, []);

  // =============================================
  // 소품 관리
  // =============================================

  const addProp = useCallback((prop: PropAsset) => {
    setProps(prev => [...prev, prop]);
    setIsDirty(true);
  }, []);

  const updateProp = useCallback((id: string, updates: Partial<PropAsset>) => {
    setProps(prev => prev.map(p =>
      p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
    ));
    setIsDirty(true);
  }, []);

  const removeProp = useCallback((id: string) => {
    setProps(prev => prev.filter(p => p.id !== id));
    setActivePropIds(prev => prev.filter(pid => pid !== id));
    setIsDirty(true);
  }, []);

  // =============================================
  // 배경 관리
  // =============================================

  const addBackground = useCallback((bg: BackgroundAsset) => {
    setBackgrounds(prev => [...prev, bg]);
    setIsDirty(true);
  }, []);

  const updateBackground = useCallback((id: string, updates: Partial<BackgroundAsset>) => {
    setBackgrounds(prev => prev.map(b =>
      b.id === id ? { ...b, ...updates, updatedAt: Date.now() } : b
    ));
    setIsDirty(true);
  }, []);

  const removeBackground = useCallback((id: string) => {
    setBackgrounds(prev => prev.filter(b => b.id !== id));
    setActiveBackgroundId(prev => prev === id ? null : prev);
    setIsDirty(true);
  }, []);

  // =============================================
  // 시나리오 관리
  // =============================================

  const setScenario = useCallback((newScenario: Scenario | null) => {
    setScenarioState(newScenario);
    setIsDirty(true);
  }, []);

  const updateScene = useCallback((sceneId: string, updates: Partial<Scene>) => {
    setScenarioState(prev => {
      if (!prev) return null;
      return {
        ...prev,
        scenes: prev.scenes.map(s =>
          s.id === sceneId ? { ...s, ...updates } : s
        ),
        updatedAt: Date.now(),
      };
    });
    setIsDirty(true);
  }, []);

  const addScene = useCallback((scene: Scene, afterSceneId?: string) => {
    setScenarioState(prev => {
      if (!prev) return null;

      let newScenes: Scene[];
      if (afterSceneId) {
        const index = prev.scenes.findIndex(s => s.id === afterSceneId);
        if (index !== -1) {
          newScenes = [
            ...prev.scenes.slice(0, index + 1),
            scene,
            ...prev.scenes.slice(index + 1),
          ];
        } else {
          newScenes = [...prev.scenes, scene];
        }
      } else {
        newScenes = [...prev.scenes, scene];
      }

      // 씬 번호 재정렬
      newScenes = newScenes.map((s, i) => ({ ...s, sceneNumber: i + 1 }));

      return {
        ...prev,
        scenes: newScenes,
        updatedAt: Date.now(),
      };
    });
    setIsDirty(true);
  }, []);

  const removeScene = useCallback((sceneId: string) => {
    setScenarioState(prev => {
      if (!prev) return null;
      const newScenes = prev.scenes
        .filter(s => s.id !== sceneId)
        .map((s, i) => ({ ...s, sceneNumber: i + 1 }));
      return {
        ...prev,
        scenes: newScenes,
        updatedAt: Date.now(),
      };
    });
    setIsDirty(true);
  }, []);

  const reorderScenes = useCallback((sceneIds: string[]) => {
    setScenarioState(prev => {
      if (!prev) return null;

      const sceneMap = new Map(prev.scenes.map(s => [s.id, s]));
      const newScenes = sceneIds
        .map(id => sceneMap.get(id))
        .filter((s): s is Scene => s !== undefined)
        .map((s, i) => ({ ...s, sceneNumber: i + 1 }));

      return {
        ...prev,
        scenes: newScenes,
        updatedAt: Date.now(),
      };
    });
    setIsDirty(true);
  }, []);

  // =============================================
  // 타임라인 관리
  // =============================================

  const setTimeline = useCallback((newTimeline: VideoTimeline | null) => {
    setTimelineState(newTimeline);
    setIsDirty(true);
  }, []);

  // =============================================
  // 활성화된 캐릭터 관리
  // =============================================

  const toggleActiveCharacter = useCallback((id: string) => {
    setActiveCharacterIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(cid => cid !== id);
      }
      if (prev.length >= 5) {
        return prev; // 최대 5개
      }
      return [...prev, id];
    });
  }, []);

  const toggleActiveProp = useCallback((id: string) => {
    setActivePropIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pid => pid !== id);
      }
      if (prev.length >= 5) {
        return prev; // 최대 5개
      }
      return [...prev, id];
    });
  }, []);

  // =============================================
  // 자동 저장 (localStorage)
  // =============================================

  useEffect(() => {
    if (!project || !isDirty) return;

    const timer = setTimeout(() => {
      const projectToSave: Project = {
        ...project,
        characters,
        props,
        backgrounds,
        scenario,
        videoTimeline: timeline,
        updatedAt: Date.now(),
      };

      try {
        localStorage.setItem('image-gen-autosave', JSON.stringify(projectToSave));
      } catch (e) {
        console.warn('Auto-save failed:', e);
      }
    }, 2000); // 2초 디바운스

    return () => clearTimeout(timer);
  }, [project, characters, props, backgrounds, scenario, timeline, isDirty]);

  // =============================================
  // Context Value
  // =============================================

  const value: ProjectContextValue = {
    // 프로젝트
    project,
    createNewProject,
    loadProject,
    saveProject,

    // 캐릭터
    characters,
    addCharacter,
    updateCharacter,
    removeCharacter,

    // 소품
    props,
    addProp,
    updateProp,
    removeProp,

    // 배경
    backgrounds,
    addBackground,
    updateBackground,
    removeBackground,

    // 시나리오
    scenario,
    setScenario,
    updateScene,
    addScene,
    removeScene,
    reorderScenes,

    // 타임라인
    timeline,
    setTimeline,

    // UI 상태
    currentTab,
    setCurrentTab,
    aspectRatio,
    setAspectRatio,
    imageStyle,
    setImageStyle,

    // 활성화된 에셋
    activeCharacterIds,
    setActiveCharacterIds,
    toggleActiveCharacter,
    activePropIds,
    setActivePropIds,
    toggleActiveProp,
    activeBackgroundId,
    setActiveBackgroundId,

    // 유틸리티
    isDirty,
    setIsDirty,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

// =============================================
// Custom Hook
// =============================================

export const useProject = (): ProjectContextValue => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export default ProjectContext;
