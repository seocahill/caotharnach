// API Configuration
// Environment variables are loaded from:
// - Local dev: mobile/.env (gitignored)
// - Builds: eas.json env vars
// - Accessed via expo-constants

import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra;

export const CONFIG = {
  // API URLs
  API_BASE_DEV: extra?.apiBaseDev || 'http://localhost:8080',
  API_BASE_PROD: extra?.apiBaseProd || 'https://an-caotharnach.fly.dev',

  // Get the appropriate URL based on environment
  get API_BASE() {
    return __DEV__ ? this.API_BASE_DEV : this.API_BASE_PROD;
  },

  // API Keys (loaded from environment)
  API_KEY: extra?.appApiKey || '',
  ABAIRT_API_BASE: extra?.abairtApiBase || 'https://abairt.com',
  ABAIRT_API_KEY: extra?.abairtApiKey || '',
};
