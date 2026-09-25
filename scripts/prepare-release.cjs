const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function computeSha512(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha512').update(buf).digest('base64');
}

function run() {
  const releaseDir = path.resolve(__dirname, '..', 'release');
  const latestYmlPath = path.join(releaseDir, 'latest.yml');

  if (!fs.existsSync(latestYmlPath)) {
    console.warn('[prepare-release] No release/latest.yml found. Run "npm run dist:win" first.');
    return;
  }

  const latestYmlContent = fs.readFileSync(latestYmlPath, 'utf8');
  const versionMatch = latestYmlContent.match(/^version:\s*(.+)$/m);
  const pathMatch = latestYmlContent.match(/^path:\s*(.+)$/m);
  const shaMatch = latestYmlContent.match(/^sha512:\s*(.+)$/m);

  if (!versionMatch || !pathMatch) {
    console.error('[prepare-release] Error parsing latest.yml.');
    return;
  }

  const version = versionMatch[1].trim();
  const exeFilename = pathMatch[1].trim();
  const expectedSha = shaMatch ? shaMatch[1].trim() : null;

  console.log(`\n==================================================`);
  console.log(`🦅 Albaqros Release Verifier & Preparer (v${version})`);
  console.log(`==================================================`);

  let primaryExePath = path.join(releaseDir, exeFilename);

  // If the hyphenated file doesn't exist but the space-separated default does, fix it automatically
  if (!fs.existsSync(primaryExePath)) {
    const spaceSeparated = path.join(releaseDir, `Albaqros Setup ${version}.exe`);
    const dotSeparated = path.join(releaseDir, `Albaqros.Setup.${version}.exe`);
    if (fs.existsSync(spaceSeparated)) {
      console.log(`ℹ️ Auto-generating ${exeFilename} from ${path.basename(spaceSeparated)}...`);
      fs.copyFileSync(spaceSeparated, primaryExePath);
      const spaceBlockmap = `${spaceSeparated}.blockmap`;
      if (fs.existsSync(spaceBlockmap)) {
        fs.copyFileSync(spaceBlockmap, `${primaryExePath}.blockmap`);
      }
    } else if (fs.existsSync(dotSeparated)) {
      console.log(`ℹ️ Auto-generating ${exeFilename} from ${path.basename(dotSeparated)}...`);
      fs.copyFileSync(dotSeparated, primaryExePath);
      const dotBlockmap = `${dotSeparated}.blockmap`;
      if (fs.existsSync(dotBlockmap)) {
        fs.copyFileSync(dotBlockmap, `${primaryExePath}.blockmap`);
      }
    } else {
      console.error(`❌ Missing installer for version ${version} in release/ folder.`);
      process.exit(1);
    }
  }

  const actualSha = computeSha512(primaryExePath);
  if (expectedSha && actualSha !== expectedSha) {
    console.error(`❌ Hash mismatch for ${exeFilename}!\nExpected: ${expectedSha}\nActual:   ${actualSha}`);
    process.exit(1);
  }
  console.log(`✓ Verified ${exeFilename} (SHA-512 matches latest.yml)`);

  // Verify blockmap exists
  const blockmapName = `${exeFilename}.blockmap`;
  const blockmapPath = path.join(releaseDir, blockmapName);
  if (fs.existsSync(blockmapPath)) {
    console.log(`✓ Verified ${blockmapName} (Delta update blockmap present)`);
  } else {
    console.warn(`⚠️ Warning: ${blockmapName} not found. Delta patching will not be available.`);
  }

  // Create dot-notation alias (e.g. Albaqros.Setup.1.3.0.exe) if it differs
  const dotNotationName = `Albaqros.Setup.${version}.exe`;
  const dotNotationPath = path.join(releaseDir, dotNotationName);
  if (exeFilename !== dotNotationName) {
    try {
      if (!fs.existsSync(dotNotationPath)) {
        fs.copyFileSync(primaryExePath, dotNotationPath);
        console.log(`✓ Generated dot-notation alias: ${dotNotationName}`);
      } else {
        console.log(`✓ Verified dot-notation alias: ${dotNotationName}`);
      }
      const dotBlockmap = path.join(releaseDir, `${dotNotationName}.blockmap`);
      if (fs.existsSync(blockmapPath) && !fs.existsSync(dotBlockmap)) {
        fs.copyFileSync(blockmapPath, dotBlockmap);
        console.log(`✓ Generated dot-notation blockmap: ${dotNotationName}.blockmap`);
      }
    } catch (err) {
      console.warn(`⚠️ Could not create dot-notation alias: ${err.message}`);
    }
  }

  console.log(`\n📦 Ready for GitHub Release v${version}:`);
  console.log(`  1. ${exeFilename} (REQUIRED: In-app auto-patcher downloads this)`);
  if (fs.existsSync(blockmapPath)) console.log(`  2. ${blockmapName} (REQUIRED: For delta updates)`);
  console.log(`  3. latest.yml (REQUIRED: Manifest file for updater)`);
  if (exeFilename !== dotNotationName && fs.existsSync(dotNotationPath)) {
    console.log(`  4. ${dotNotationName} (Convenience standalone installer)`);
  }
  console.log(`==================================================\n`);
}

run();
