/** true = local backend, false = production Render */
export const isStaging = false;

export const PRODUCTION_ORIGIN = 'https://compoundmanager-2pm1.onrender.com';
export const STAGING_ORIGIN = 'http://localhost:3001';

export const API_ORIGIN = isStaging ? STAGING_ORIGIN : PRODUCTION_ORIGIN;
export const API_BASE = `${API_ORIGIN}/api`;
