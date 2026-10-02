import type { Difficulty } from '../game-engine/ai';
export interface Preferences {
  speed: 'physical' | 'normal' | 'fast';
  difficulty: Difficulty;
  sound: boolean;
  haptic: boolean;
}
export const DEFAULT_PREFS: Preferences = {
  speed: 'physical',
  difficulty: 'normal',
  sound: true,
  haptic: true,
};
export function readPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem('toki.preferences.v1') ?? '{}');
    return {
      speed: ['physical', 'normal', 'fast'].includes(p.speed) ? p.speed : 'physical',
      difficulty: ['easy', 'normal', 'hard'].includes(p.difficulty) ? p.difficulty : 'normal',
      sound: typeof p.sound === 'boolean' ? p.sound : true,
      haptic: typeof p.haptic === 'boolean' ? p.haptic : true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}
export function savePreferences(p: Preferences) {
  try {
    localStorage.setItem('toki.preferences.v1', JSON.stringify(p));
  } catch {}
}
let audio: AudioContext | undefined;
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {}
}
export function feedback(p: Preferences, kind = 'card') {
  if (p.haptic && navigator.vibrate) navigator.vibrate(kind === 'card' ? 8 : 16);
  if (!p.sound) return;
  try {
    if (!audio || audio.state !== 'running') return;
    const duration = kind === 'card' ? 0.055 : 0.12;
    const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.13));
    const source = audio.createBufferSource(),
      filter = audio.createBiquadFilter(),
      gain = audio.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = kind === 'card' ? 1700 : 800;
    gain.gain.value = 0.28;
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
  } catch {}
}
