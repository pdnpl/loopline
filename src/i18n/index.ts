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

  levels: 'Levels',
  levelsTitle: 'Choose a level',
  levelsHint: 'Every level you have reached. Tap one to play it.',
  levelSolved: 'solved in {time}',
  close: 'Close',
  retry: 'Try again',
  tapAnywhere: 'or tap anywhere',
  resetProgress: 'Start the game over',
  resetConfirm: 'Erase progress? Press again',
  resetDone: 'Progress erased',

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
  a11yRestarted: 'Board cleared. Level {level}.',
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

  levels: 'Poziomy',
  levelsTitle: 'Wybierz poziom',
  levelsHint: 'Każdy poziom, do którego dotarłeś. Dotknij, żeby zagrać.',
  levelSolved: 'rozwiązany w {time}',
  close: 'Zamknij',
  retry: 'Jeszcze raz',
  tapAnywhere: 'albo dotknij gdziekolwiek',
  resetProgress: 'Zacznij grę od nowa',
  resetConfirm: 'Skasować postęp? Naciśnij ponownie',
  resetDone: 'Postęp skasowany',

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
  a11yRestarted: 'Plansza wyczyszczona. Poziom {level}.',
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
