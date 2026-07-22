// Shared design tokens. Dark, calm, high-contrast for comfortable reading.
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  bg: '#0B0E14',
  bgElev: '#11151E',
  card: '#161B26',
  cardAlt: '#1F2632',
  text: '#F4F6FA',
  textDim: '#97A1B2',
  textFaint: '#5E6878',
  accent: '#7C9BFF',
  accentDeep: '#5B79E0',
  accentSoft: '#222C49',
  green: '#4FCB97',
  greenSoft: '#16332A',
  yellow: '#EBC15A',
  red: '#EC6A62',
  redSoft: '#3A2222',
  bengali: '#62C7B8', // teal accent for Bengali section
  hindi: '#E9A45C', // amber accent for Hindi section
  border: '#252D3B',
  borderSoft: '#1C2330',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  h1: { fontSize: 34, fontWeight: '800', letterSpacing: 0.2 } as TextStyle,
  h2: { fontSize: 24, fontWeight: '800' } as TextStyle,
  title: { fontSize: 19, fontWeight: '700' } as TextStyle,
  body: { fontSize: 16, lineHeight: 23 } as TextStyle,
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } as TextStyle,
  small: { fontSize: 13 } as TextStyle,
};

export const shadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 5 },
  default: {},
}) as ViewStyle;
