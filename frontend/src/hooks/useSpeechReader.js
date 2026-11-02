import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rankSpanishVoices } from '../utils/speech.js';

const STORAGE_KEY = 'rutas-gastos:speech';

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { return {}; }
}
function writePrefs(prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* preferencia opcional */ }
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
  const [voices, setVoices] = useState([]);
  const [prefs, setPrefs] = useState(() => ({ rate: 1, voiceURI: '', ...readPrefs() }));

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
    const load = () => setVoices(rankSpanishVoices(window.speechSynthesis.getVoices()));
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, [supported]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceURI === prefs.voiceURI) || voices[0] || null,
    [voices, prefs.voiceURI],
  );
  useEffect(() => { voiceRef.current = selectedVoice; }, [selectedVoice]);

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

    const speakSegment = (position) => {
      const utterance = new SpeechSynthesisUtterance(list[position].text);
      const voice = voiceRef.current;
      utterance.lang = voice?.lang || 'es-AR';
      if (voice) utterance.voice = voice;
      utterance.rate = prefsRef.current.rate || 1;
      utterance.onend = () => {
        if (token !== tokenRef.current) return;
        if (position + 1 < list.length) {
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
    play, pause, stop, next, previous, repeat, jump, setRate, setVoiceURI,
  };
}
