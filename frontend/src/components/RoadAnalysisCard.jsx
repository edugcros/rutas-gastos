import { Alert, Box, Chip, Link, Typography } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { CLOSURE_LABELS, CONFIDENCE_LABELS, SURFACE_LABELS, UNPAVED_LABELS, formatGeneratedAt } from '../utils/roadAnalysis.js';
import { tokens } from '../theme.js';
import { Section, Stack } from './ui.jsx';

const SURFACE_TONE = {
  PAVED: { fg: tokens.positive, bg: tokens.positiveSoft },
  GRAVEL: { fg: tokens.warning, bg: tokens.warningSoft },
  DIRT: { fg: tokens.negative, bg: tokens.negativeSoft },
  MIXED: { fg: tokens.warning, bg: tokens.warningSoft },
  UNKNOWN: { fg: tokens.inkMuted, bg: '#F2F4F7' },
};
const UNPAVED_TONE = { NONE: 'success', LOW: 'success', MEDIUM: 'warning', HIGH: 'error', UNKNOWN: 'default' };

/** Estado del camino: tipo de superficie, cortes y recomendaciones del análisis con IA. */
export default function RoadAnalysisCard({ analysis, unavailable = false }) {
  if (!analysis) {
    return unavailable ? (
      <Section title="Estado del camino" subtitle="Análisis con IA">
        <Alert severity="info">El análisis del camino no estuvo disponible en esta consulta. Verificá el estado de las rutas con Vialidad antes de salir.</Alert>
      </Section>
    ) : null;
  }
  const asOf = formatGeneratedAt(analysis.generatedAt);

  return (
    <Section
      title="Estado del camino"
      subtitle={asOf ? `Análisis con IA y búsqueda web · ${asOf}` : 'Análisis con IA y búsqueda web'}
      action={<Chip size="small" icon={<Sparkles size={13} />} label="Orientativo" sx={{ bgcolor: tokens.brandSoft, color: tokens.brand, '& .MuiChip-icon': { color: 'inherit' } }} />}
    >
      <Stack spacing={2}>
        {analysis.avoidWarnings.map((message) => <Alert key={message} severity="error">{message}</Alert>)}

        <Box>
          <Chip size="small" color={UNPAVED_TONE[analysis.unpavedLikelihood]} variant="outlined" label={UNPAVED_LABELS[analysis.unpavedLikelihood]} sx={{ mb: 1 }} />
          {analysis.summary && <Typography>{analysis.summary}</Typography>}
        </Box>

        {analysis.closures.length > 0 && (
          <Box component="ul" aria-label="Cortes, obras y riesgos" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
            {analysis.closures.map((closure, index) => (
              <Alert component="li" key={`${closure.road}-${index}`} severity={closure.status === 'CLOSED' ? 'error' : 'warning'} sx={{ alignItems: 'flex-start' }}>
                <Typography variant="subtitle2" sx={{ color: 'inherit' }}>{CLOSURE_LABELS[closure.status]} · {closure.road}</Typography>
                <Typography variant="body2" sx={{ color: 'inherit' }}>{closure.description}{closure.asOf ? ` (${closure.asOf})` : ''}</Typography>
              </Alert>
            ))}
          </Box>
        )}

        {analysis.segments.length > 0 && (
          <Box component="ul" aria-label="Tipo de camino por ruta" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {analysis.segments.map((segment, index) => {
              const tone = SURFACE_TONE[segment.surface];
              return (
                <Stack component="li" key={`${segment.road}-${index}`} direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ py: 1.25, '&:not(:last-of-type)': { borderBottom: `1px solid ${tokens.line}` } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{segment.road}</Typography>
                    {segment.note && <Typography variant="body2" color="textSecondary">{segment.note}</Typography>}
                  </Box>
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Chip size="small" label={SURFACE_LABELS[segment.surface]} sx={{ color: tone.fg, bgcolor: tone.bg }} />
                    <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 0.5 }}>{CONFIDENCE_LABELS[segment.confidence]}</Typography>
                  </Box>
                </Stack>
              );
            })}
          </Box>
        )}

        {analysis.recommendations.length > 0 && (
          <Box>
            <Typography variant="subtitle2">Recomendaciones</Typography>
            <Box component="ul" sx={{ pl: 2.5, my: 0.75, '& li': { mb: 0.5 } }}>
              {analysis.recommendations.map((item, index) => <li key={index}><Typography variant="body2" component="span">{item}</Typography></li>)}
            </Box>
          </Box>
        )}

        {analysis.sources.length > 0 && (
          <Typography variant="caption" color="textSecondary">
            Fuentes consultadas:{' '}
            {analysis.sources.map((source, index) => (
              <span key={source.uri}>{index > 0 ? ' · ' : ''}<Link href={source.uri} target="_blank" rel="noopener noreferrer" underline="hover">{source.title}</Link></span>
            ))}
          </Typography>
        )}
        <Typography variant="caption" color="textSecondary">
          Generado por una IA: puede estar incompleto o desactualizado. No reemplaza a Vialidad ni a las autoridades locales.
        </Typography>
      </Stack>
    </Section>
  );
}
