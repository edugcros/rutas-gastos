import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rankSpanishVoices } from '../utils/speech.js';
import { STYLE_PREVIEW, VOICE_STYLES, effectiveStyle, pickVoiceForStyle, styleParts } from '../utils/voiceStyles.js';

const STORAGE_KEY = 'rutas-gastos:speech';

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; }
}
function writePrefs(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* preferencia opcional */ }
}

// Si la persona eligió una voz base para el estilo y sigue instalada, manda sobre la elegida automáticamente.
function withChosenVoice(picked, allVoices, chosenURI) {
  const chosen = chosenURI ? allVoices.find((voice) => voice.voiceURI === chosenURI) : null;
  return chosen ? { voice: chosen, match: 'exact' } : picked;
}

export const isSpeechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/**
 * Lector en voz alta basado en la Web Speech API (funciona sin conexión con las
 * voces instaladas en el dispositivo). Cada segmento es un utterance propio:
 * pausar equivale a detener y retomar el mismo segmento, que es lo único que
 * funciona igual en Chrome, Safari y Android (pause/resume nativos no lo hacen).
 *
 * @param {{id: string, text: string}[]} segments
 */
export function useSpeechReader(segments) {
  const supported = isSpeechSupported();
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | playing | paused | finished
  const [allVoices, setAllVoices] = useState([]);
  const [prefs, setPrefs] = useState(() => ({ rate: 1, voiceURI: '', styleId: 'standard', tuning: {}, styleVoices: {}, ...readPrefs() }));

  const tokenRef = useRef(0); // invalida callbacks de utterances ya cancelados
  const indexRef = useRef(0);
  const segmentsRef = useRef(segments);
  const prefsRef = useRef(prefs);
  const voiceRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  useEffect(() => { prefsRef.current = prefs; writePrefs(prefs); }, [prefs]);

  useEffect(() => {
    if (!supported) return undefined;
    const load = () => setAllVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, [supported]);

  const voices = useMemo(() => rankSpanishVoices(allVoices), [allVoices]);
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceURI === prefs.voiceURI) || voices[0] || null,
    [voices, prefs.voiceURI],
  );

  // Disponibilidad de cada estilo según las voces instaladas en este dispositivo.
  const styles = useMemo(() => VOICE_STYLES.map((style) => ({
    ...style,
    ...(style.id === 'standard' ? { voice: selectedVoice, match: 'exact' } : withChosenVoice(pickVoiceForStyle(style.id, allVoices), allVoices, (prefs.styleVoices || {})[style.id])),
  })), [allVoices, selectedVoice, prefs.styleVoices]);
  const baseStyle = styles.find((style) => style.id === prefs.styleId && style.match !== 'none') || styles[0];
  const activeStyle = useMemo(() => effectiveStyle(baseStyle, (prefs.tuning || {})[baseStyle.id]), [baseStyle, prefs.tuning]);
  const activeStyleRef = useRef(activeStyle);
  useEffect(() => { activeStyleRef.current = activeStyle; voiceRef.current = activeStyle.voice || selectedVoice; }, [activeStyle, selectedVoice]);

  const halt = useCallback(() => {
    tokenRef.current += 1;
    window.clearTimeout(timerRef.current);
    if (isSpeechSupported()) window.speechSynthesis.cancel();
  }, []);

  const moveTo = useCallback((next) => {
    indexRef.current = next;
    setIndex(next);
  }, []);

  const speakFrom = useCallback((start) => {
    if (!isSpeechSupported()) return;
    const list = segmentsRef.current;
    if (!list.length || start < 0 || start >= list.length) return;
    halt();
    const token = tokenRef.current;
    moveTo(start);
    setStatus('playing');

    // Cada segmento se dice en tramos (frases cortas) con tono y velocidad propios: así el
    // estilo puede tener melodía. Solo el último tramo avanza al segmento siguiente.
    const speakSegment = (position) => {
      const style = activeStyleRef.current;
      const voice = voiceRef.current;
      const parts = styleParts(style.id, list[position].text, voice, { pitch: style.pitch, melody: style.melody });

      const speakPart = (partIndex) => {
        const part = parts[partIndex];
        const utterance = new SpeechSynthesisUtterance(part.text);
        utterance.lang = voice?.lang || 'es-AR';
        if (voice) utterance.voice = voice;
        // Velocidad elegida por la persona x factor del estilo x factor del tramo.
        utterance.rate = Math.min(2, Math.max(0.5, (prefsRef.current.rate || 1) * style.rate * part.rateFactor));
        utterance.pitch = part.pitch;
        utterance.volume = style.volume;
        utterance.onend = () => {
          if (token !== tokenRef.current) return;
          if (partIndex + 1 < parts.length) speakPart(partIndex + 1);
          else if (position + 1 < list.length) {
            moveTo(position + 1);
            speakSegment(position + 1);
          } else {
            setStatus('finished');
          }
        };
        utterance.onerror = (event) => {
          if (token !== tokenRef.current) return;
          // "interrupted"/"canceled" son cancelaciones propias; cualquier otro error detiene la lectura.
          if (event.error !== 'interrupted' && event.error !== 'canceled') setStatus('paused');
        };
        window.speechSynthesis.speak(utterance);
      };
      speakPart(0);
    };

    // Chrome pierde el primer speak() si llega justo después de cancel().
    timerRef.current = window.setTimeout(() => { if (token === tokenRef.current) speakSegment(start); }, 60);
  }, [halt, moveTo]);

  const play = useCallback(() => {
    const start = status === 'finished' ? 0 : indexRef.current;
    speakFrom(start);
  }, [speakFrom, status]);

  const pause = useCallback(() => {
    if (status !== 'playing') return;
    halt();
    setStatus('paused');
  }, [halt, status]);

  const stop = useCallback(() => {
    halt();
    moveTo(0);
    setStatus('idle');
  }, [halt, moveTo]);

  const jump = useCallback((target) => {
    const last = segmentsRef.current.length - 1;
    if (last < 0) return;
    speakFrom(Math.min(Math.max(target, 0), last));
  }, [speakFrom]);

  const next = useCallback(() => jump(indexRef.current + 1), [jump]);
  const previous = useCallback(() => jump(indexRef.current - 1), [jump]);
  const repeat = useCallback(() => jump(indexRef.current), [jump]);

  const setRate = useCallback((rate) => {
    setPrefs((current) => ({ ...current, rate }));
    prefsRef.current = { ...prefsRef.current, rate };
    // Aplica el cambio de inmediato retomando el segmento actual.
    if (status === 'playing') speakFrom(indexRef.current);
  }, [speakFrom, status]);

  const setVoiceURI = useCallback((voiceURI) => {
    setPrefs((current) => ({ ...current, voiceURI }));
    voiceRef.current = voices.find((voice) => voice.voiceURI === voiceURI) || voiceRef.current;
    if (status === 'playing') speakFrom(indexRef.current);
  }, [speakFrom, status, voices]);

  /** Ajuste fino por estilo (tono, velocidad, volumen, melodía); se guarda en este dispositivo. */
  const setTuning = useCallback((changes) => {
    setPrefs((current) => ({
      ...current,
      tuning: { ...(current.tuning || {}), [activeStyle.id]: { ...((current.tuning || {})[activeStyle.id] || {}), ...changes } },
    }));
  }, [activeStyle.id]);

  const resetTuning = useCallback(() => {
    setPrefs((current) => {
      const next = { ...(current.tuning || {}) };
      delete next[activeStyle.id];
      return { ...current, tuning: next };
    });
  }, [activeStyle.id]);

  /** Voz base elegida a mano para el estilo activo (por ejemplo Helena en vez de Laura). */
  const setStyleVoice = useCallback((voiceURI) => {
    setPrefs((current) => ({ ...current, styleVoices: { ...(current.styleVoices || {}), [activeStyle.id]: voiceURI } }));
    const chosen = allVoices.find((voice) => voice.voiceURI === voiceURI);
    if (chosen) voiceRef.current = chosen;
    if (status === 'playing') speakFrom(indexRef.current);
  }, [activeStyle.id, allVoices, speakFrom, status]);

  // Voces entre las que se puede elegir como base del estilo activo.
  const candidateVoices = useMemo(() => {
    if (activeStyle.id === 'rusa') return allVoices.filter((voice) => /^ru/i.test(voice.lang));
    if (activeStyle.id === 'colombiana') return rankSpanishVoices(allVoices);
    return [];
  }, [activeStyle.id, allVoices]);

  const setStyleId = useCallback((styleId) => {
    setPrefs((current) => ({ ...current, styleId }));
    const target = styles.find((style) => style.id === styleId);
    if (target && target.match !== 'none') {
      activeStyleRef.current = target;
      voiceRef.current = target.voice || voiceRef.current;
    }
    if (status === 'playing') speakFrom(indexRef.current);
  }, [speakFrom, status, styles]);

  /** Frase corta con el estilo activo, para elegir voz sin recorrer la hoja de ruta. */
  const preview = useCallback(() => {
    if (!isSpeechSupported()) return;
    halt();
    setStatus((current) => (current === 'playing' ? 'paused' : current));
    const style = activeStyleRef.current;
    const voice = voiceRef.current;
    const token = tokenRef.current;
    const parts = styleParts(style.id, STYLE_PREVIEW, voice, { pitch: style.pitch, melody: style.melody });
    const speakPart = (partIndex) => {
      if (token !== tokenRef.current || partIndex >= parts.length) return;
      const part = parts[partIndex];
      const utterance = new SpeechSynthesisUtterance(part.text);
      utterance.lang = voice?.lang || 'es-AR';
      if (voice) utterance.voice = voice;
      utterance.rate = Math.min(2, Math.max(0.5, (prefsRef.current.rate || 1) * style.rate * part.rateFactor));
      utterance.pitch = part.pitch;
      utterance.volume = style.volume;
      utterance.onend = () => speakPart(partIndex + 1);
      window.speechSynthesis.speak(utterance);
    };
    window.setTimeout(() => speakPart(0), 60);
  }, [halt]);

  // Si cambia la hoja de ruta (otra alternativa), la lectura anterior ya no corresponde.
  const scriptKey = segments.map((segment) => segment.text).join('\n');
  useEffect(() => {
    if (!supported) return;
    halt();
    indexRef.current = 0;
    setIndex(0);
    setStatus('idle');
  }, [scriptKey, supported, halt]);

  useEffect(() => () => { tokenRef.current += 1; window.clearTimeout(timerRef.current); if (isSpeechSupported()) window.speechSynthesis.cancel(); }, []);

  return {
    supported, status, index, total: segments.length, current: segments[index] || null,
    voices, voiceURI: selectedVoice?.voiceURI || '', rate: prefs.rate,
    styles, styleId: activeStyle.id, styleVoice: activeStyle.voice, styleMatch: activeStyle.match,
    tuning: { pitch: activeStyle.pitch, rate: activeStyle.rate, volume: activeStyle.volume, melody: activeStyle.melody },
    tuned: Boolean((prefs.tuning || {})[activeStyle.id] && Object.keys(prefs.tuning[activeStyle.id]).length),
    setTuning, resetTuning, candidateVoices, setStyleVoice,
    play, pause, stop, next, previous, repeat, jump, setRate, setVoiceURI, setStyleId, preview,
  };
}
