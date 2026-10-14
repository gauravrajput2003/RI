import { create } from 'zustand';
import {persist,createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '../features/profile/types';
import { defaultSettings } from '../features/demo/data';

interface SettingsStore extends AppSettings {
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  toggleSetting: (key: keyof Omit<AppSettings, 'language' | 'landingPage'>) => void;
}

export const useSettingsStore = create<SettingsStore>()(persist((set) => ({
  ...defaultSettings,
  setSetting: (key, value) => set({ [key]: value }),
  toggleSetting: (key) => set((state) => ({ [key]: !state[key] })),
}),{name:'fleet.settings.v1',storage:createJSONStorage(()=>AsyncStorage)}));
