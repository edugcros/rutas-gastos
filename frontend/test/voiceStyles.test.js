import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_STYLES, expandNumbers, numberToSpanish, pickVoiceForStyle, spanishToCyrillic, styleText, voiceGender } from '../src/utils/voiceStyles.js';

test('numbers are spelled in Spanish', () => {
  assert.equal(numberToSpanish(0), 'cero');
  assert.equal(numberToSpanish(21), 'veintiuno');
  assert.equal(numberToSpanish(100), 'cien');
  assert.equal(numberToSpanish(151), 'ciento cincuenta y uno');
  assert.equal(numberToSpanish(817), 'ochocientos diecisiete');
  assert.equal(numberToSpanish(1000), 'mil');
  assert.equal(numberToSpanish(21000), 'veintiún mil');
  assert.equal(numberToSpanish(2026), 'dos mil veintiséis');
  assert.equal(numberToSpanish(1_250_000), 'un millón doscientos cincuenta mil');
});

test('expandNumbers handles decimals, thousands separators and ordinals', () => {
  assert.equal(expandNumbers('817,7 kilómetros'), 'ochocientos diecisiete coma siete kilómetros');
  assert.equal(expandNumbers('1.250 metros'), 'mil doscientos cincuenta metros');
  assert.equal(expandNumbers('toma la 2.ª salida'), 'toma la segunda salida');
  assert.equal(expandNumbers('el 1º paso'), 'el primero paso');
  assert.equal(expandNumbers('sin números'), 'sin números');
});

test('Spanish is transliterated to Cyrillic following Spanish pronunciation', () => {
  assert.equal(spanishToCyrillic('Mendoza'), 'мэндоса');
  assert.equal(spanishToCyrillic('Neuquén'), 'нэукэн');
  assert.equal(spanishToCyrillic('San Rafael'), 'сан рафаэл');
  assert.equal(spanishToCyrillic('que'), 'кэ');
  assert.equal(spanishToCyrillic('guerra'), 'гэрра');
  assert.equal(spanishToCyrillic('gira'), 'хира');
  assert.equal(spanishToCyrillic('cine'), 'синэ');
  assert.equal(spanishToCyrillic('casa'), 'каса');
  assert.equal(spanishToCyrillic('hacia'), 'асиа');
  assert.equal(spanishToCyrillic('calle'), 'кайэ');
  assert.equal(spanishToCyrillic('año'), 'аньо');
  assert.equal(spanishToCyrillic('chico'), 'чико');
  assert.equal(spanishToCyrillic('pingüino'), 'пингвино');
});

test('numbers are spoken as Spanish words before transliteration', () => {
  assert.equal(spanishToCyrillic('Ruta 40'), 'рута куарэнта');
});

test('voice gender is inferred from well-known voice names', () => {
  assert.equal(voiceGender({ name: 'Microsoft Salome Online (Natural) - Spanish (Colombia)' }), 'f');
  assert.equal(voiceGender({ name: 'Microsoft Gonzalo Online (Natural) - Spanish (Colombia)' }), 'm');
  assert.equal(voiceGender({ name: 'Microsoft Irina - Russian (Russia)' }), 'f');
  assert.equal(voiceGender({ name: 'Voz desconocida' }), '?');
});

const voice = (name, lang, localService = true) => ({ name, lang, localService, voiceURI: name });

test('Colombian style prefers a female es-CO voice, then approximates, then reports none', () => {
  const salome = voice('Microsoft Salome Online (Natural) - Spanish (Colombia)', 'es-CO', false);
  const gonzalo = voice('Microsoft Gonzalo Online (Natural) - Spanish (Colombia)', 'es-CO', false);
  const helena = voice('Microsoft Helena - Spanish (Spain)', 'es-ES');
  const dalia = voice('Microsoft Dalia Online (Natural) - Spanish (Mexico)', 'es-MX', false);
  assert.deepEqual(pickVoiceForStyle('colombiana', [gonzalo, helena, salome]), { voice: salome, match: 'exact' });
  assert.deepEqual(pickVoiceForStyle('colombiana', [gonzalo, helena, dalia]), { voice: dalia, match: 'approx' });
  assert.equal(pickVoiceForStyle('colombiana', [helena]).voice, helena);
  assert.equal(pickVoiceForStyle('colombiana', [voice('English', 'en-US')]).match, 'none');
});

test('Russian style needs a Russian voice and prefers a female one', () => {
  const irina = voice('Microsoft Irina - Russian (Russia)', 'ru-RU');
  const pavel = voice('Microsoft Pavel - Russian (Russia)', 'ru-RU');
  assert.deepEqual(pickVoiceForStyle('rusa', [pavel, irina]), { voice: irina, match: 'exact' });
  assert.deepEqual(pickVoiceForStyle('rusa', [pavel]), { voice: pavel, match: 'approx' });
  assert.equal(pickVoiceForStyle('rusa', [voice('Helena', 'es-ES')]).match, 'none');
});

test('style text: Russian is Cyrillic, Colombian adds pauses, standard is untouched', () => {
  assert.equal(styleText('standard', 'Paso 1. Gira.'), 'Paso 1. Gira.');
  assert.equal(styleText('colombiana', 'Paso uno. Gira.'), 'Paso uno... Gira.');
  assert.match(styleText('rusa', 'Gira a la derecha. Sigue.'), /^хира а ла дэрэча\.\.\. хигэ\.?|^[а-яё .]+$/);
  assert.ok(!/[a-z]/i.test(styleText('rusa', 'Ruta Nacional 151.')), 'nothing is left in Latin letters or digits');
});

test('styles define slower, softer delivery than standard', () => {
  const [standard, colombiana, rusa] = VOICE_STYLES;
  assert.equal(standard.rate, 1);
  assert.ok(colombiana.rate < 1 && rusa.rate < 1);
  assert.ok(colombiana.pitch < 1 && rusa.pitch < colombiana.pitch);
});

// ---------- Estilo Medellín ----------
import { melodicParts, seseo, splitPhrases, styleParts, voseo } from '../src/utils/voiceStyles.js';

test('seseo makes a Spain voice read z/ce/ci like Latin American Spanish', () => {
  assert.equal(seseo('Mendoza'), 'Mendosa');
  assert.equal(seseo('Zapala, Cipolletti, cruce'), 'Sapala, Sipolletti, cruse');
  assert.equal(seseo('chico, casa, que'), 'chico, casa, que', 'ch, ca and que are untouched');
  assert.equal(seseo('dirección'), 'direcsión', 'cc is read k+s: only the second c softens');
});

test('voseo turns common directions into the paisa form, keeping capitalization', () => {
  assert.equal(voseo('Gira a la derecha'), 'Girá a la derecha');
  assert.equal(voseo('Continúa por RN151 y toma la salida'), 'Continuá por RN151 y tomá la salida');
  assert.equal(voseo('Mantente a la izquierda'), 'Mantenete a la izquierda');
  assert.equal(voseo('Sigue recto'), 'Seguí recto');
  assert.equal(voseo('la salida'), 'la salida', 'sal inside salida is untouched');
  assert.equal(voseo('girasol'), 'girasol', 'words that merely contain a verb are untouched');
});

test('phrases split on sentences then commas', () => {
  assert.deepEqual(splitPhrases('Hola, vamos despacio. Seguí recto, sin apuro.'), [['Hola,', 'vamos despacio.'], ['Seguí recto,', 'sin apuro.']]);
});

test('melodic contour rises on continuing phrases and falls and slows on closing ones', () => {
  const parts = melodicParts('Gira a la derecha, luego sigue. ¿Entendido?', { pitch: 1 });
  assert.equal(parts.length, 3);
  assert.ok(parts[0].pitch > 1, 'continuing phrase rises');
  assert.ok(parts[1].pitch < 1, 'closing phrase falls');
  assert.ok(parts[1].rateFactor < parts[0].rateFactor, 'closing phrase slows down');
  assert.ok(parts[2].pitch > 1, 'questions close rising');
  assert.ok(parts[1].text.endsWith('...'), 'closing phrase gets a longer pause');
  assert.ok(parts.every((part) => part.pitch >= 0.1 && part.pitch <= 2));
});

test('Colombian style applies seseo only to Spain voices and always voseo', () => {
  const spain = { lang: 'es-ES' };
  const colombia = { lang: 'es-CO' };
  assert.match(styleParts('colombiana', 'Gira hacia Mendoza.', spain).map((p) => p.text).join(' '), /Girá hasia Mendosa/);
  assert.match(styleParts('colombiana', 'Gira hacia Mendoza.', colombia).map((p) => p.text).join(' '), /Girá hacia Mendoza/);
  const standard = styleParts('standard', 'Gira hacia Mendoza.', spain);
  assert.equal(standard.length, 1);
  assert.equal(standard[0].text, 'Gira hacia Mendoza.');
});
