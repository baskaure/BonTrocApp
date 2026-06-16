import { useColorScheme } from 'react-native';

/**
 * Design tokens BonTroc — issus des maquettes mobiles (Claude Design).
 * Palette : bleu #2B86CC + jaune #F8C61E, cartes blanches arrondies, thèmes clair & sombre.
 *
 * Les noms de tokens historiques (background, surface, primary, success…) sont conservés
 * pour rester compatibles avec l'existant. Des alias proches des maquettes (ink, ink2,
 * muted, line, blue, chip, screen…) sont ajoutés pour les nouveaux écrans.
 */
export const colors = {
  light: {
    // Surfaces
    background: '#EEF2F6',        // fond d'écran (screenbg)
    backgroundElevated: '#F4F8FB',// bg2 — sections légèrement surélevées
    surface: '#FFFFFF',           // card
    surfaceContainer: '#F0F4F8',  // chip / conteneurs
    surfaceContainerLow: '#F4F8FB',
    // Texte
    text: '#13202E',              // ink
    textSecondary: '#3C4856',     // ink2
    textTertiary: '#7B8896',      // muted
    // Bordures
    border: '#E7EDF3',            // line
    borderStrong: '#7B8896',
    // Primaire (bleu)
    primary: '#2B86CC',           // blue
    primaryBright: '#1E9DE6',     // blueb
    primaryLight: '#E4F0F9',      // blues
    // Secondaire (jaune)
    secondary: '#F8C61E',         // yellow
    secondaryLight: '#FCF1CC',    // yellows
    // Statuts
    success: '#1B9A5F',           // greent
    successLight: '#DCF2E5',      // greens
    error: '#D8463E',             // redt
    errorLight: '#FBE7E5',        // reds
    warning: '#BC840F',           // ambert
    warningLight: '#FBEAC6',      // ambers
    // Divers
    overlay: 'rgba(19, 32, 46, 0.45)',
    onPrimary: '#FFFFFF',
    onSecondary: '#3A2F00',       // texte foncé sur le jaune
  },
  dark: {
    // Surfaces
    background: '#0C131B',
    backgroundElevated: '#0C131B',
    surface: '#161F2A',
    surfaceContainer: '#1E2833',
    surfaceContainerLow: '#0C131B',
    // Texte
    text: '#EAF1F7',
    textSecondary: '#C4CFDA',
    textTertiary: '#8593A1',
    // Bordures
    border: '#26323D',
    borderStrong: '#8593A1',
    // Primaire (bleu)
    primary: '#3FA0E2',
    primaryBright: '#52B4F2',
    primaryLight: '#15303F',
    // Secondaire (jaune)
    secondary: '#F8C61E',
    secondaryLight: '#39320F',
    // Statuts
    success: '#4FCB89',
    successLight: '#12331F',
    error: '#F0625A',
    errorLight: '#3A1A18',
    warning: '#E4AE3F',
    warningLight: '#3A2E12',
    // Divers
    overlay: 'rgba(0, 0, 0, 0.55)',
    onPrimary: '#FFFFFF',
    onSecondary: '#3A2F00',
  },
};

/** Rayons de bordure (maquettes : cartes 20, boutons 16, chips arrondies). */
export const radius = {
  sm: 8,
  md: 13,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Échelle d'espacement. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/** Échelle typographique (tailles & graisses récurrentes des maquettes). */
export const typography = {
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  h3: { fontSize: 18, fontWeight: '800' as const },
  title: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 14.5, fontWeight: '400' as const },
  label: { fontSize: 12.5, fontWeight: '700' as const },
  caption: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6 },
} as const;

type ThemeColors = typeof colors.light;

/** Ombres portées (clair vs sombre) prêtes pour StyleSheet. */
export function makeShadows(isDark: boolean) {
  return {
    card: {
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.45 : 0.1,
      shadowRadius: isDark ? 24 : 18,
      shadowOffset: { width: 0, height: isDark ? 12 : 10 },
      elevation: 6,
    },
    soft: {
      shadowColor: '#000',
      shadowOpacity: isDark ? 0.4 : 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  };
}

export type Theme = {
  colors: ThemeColors;
  isDark: boolean;
  radius: typeof radius;
  spacing: typeof spacing;
  typography: typeof typography;
  shadows: ReturnType<typeof makeShadows>;
};

export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colors: isDark ? colors.dark : colors.light,
    isDark,
    radius,
    spacing,
    typography,
    shadows: makeShadows(isDark),
  };
}
