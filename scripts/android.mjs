// Runs the Android Gradle wrapper from the repository root, on any platform.
//
// This exists because neither spelling of the wrapper is portable: `./gradlew`
// is a parse error in Windows `cmd`, which is what npm runs scripts through,
// and a bare `gradlew` finds nothing on a POSIX shell. One small script beats
// a package.json entry that only works on the machine it was written on.
//
// Usage: node scripts/android.mjs [gradle task...]   (default: assembleDebug)

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectDir = join(root, 'android');
const windows = process.platform === 'win32';
const wrapper = windows ? 'gradlew.bat' : './gradlew';
const tasks = process.argv.slice(2);

const result = spawnSync(wrapper, tasks.length > 0 ? tasks : ['assembleDebug'], {
  cwd: projectDir,
  stdio: 'inherit',
  // cmd needs a shell to resolve the .bat; a POSIX shell does not, and giving
  // it one would only add a layer of quoting to get wrong.
  shell: windows,
});

if (result.error) {
  // stderr rather than console, which the repo's ESLint config does not declare
  // as a global outside src/ and tests/.
  process.stderr.write(
    `Could not run the Gradle wrapper in ${projectDir}: ${result.error.message}\n`,
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
