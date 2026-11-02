import { createTheme, alpha } from '@mui/material/styles';

/**
 * Sistema de diseño de Rutas & Gastos.
 *
 * Principios: una sola marca (azul índigo), neutros fríos para la estructura y
 * color semántico únicamente para estado y dinero (verde = a favor, rojo = gasto).
 * Superficies planas con borde fino; la elevación se reserva a menús y diálogos.
 */
export const tokens = {
  brand: '#3248C8',
  brandDark: '#26389F',
  brandSoft: '#EEF1FE',
  ink: '#101828',
  inkMuted: '#475467',
  inkSubtle: '#667085',
  line: '#E4E7EC',
  lineStrong: '#D0D5DD',
  canvas: '#F5F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',
  nav: '#0F172A',
  navLine: 'rgba(255,255,255,.08)',
  navText: '#94A3B8',
  navTextActive: '#FFFFFF',
  positive: '#067647',
  positiveSoft: '#ECFDF3',
  negative: '#B42318',
  negativeSoft: '#FEF3F2',
  warning: '#B54708',
  warningSoft: '#FFFAEB',
  info: '#175CD3',
  infoSoft: '#EFF8FF',
};

export const FONT_STACK = '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.brand, dark: tokens.brandDark, light: '#5B70E0', contrastText: '#fff' },
    secondary: { main: '#475467', contrastText: '#fff' },
    success: { main: tokens.positive, light: tokens.positiveSoft, dark: '#054F31' },
    error: { main: tokens.negative, light: tokens.negativeSoft, dark: '#7A271A' },
    warning: { main: tokens.warning, light: tokens.warningSoft, dark: '#93370D' },
    info: { main: tokens.info, light: tokens.infoSoft, dark: '#194185' },
    background: { default: tokens.canvas, paper: tokens.surface },
    text: { primary: tokens.ink, secondary: tokens.inkMuted, disabled: '#98A2B3' },
    divider: tokens.line,
    grey: { 50: '#F9FAFB', 100: '#F2F4F7', 200: '#E4E7EC', 300: '#D0D5DD', 400: '#98A2B3', 500: '#667085', 600: '#475467', 700: '#344054', 800: '#1D2939', 900: '#101828' },
  },
  typography: {
    fontFamily: FONT_STACK,
    fontSize: 14,
    h1: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.25rem', fontWeight: 650, lineHeight: 1.3, letterSpacing: '-0.015em' },
    h3: { fontSize: '1rem', fontWeight: 650, lineHeight: 1.4, letterSpacing: '-0.005em' },
    h4: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontSize: '1.125rem', fontWeight: 650 },
    h6: { fontSize: '1rem', fontWeight: 650 },
    subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    caption: { fontSize: '0.8125rem', lineHeight: 1.5 },
    overline: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', lineHeight: 1.4 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: '0.875rem' },
  },
  shape: { borderRadius: 10 },
  shadows: [
    'none',
    '0 1px 2px rgba(16,24,40,.05)',
    '0 1px 3px rgba(16,24,40,.08), 0 1px 2px rgba(16,24,40,.05)',
    '0 4px 8px -2px rgba(16,24,40,.08), 0 2px 4px -2px rgba(16,24,40,.05)',
    '0 12px 16px -4px rgba(16,24,40,.08), 0 4px 6px -2px rgba(16,24,40,.04)',
    ...Array(20).fill('0 20px 24px -4px rgba(16,24,40,.10), 0 8px 8px -4px rgba(16,24,40,.04)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { minHeight: '100%', WebkitTextSizeAdjust: '100%' },
        body: {
          minHeight: '100vh',
          margin: 0,
          background: tokens.canvas,
          color: tokens.ink,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          fontFeatureSettings: '"cv11", "ss01"',
        },
        '#root': { minHeight: '100vh' },
        '::selection': { color: tokens.ink, background: alpha(tokens.brand, 0.18) },
        '.tabular': { fontVariantNumeric: 'tabular-nums' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 40, borderRadius: 8, paddingInline: 16, fontWeight: 600 },
        sizeSmall: { minHeight: 34, paddingInline: 12, fontSize: '0.8125rem' },
        sizeLarge: { minHeight: 46, paddingInline: 20, fontSize: '0.9375rem' },
        containedPrimary: {
          boxShadow: '0 1px 2px rgba(16,24,40,.08)',
          '&:hover': { backgroundColor: tokens.brandDark },
        },
        outlined: {
          color: tokens.ink,
          borderColor: tokens.lineStrong,
          backgroundColor: tokens.surface,
          '&:hover': { borderColor: '#98A2B3', backgroundColor: tokens.surfaceMuted },
        },
        outlinedPrimary: { color: tokens.brand, borderColor: alpha(tokens.brand, 0.35), '&:hover': { borderColor: tokens.brand, backgroundColor: tokens.brandSoft } },
        text: { '&:hover': { backgroundColor: tokens.brandSoft } },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 8, color: tokens.inkSubtle, '&:hover': { backgroundColor: '#F2F4F7' } } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: `1px solid ${tokens.line}`, borderRadius: 14, backgroundImage: 'none', boxShadow: '0 1px 2px rgba(16,24,40,.04)' } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' }, rounded: { borderRadius: 12 } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: tokens.surface,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: tokens.lineStrong },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#98A2B3' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: tokens.brand },
          '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(tokens.brand, 0.12)}` },
        },
        input: { paddingTop: 12, paddingBottom: 12, fontSize: '1rem' },
        inputSizeSmall: { paddingTop: 9, paddingBottom: 9 },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: tokens.inkSubtle, fontSize: '0.9375rem', '&.Mui-focused': { color: tokens.brand } } },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, fontSize: '0.8125rem' } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600, fontSize: '0.8125rem', height: 28 },
        sizeSmall: { height: 24, fontSize: '0.75rem' },
        outlined: { borderColor: tokens.lineStrong },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 2, borderRadius: 2, backgroundColor: tokens.brand },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 44, textTransform: 'none', fontWeight: 600, fontSize: '0.9375rem', color: tokens.inkSubtle, '&.Mui-selected': { color: tokens.brand } },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 10, alignItems: 'center', fontSize: '0.875rem' },
        standardError: { backgroundColor: tokens.negativeSoft, color: '#7A271A', border: '1px solid #FECDCA' },
        standardWarning: { backgroundColor: tokens.warningSoft, color: '#93370D', border: '1px solid #FEDF89' },
        standardSuccess: { backgroundColor: tokens.positiveSoft, color: '#054F31', border: '1px solid #ABEFC6' },
        standardInfo: { backgroundColor: tokens.infoSoft, color: '#194185', border: '1px solid #B2DDFF' },
        outlinedError: { backgroundColor: tokens.negativeSoft, color: '#7A271A', borderColor: '#FECDCA' },
        outlinedWarning: { backgroundColor: tokens.warningSoft, color: '#93370D', borderColor: '#FEDF89' },
        outlinedSuccess: { backgroundColor: tokens.positiveSoft, color: '#054F31', borderColor: '#ABEFC6' },
        outlinedInfo: { backgroundColor: tokens.infoSoft, color: '#194185', borderColor: '#B2DDFF' },
        filledError: { backgroundColor: tokens.negative },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16, boxShadow: '0 24px 48px -12px rgba(16,24,40,.25)' } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: tokens.ink, fontSize: '0.8125rem', borderRadius: 6 } } },
    MuiAccordion: { styleOverrides: { root: { '&:before': { display: 'none' } } } },
    MuiDivider: { styleOverrides: { root: { borderColor: tokens.line } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: '0.9375rem', minHeight: 40 } } },
    MuiCheckbox: { styleOverrides: { root: { color: tokens.lineStrong } } },
  },
});

export default theme;
