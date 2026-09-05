import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.homefitnesscoach.app',
  appName: 'Home Fitness Coach',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
