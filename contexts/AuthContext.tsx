import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { GeminiModelConfig } from '../types';
import { DEFAULT_MODEL_CONFIG } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface User {
  id: string;
  email: string;
  hasApiKey: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  user: User | null;
  settings: GeminiModelConfig | null;
  hasApiKey: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Partial<GeminiModelConfig & { geminiApiKey?: string }>) => Promise<{ success: boolean; error?: string }>;
  openLoginModal: () => void;
  openSettingsModal: () => void;
  isLoginModalOpen: boolean;
  isSettingsModalOpen: boolean;
  closeLoginModal: () => void;
  closeSettingsModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 's2v_auth_token';
const USER_KEY = 's2v_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<GeminiModelConfig | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const isAuthenticated = !!token && !!user;

  // 모달 제어
  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);
  const openSettingsModal = useCallback(() => setIsSettingsModalOpen(true), []);
  const closeSettingsModal = useCallback(() => setIsSettingsModalOpen(false), []);

  // 회원가입
  const register = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        const newUser: User = {
          id: data.user.id,
          email: data.user.email,
          hasApiKey: false,
        };
        setToken(data.token);
        setUser(newUser);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        return { success: true };
      }

      return { success: false, error: data.error || '회원가입에 실패했습니다.' };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: '서버 연결에 실패했습니다.' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 로그인
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        const newUser: User = {
          id: data.user.id,
          email: data.user.email,
          hasApiKey: data.user.hasApiKey || false,
        };
        setToken(data.token);
        setUser(newUser);
        setHasApiKey(newUser.hasApiKey);
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(newUser));
        return { success: true };
      }

      return { success: false, error: data.error || '로그인에 실패했습니다.' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '서버 연결에 실패했습니다.' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 로그아웃
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setSettings(null);
    setHasApiKey(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  // 설정 불러오기
  const loadSettings = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        // 토큰 만료
        logout();
        return;
      }

      const data = await response.json();

      if (data.success && data.settings) {
        setSettings({
          textModel: data.settings.textModel || DEFAULT_MODEL_CONFIG.textModel,
          imageModel: data.settings.imageModel || DEFAULT_MODEL_CONFIG.imageModel,
          videoModel: data.settings.videoModel || DEFAULT_MODEL_CONFIG.videoModel,
          ttsModel: data.settings.ttsModel || DEFAULT_MODEL_CONFIG.ttsModel,
          ttsVoice: data.settings.ttsVoice || DEFAULT_MODEL_CONFIG.ttsVoice,
        });
        setHasApiKey(data.settings.hasApiKey || false);

        // user 상태도 업데이트
        if (user) {
          const updatedUser = { ...user, hasApiKey: data.settings.hasApiKey || false };
          setUser(updatedUser);
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        }
      }
    } catch (error) {
      console.error('Load settings error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, logout, user]);

  // 설정 저장
  const saveSettings = useCallback(async (
    newSettings: Partial<GeminiModelConfig & { geminiApiKey?: string }>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!token) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newSettings),
      });

      if (response.status === 401) {
        logout();
        return { success: false, error: '세션이 만료되었습니다. 다시 로그인해 주세요.' };
      }

      const data = await response.json();

      if (data.success && data.settings) {
        setSettings({
          textModel: data.settings.textModel || DEFAULT_MODEL_CONFIG.textModel,
          imageModel: data.settings.imageModel || DEFAULT_MODEL_CONFIG.imageModel,
          videoModel: data.settings.videoModel || DEFAULT_MODEL_CONFIG.videoModel,
          ttsModel: data.settings.ttsModel || DEFAULT_MODEL_CONFIG.ttsModel,
          ttsVoice: data.settings.ttsVoice || DEFAULT_MODEL_CONFIG.ttsVoice,
        });
        setHasApiKey(data.settings.hasApiKey || false);

        // user 상태도 업데이트
        if (user) {
          const updatedUser = { ...user, hasApiKey: data.settings.hasApiKey || false };
          setUser(updatedUser);
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        }

        return { success: true };
      }

      return { success: false, error: data.error || '설정 저장에 실패했습니다.' };
    } catch (error) {
      console.error('Save settings error:', error);
      return { success: false, error: '서버 연결에 실패했습니다.' };
    } finally {
      setIsLoading(false);
    }
  }, [token, logout, user]);

  // 토큰이 있으면 설정 불러오기
  useEffect(() => {
    if (token) {
      loadSettings();
    }
  }, [token]); // loadSettings 의존성 제거 (무한 루프 방지)

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        token,
        user,
        settings,
        hasApiKey,
        login,
        register,
        logout,
        loadSettings,
        saveSettings,
        openLoginModal,
        openSettingsModal,
        isLoginModalOpen,
        isSettingsModalOpen,
        closeLoginModal,
        closeSettingsModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
