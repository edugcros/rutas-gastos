import { forwardRef } from 'react';
import { Box, Card, Chip, Stack as MuiStack, Typography } from '@mui/material';
import { tokens } from '../theme.js';

/**
 * MUI 9 ya no acepta alignItems/justifyContent/flexWrap como props de Stack.
 * Este wrapper conserva esa API (incluidos valores responsive) y la traduce a sx.
 */
export const Stack = forwardRef(function Stack({ alignItems, justifyContent, flexWrap, sx, ...rest }, ref) {
  const layout = {};
  if (alignItems !== undefined) layout.alignItems = alignItems;
  if (justifyContent !== undefined) layout.justifyContent = justifyContent;
  if (flexWrap !== undefined) layout.flexWrap = flexWrap;
  return <MuiStack ref={ref} sx={[layout, ...(Array.isArray(sx) ? sx : [sx])]} {...rest} />;
});

/** Encabezado de página: título, descripción opcional y acciones a la derecha. */
export function PageHeader({ title, description, actions, leading, meta }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
      spacing={{ xs: 2, sm: 3 }}
      sx={{ mb: { xs: 3, md: 4 } }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
        {leading}
        <Box sx={{ minWidth: 0 }}>
          {meta}
          <Typography component="h1" variant="h1" noWrap sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' } }}>{title}</Typography>
          {description && <Typography color="textSecondary" sx={{ mt: 0.5 }}>{description}</Typography>}
        </Box>
      </Stack>
      {actions && <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' }, '& > *': { flex: { xs: 1, sm: 'none' } } }}>{actions}</Stack>}
    </Stack>
  );
}

/** Tarjeta de sección con título, subtítulo y acción opcional. */
export function Section({ title, subtitle, action, children, sx, padded = true }) {
  return (
    <Card sx={sx}>
      {(title || action) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: `1px solid ${tokens.line}` }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="h3">{title}</Typography>
            {subtitle && <Typography variant="caption" color="textSecondary">{subtitle}</Typography>}
          </Box>
          {action}
        </Stack>
      )}
      <Box sx={padded ? { p: { xs: 2, sm: 3 } } : undefined}>{children}</Box>
    </Card>
  );
}

/** Indicador numérico. `tone` solo colorea el valor cuando el color aporta significado. */
export function Stat({ label, value, hint, icon: Icon, tone = 'default', featured = false, sx }) {
  const valueColor = featured ? '#fff' : { default: 'text.primary', positive: 'success.main', negative: 'error.main' }[tone];
  return (
    <Card
      sx={{
        p: { xs: 2, sm: 2.5 },
        minWidth: 0,
        ...(featured && { bgcolor: tokens.nav, borderColor: tokens.nav, color: '#fff' }),
        ...sx,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: featured ? 'rgba(255,255,255,.72)' : 'text.secondary' }}>{label}</Typography>
        {Icon && (
          <Box sx={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 2, color: featured ? '#fff' : tokens.brand, bgcolor: featured ? 'rgba(255,255,255,.12)' : tokens.brandSoft }}>
            <Icon size={17} />
          </Box>
        )}
      </Stack>
      <Typography className="tabular" sx={{ mt: 1.25, fontSize: { xs: '1.1875rem', sm: '1.375rem', md: '1.1875rem', xl: '1.625rem' }, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: valueColor, whiteSpace: { sm: 'nowrap' } }}>
        {value}
      </Typography>
      {hint && <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: featured ? 'rgba(255,255,255,.6)' : 'text.secondary' }}>{hint}</Typography>}
    </Card>
  );
}

/** Estado vacío con ícono, mensaje y acción. */
export function EmptyState({ icon: Icon, title, description, action, sx }) {
  return (
    <Box sx={{ py: { xs: 5, sm: 7 }, px: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', ...sx }}>
      <Box sx={{ width: 52, height: 52, display: 'grid', placeItems: 'center', borderRadius: 3, color: tokens.brand, bgcolor: tokens.brandSoft, mb: 2 }}>
        <Icon size={24} />
      </Box>
      <Typography variant="h3">{title}</Typography>
      <Typography color="textSecondary" sx={{ maxWidth: 360, mt: 0.75, mb: action ? 2.5 : 0 }}>{description}</Typography>
      {action}
    </Box>
  );
}

const STATUS = {
  PLANNED: { label: 'Planificado', fg: tokens.info, bg: tokens.infoSoft },
  IN_PROGRESS: { label: 'En curso', fg: tokens.warning, bg: tokens.warningSoft },
  COMPLETED: { label: 'Completado', fg: tokens.positive, bg: tokens.positiveSoft },
  CANCELLED: { label: 'Cancelado', fg: tokens.negative, bg: tokens.negativeSoft },
};

export function StatusChip({ status, size = 'small' }) {
  const meta = STATUS[status] || { label: status, fg: tokens.inkMuted, bg: '#F2F4F7' };
  return <Chip size={size} label={meta.label} sx={{ color: meta.fg, bgcolor: meta.bg, '&::before': { content: '""', width: 6, height: 6, borderRadius: '50%', bgcolor: meta.fg, ml: 1 } }} />;
}

/** Fila etiqueta/valor para resúmenes. */
export function KeyValue({ label, value, tone }) {
  const color = { positive: 'success.main', negative: 'error.main' }[tone] || 'text.primary';
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2}>
      <Typography variant="body2" color="textSecondary">{label}</Typography>
      <Typography className="tabular" variant="body2" sx={{ fontWeight: 600, color, textAlign: 'right' }}>{value}</Typography>
    </Stack>
  );
}
