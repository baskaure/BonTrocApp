import { useColorScheme } from 'react-native';

export const colors = {
  light: {
    background: '#F8FAFC',
    surface: '#FFF',
    text: '#1E293B',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    primary: '#19ADFA',
    primaryLight: '#E0F2FE',
    secondary: '#F59E0B',
    secondaryLight: '#FEF3C7',
    success: '#10B981',
    successLight: '#D1FAE5',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
  },
  dark: {
    background: '#000000',
    surface: '#0A0A0A',
    text: '#FFFFFF',
    textSecondary: '#E5E5E5',
    textTertiary: '#A0A0A0',
    border: '#1A1A1A',
    primary: '#19ADFA',
    primaryLight: '#0A1F2E',
    secondary: '#F59E0B',
    secondaryLight: '#2A1F0A',
    success: '#10B981',
    successLight: '#0A2A1F',
    error: '#EF4444',
    errorLight: '#2A0F0F',
    warning: '#F59E0B',
    warningLight: '#2A1F0A',
  },
};

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return {
    colors: isDark ? colors.dark : colors.light,
    isDark,
  };
}

