import { Platform } from 'react-native';

/** true = local backend, false = production Render */
export const isStaging = false;

const PRODUCTION_API = 'https://compoundmanager-2pm1.onrender.com/api';

/**
 * Host used when isStaging is true.
 * Android emulator / iOS: 10.0.2.2 maps to the Mac's localhost.
 * Physical device: set this to your Mac's LAN IP, e.g. '192.168.1.5'.
 */
const STAGING_HOST =
  Platform.OS === 'android' || Platform.OS === 'ios' ? '10.0.2.2' : 'localhost';

export const API_BASE = isStaging
  ? `http://${STAGING_HOST}:3001/api`
  : PRODUCTION_API;
