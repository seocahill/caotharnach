export default {
  expo: {
    name: 'Oileáin',
    slug: 'oileain',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      resizeMode: 'contain',
      backgroundColor: '#1a5f2a',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'ie.oileain.app',
      infoPlist: {
        NSMicrophoneUsageDescription: 'We need access to your microphone to record your voice for creating Irish language islands.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'ie.oileain.app',
      permissions: [
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
      ],
    },
    plugins: [
      [
        'expo-av',
        {
          microphonePermission: 'Allow Oileáin to access your microphone for voice recording.',
        },
      ],
      'expo-audio',
      'expo-font',
      'expo-asset',
    ],
    extra: {
      eas: {
        projectId: '3c6851f2-b41b-458e-8e0f-46cf15800930',
      },
      // Environment variables accessible via expo-constants
      apiBaseDev: process.env.API_BASE_DEV,
      apiBaseProd: process.env.API_BASE_PROD,
      appApiKey: process.env.APP_API_KEY,
      abairtApiBase: process.env.ABAIRT_API_BASE,
      abairtApiKey: process.env.ABAIRT_API_KEY,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/3c6851f2-b41b-458e-8e0f-46cf15800930',
    },
  },
};
