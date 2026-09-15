import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** true = local backend, false = production Render */
export const isStaging = true;

const PRODUCTION_API = 'https://compoundmanager-2pm1.onrender.com/api';

/**
 * Host used when isStaging is true.
 * - Web: localhost
 * - Expo Go (physical device or simulator): automatically gets host machine IP from hostUri
 * - Android emulator fallback: 10.0.2.2
 */
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];

const STAGING_HOST =
  process.env.EXPO_PUBLIC_BACKEND_HOST ||
  (Platform.OS === 'web'
    ? 'localhost'
    : expoHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost'));

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (isStaging ? `http://${STAGING_HOST}:3001/api` : PRODUCTION_API);

export const DELETE_ACCOUNT_URL = isStaging
  ? `http://${STAGING_HOST}:3001/delete-account`
  : 'https://compoundmanager-2pm1.onrender.com/delete-account';

