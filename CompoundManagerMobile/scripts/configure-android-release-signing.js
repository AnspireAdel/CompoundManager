#!/usr/bin/env node
/**
 * After `expo prebuild`, copy the release keystore into android/app
 * and switch the release build type off the debug keystore.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const credDir = path.join(root, 'credentials', 'android');
const propsPath = path.join(credDir, 'keystore.properties');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');

if (!fs.existsSync(propsPath)) {
  console.error('Missing', propsPath);
  process.exit(1);
}
if (!fs.existsSync(gradlePath)) {
  console.error('Missing', gradlePath, '- run expo prebuild first');
  process.exit(1);
}

const props = Object.fromEntries(
  fs
    .readFileSync(propsPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const storeSrc = path.join(credDir, props.storeFile);
const storeDest = path.join(root, 'android', 'app', props.storeFile);
fs.copyFileSync(storeSrc, storeDest);

let gradle = fs.readFileSync(gradlePath, 'utf8');

const releaseConfig = `        release {
            storeFile file('${props.storeFile}')
            storePassword '${props.storePassword}'
            keyAlias '${props.keyAlias}'
            keyPassword '${props.keyPassword}'
        }`;

if (/signingConfigs\s*\{[\s\S]*?release\s*\{/.test(gradle)) {
  gradle = gradle.replace(
    /signingConfigs\s*\{([\s\S]*?)(\n    \})/,
    (full, inner, close) => {
      const withoutRelease = inner.replace(/\n        release \{[\s\S]*?\n        \}/, '');
      return `signingConfigs {${withoutRelease}\n${releaseConfig}${close}`;
    }
  );
} else if (/signingConfigs\s*\{/.test(gradle)) {
  gradle = gradle.replace(/signingConfigs\s*\{/, `signingConfigs {\n${releaseConfig}`);
} else {
  console.error('Could not find signingConfigs in', gradlePath);
  process.exit(1);
}

gradle = gradle.replace(
  /release\s*\{([\s\S]*?)signingConfig signingConfigs\.debug/,
  'release {$1signingConfig signingConfigs.release'
);

if (!/signingConfig signingConfigs\.release/.test(gradle)) {
  console.error('Failed to set release signingConfig');
  process.exit(1);
}

fs.writeFileSync(gradlePath, gradle);
console.log('Release signing configured:', storeDest);
console.log('Alias:', props.keyAlias);
