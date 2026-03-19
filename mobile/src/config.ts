// API Configuration
// Change this to your local IP when developing locally
// Or use the fly.io URL for production

// To find your local IP on Mac: ifconfig | grep "inet " | grep -v 127.0.0.1
// To find your local IP on Linux: hostname -I

export const CONFIG = {
  // For local development, use your machine's IP (not localhost!)
  // Example: 'http://192.168.1.3:3000'
  API_BASE_DEV: 'http://192.168.1.5:8080',

  // Production URL
  API_BASE_PROD: 'https://an-caotharnach.fly.dev',

  // API Key for authentication
  API_KEY: '84ebf2563720f33ffd35701c3c54b8557429e0f54dda86320e763b29b61e05c7',

  // Get the appropriate URL based on environment
  get API_BASE() {
    return __DEV__ ? this.API_BASE_DEV : this.API_BASE_PROD;
  }
};
