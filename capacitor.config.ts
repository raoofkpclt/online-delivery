import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rahath.app',
  appName: 'Rahath',
  webDir: 'dist',
  backgroundColor: '#0E3B2C',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0E3B2C',
      showSpinner: false
    }
  }
};

export default config;