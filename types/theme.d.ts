import { MD3Theme } from 'react-native-paper';

declare global {
  namespace ReactNativePaper {
    interface ThemeColors {
      glass: string;
      glassBorder: string;
      success: string;
      warning: string;
    }

    interface Theme extends MD3Theme {
      colors: ThemeColors & MD3Theme['colors'];
    }
  }
}
