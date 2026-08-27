let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (audioContext && audioContext.state !== "closed") return audioContext;
  const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext = new AudioContextConstructor();
  return audioContext;
}

function playTone(context: AudioContext, frequency: number, start: number, duration: number) {
  const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.type = "sine"; oscillator.frequency.setValueAtTime(frequency, start); gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(0.06, start + 0.005); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration); oscillator.connect(gain); gain.connect(context.destination); oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); }; oscillator.start(start); oscillator.stop(start + duration);
}

function playSound(notes: Array<{ frequency: number; offset: number; duration: number }>) {
  try { const context = getAudioContext(); if (!context) return; if (context.state === "suspended") void context.resume().catch(() => {}); const start = context.currentTime; notes.forEach((note) => playTone(context, note.frequency, start + note.offset, note.duration)); } catch { /* Audio is optional. */ }
}

export function playSendSound() { playSound([{ frequency: 880, offset: 0, duration: 0.08 }]); }
export function playReceiveSound() { playSound([{ frequency: 523, offset: 0, duration: 0.065 }, { frequency: 659, offset: 0.075, duration: 0.065 }]); }
