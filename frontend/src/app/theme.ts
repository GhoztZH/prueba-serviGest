import { createTheme, type Theme } from '@mui/material/styles';
import tokens from '../shared/styles/tokens.json';

export type Modo = 'light' | 'dark';
export type RolDiseno = 'admin' | 'coordinador' | 'tecnico' | 'cliente';

type TokenColor = { $extensions: { modes: Record<Modo, string> } };
const colores = tokens.color as unknown as Record<string, TokenColor>;

/**
 * Tema de Material UI construido SOLO con los Design Tokens de Figma
 * (tokens.json). No se usan los estilos por defecto de MUI: colores, radios,
 * alturas y tipografía salen de los tokens.
 *
 * - La paleta recibe los valores concretos del modo y del rol (MUI necesita
 *   colores reales para sus cálculos internos).
 * - Los `styleOverrides` usan las variables CSS, así los componentes MUI y el
 *   CSS propio comparten una única fuente de verdad.
 */
export function crearTema(modo: Modo, rol: RolDiseno): Theme {
  const c = (nombre: string) => colores[nombre]!.$extensions.modes[modo];

  return createTheme({
    palette: {
      mode: modo,
      primary: { main: c(`role-${rol}`), contrastText: c(`role-${rol}-ink`) },
      error: { main: c('danger') },
      warning: { main: c('warning') },
      success: { main: c('success') },
      background: { default: c('bg'), paper: c('surface') },
      text: { primary: c('text'), secondary: c('text-muted'), disabled: c('text-disabled') },
      divider: c('border'),
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: 'var(--font-family)',
      fontSize: 13,
      body1: { fontSize: 13 },
      body2: { fontSize: 12 },
      button: { textTransform: 'none', fontWeight: 600, fontSize: 13 },
    },
    components: {
      MuiButtonBase: { defaultProps: { disableRipple: true } },
      MuiButton: {
        defaultProps: { disableElevation: true, variant: 'contained' },
        styleOverrides: {
          root: {
            height: 'var(--size-control-md)',
            minWidth: 0,
            padding: '0 var(--space-lg)',
            borderRadius: 'var(--radius-md)',
            whiteSpace: 'nowrap',
            '&.Mui-focusVisible': { boxShadow: 'var(--focus-ring)' },
            '&.Mui-disabled': { opacity: 'var(--opacity-disabled)' },
          },
          sizeLarge: { height: 'var(--size-control-lg)' },
          sizeSmall: { height: 'var(--size-control-sm)', padding: '0 var(--space-md)' },
          // Primary: color del rol con su tinta (nunca blanco fijo: en oscuro el acento es claro).
          contained: { background: 'var(--color-accent)', color: 'var(--color-accent-ink)', '&.Mui-disabled': { background: 'var(--color-accent)', color: 'var(--color-accent-ink)' } },
          // Secondary: borde del rol sobre superficie.
          outlined: { background: 'var(--color-surface)', color: 'var(--color-text)', borderColor: 'var(--color-accent)', borderWidth: 'var(--border-width-strong)', '&:hover': { borderWidth: 'var(--border-width-strong)', background: 'var(--color-accent-soft)' } },
          // Ghost: acción de bajo peso.
          text: { background: 'var(--color-surface)', color: 'var(--color-text)', border: 'var(--border-width) solid var(--color-border)', '&:hover': { background: 'var(--color-fill-subtle)' } },
        },
      },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true, variant: 'outlined' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            fontSize: 13,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-border)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-control-border)' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-accent)', borderWidth: 'var(--border-width-strong)' },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-danger)' },
            '&.Mui-disabled': { background: 'var(--color-bg)' },
          },
          input: { padding: '9px 12px', height: 18, '&::placeholder': { color: 'var(--color-text-muted)', opacity: 1 } },
          multiline: { padding: '9px 12px' },
        },
      },
      MuiSelect: { styleOverrides: { select: { padding: '9px 32px 9px 12px', minHeight: '18px !important', lineHeight: '18px' } } },
      MuiFormHelperText: { styleOverrides: { root: { margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)', '&.Mui-error': { color: 'var(--color-danger)' } } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: 13, minHeight: 36, '&.Mui-selected': { background: 'var(--color-accent-soft)' }, '&.Mui-selected:hover': { background: 'var(--color-accent-soft)' } } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiPopover: { styleOverrides: { paper: { borderRadius: 'var(--radius-lg)', border: 'var(--border-width) solid var(--color-border)', boxShadow: 'var(--shadow-popover)', marginTop: 8 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-modal)', padding: 'var(--space-xl)', width: '100%', maxWidth: 460 } } },
      MuiBackdrop: { styleOverrides: { root: { '&:not(.MuiBackdrop-invisible)': { background: 'var(--color-overlay)' } } } },
      MuiDrawer: { styleOverrides: { paper: { width: 'var(--size-sidebar)', border: 0 } } },
      MuiSwitch: {
        styleOverrides: {
          root: { width: 40, height: 22, padding: 0 },
          switchBase: { padding: 2, '&.Mui-checked': { transform: 'translateX(18px)', color: 'var(--color-surface)' }, '&.Mui-checked + .MuiSwitch-track': { background: 'var(--color-accent)', opacity: 1 }, '&.Mui-focusVisible + .MuiSwitch-track': { boxShadow: 'var(--focus-ring)' } },
          thumb: { width: 18, height: 18, boxShadow: 'none', background: 'var(--color-surface)' },
          track: { borderRadius: 11, background: 'var(--color-control-border)', opacity: 1 },
        },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: 'var(--radius-md)', fontSize: 13, alignItems: 'center', boxShadow: 'var(--shadow-popover)' } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: 12, background: 'var(--color-text)', color: 'var(--color-surface)' } } },
    },
  });
}
