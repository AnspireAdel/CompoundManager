import { Platform } from 'react-native';

// Android emulator maps localhost to 10.0.2.2
const ANDROID_EMULATOR_API = 'http://10.0.2.2:3001/api';
const DEFAULT_API = 'https://compoundmanager-2pm1.onrender.com/api';

function resolveApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'android') {
    return ANDROID_EMULATOR_API;
  }
  return DEFAULT_API;
}

export const API_BASE = resolveApiBase();
