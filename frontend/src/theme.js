import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#5967E8', light: '#8793FF', dark: '#3F4CC2', contrastText: '#FFFFFF' },
    secondary: { main: '#D85CA7', light: '#F18BC2', dark: '#A93C7D', contrastText: '#FFFFFF' },
    success: { main: '#138A70', light: '#DDF6ED', dark: '#0B654F' },
    warning: { main: '#C48628', light: '#FFF3D8', dark: '#885617' },
    error: { main: '#C94E62', light: '#FDE9ED', dark: '#963448' },
    info: { main: '#2587B9', light: '#E3F4FC', dark: '#145B82' },
    background: { default: '#F5F6FC', paper: '#FFFFFF' },
    text: { primary: '#202744', secondary: '#68718D' },
    divider: '#E7EAF4',
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 850, letterSpacing: '-0.045em' },
    h2: { fontWeight: 800, letterSpacing: '-0.035em' },
    h3: { fontWeight: 800, letterSpacing: '-0.03em' },
    h4: { fontWeight: 800, letterSpacing: '-0.025em' },
    h5: { fontWeight: 750, letterSpacing: '-0.02em' },
    h6: { fontWeight: 750, letterSpacing: '-0.015em' },
    button: { fontWeight: 750, textTransform: 'none', letterSpacing: '0.005em' },
    body1: { lineHeight: 1.65 },
    body2: { lineHeight: 1.6 },
  },
  shape: { borderRadius: 15 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { minHeight: '100%', background: '#F5F6FC' },
        body: {
          minHeight: '100vh',
          margin: 0,
          color: '#202744',
          background: 'radial-gradient(circle at 85% 0%, rgba(123, 112, 239, 0.09), transparent 28%), linear-gradient(180deg, #F7F8FD 0%, #F2F5FB 100%)',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        '#root': { minHeight: '100vh' },
        '*': { boxSizing: 'border-box' },
        '::selection': { color: '#303B92', background: '#E2E5FF' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 42, borderRadius: 12, paddingInline: 17, fontWeight: 750, transition: 'transform .18s ease, box-shadow .18s ease, background .18s ease' },
        containedPrimary: {
          color: '#fff',
          background: 'linear-gradient(115deg, #6575F6 0%, #5665DF 50%, #825FDC 100%)',
          boxShadow: '0 7px 18px rgba(91, 103, 232, .23)',
          '&:hover': { background: 'linear-gradient(115deg, #5264E5 0%, #4657CD 52%, #704CCB 100%)', boxShadow: '0 10px 24px rgba(91, 103, 232, .30)', transform: 'translateY(-1px)' },
        },
        outlined: { borderColor: '#DDE2F0', '&:hover': { borderColor: '#AEB7E9', background: '#F7F8FF' } },
        text: { '&:hover': { background: 'rgba(89, 103, 232, .07)' } },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { border: '1px solid #E7EAF4', borderRadius: 19, boxShadow: '0 8px 26px rgba(35, 44, 91, .055)', backgroundImage: 'none' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 18 },
        elevation1: { boxShadow: '0 8px 26px rgba(35, 44, 91, .055)' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12, background: '#FFFFFF', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#DDE2EF' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#AAB3E2' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 1.5, borderColor: '#6977E9' } },
        input: { paddingTop: 13, paddingBottom: 13 },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { color: '#68718D', '&.Mui-focused': { color: '#5967E8' } } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 700 },
        filledPrimary: { color: '#fff', background: 'linear-gradient(120deg, #6575F6, #825FDC)' },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 999, background: 'linear-gradient(90deg, #5967E8, #D85CA7)' } } },
    MuiTab: { styleOverrides: { root: { minHeight: 52, textTransform: 'none', fontWeight: 750, color: '#7A829B', '&.Mui-selected': { color: '#4C59CD' } } } },
  },
});

export default theme;
