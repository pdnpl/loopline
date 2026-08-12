/**
 * Two languages, one flat dictionary, no runtime dependency.
 *
 * The game has a few dozen words total, so a translation library would weigh
 * more than the strings it manages.
 */

export type Lang = 'pl' | 'en';

export const LANGS: readonly Lang[] = ['pl', 'en'];

const en = {
  brand: 'Loopline',
  tagline: 'One stroke. Every line. No retracing.',

  level: 'Level',
  time: 'Time',
  best: 'Best',
  linesLeft: 'lines left',

  introTitle: 'How to play',
  introStep1: 'Press any dot and keep holding.',
  introStep2: 'Drag over every line exactly once — no line twice.',
  introStep3: 'Drag backwards to undo. Lift your finger and the run ends.',
  introStart: 'Start',

  failedTitle: 'You lifted off',
  failedBody: 'The stroke has to be unbroken. Go again.',
  deadEnd: 'Dead end — drag back',

  solvedTitle: 'Solved',
  newBest: 'New best',
  next: 'Next level',
  replay: 'Beat this time',

  restart: 'Restart',
  retry: 'Try again',
  tapAnywhere: 'or tap anywhere',

  language: 'Language',
  theme: 'Theme',
  themeAuto: 'System theme',
  themeDark: 'Dark theme',
  themeLight: 'Light theme',
  help: 'How to play',

  keyboardHint: 'Keyboard: arrows to draw, Backspace to undo, R to restart.',

  a11yBoard: 'Puzzle board. Draw one unbroken stroke over every line.',
  a11yStart: 'Stroke started.',
  a11ySolved: 'Solved in {time}.',
  a11yFailed: 'Run ended. Try again.',
  a11yDeadEnd: 'Dead end. No line leaves this dot. Go back or start over.',
} as const;

type Dictionary = Record<keyof typeof en, string>;

const pl: Dictionary = {
  brand: 'Loopline',
  tagline: 'Jedno pociągnięcie. Każda linia. Bez powtórek.',

  level: 'Poziom',
  time: 'Czas',
  best: 'Rekord',
  linesLeft: 'linii zostało',

  introTitle: 'Jak grać',
  introStep1: 'Przyłóż palec do dowolnej kropki i nie odrywaj go.',
  introStep2: 'Przeciągnij po każdej linii dokładnie raz — żadnej dwa razy.',
  introStep3: 'Cofnij palec, aby wymazać ruch. Oderwanie palca kończy próbę.',
  introStart: 'Zaczynamy',

  failedTitle: 'Palec oderwany',
  failedBody: 'Pociągnięcie musi być ciągłe. Jeszcze raz.',
  deadEnd: 'Ślepy zaułek — cofnij palec',

  solvedTitle: 'Rozwiązane',
  newBest: 'Nowy rekord',
  next: 'Następny poziom',
  replay: 'Popraw ten czas',

  restart: 'Od nowa',
  retry: 'Jeszcze raz',
  tapAnywhere: 'albo dotknij gdziekolwiek',

  language: 'Język',
  theme: 'Motyw',
  themeAuto: 'Motyw systemowy',
  themeDark: 'Motyw ciemny',
  themeLight: 'Motyw jasny',
  help: 'Jak grać',

  keyboardHint: 'Klawiatura: strzałki rysują, Backspace cofa, R restartuje.',

  a11yBoard: 'Plansza. Narysuj jedno ciągłe pociągnięcie po wszystkich liniach.',
  a11yStart: 'Rozpoczęto pociągnięcie.',
  a11ySolved: 'Rozwiązane w {time}.',
  a11yFailed: 'Próba zakończona. Spróbuj ponownie.',
  a11yDeadEnd:
    'Ślepy zaułek. Z tej kropki nie wychodzi żadna linia. Cofnij się albo zacznij od nowa.',
};

const messages: Record<Lang, Dictionary> = { en, pl };

export type MessageKey = keyof Dictionary;

export function translate(
  lang: Lang,
  key: MessageKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  const template = messages[lang][key];
  if (params === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/** Picks a language from the browser, defaulting to English. */
export function detectLang(): Lang {
  const candidates =
    typeof navigator === 'undefined' ? [] : [navigator.language, ...(navigator.languages ?? [])];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.toLowerCase().startsWith('pl')) return 'pl';
  }
  return 'en';
}
