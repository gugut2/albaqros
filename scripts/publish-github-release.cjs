const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

function getGitHubToken() {
  try {
    const input = 'protocol=https\nhost=github.com\n\n';
    const out = execSync('git credential fill', { input, encoding: 'utf8' });
    const lines = out.split('\n');
    const passLine = lines.find((l) => l.startsWith('password='));
    if (passLine) {
      return passLine.replace('password=', '').trim();
    }
  } catch (err) {
    console.error('Failed to get token from git credential manager:', err.message);
  }
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
}

function requestJson(url, options, postData) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function uploadAsset(uploadUrl, filePath, token) {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);
    const u = new URL(uploadUrl.replace(/\{(\?.*)?\}$/, `?name=${encodeURIComponent(fileName)}`));

    const mimeType = fileName.endsWith('.exe')
      ? 'application/octet-stream'
      : fileName.endsWith('.yml')
      ? 'text/yaml'
      : 'application/octet-stream';

    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Albaqros-Release-Publisher',
        Authorization: `token ${token}`,
        'Content-Type': mimeType,
        'Content-Length': fileStats.size,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ fileName, size: fileStats.size, status: res.statusCode });
        } else {
          reject(new Error(`Failed to upload ${fileName} (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', reject);

    const stream = fs.createReadStream(filePath);
    stream.pipe(req);
  });
}

async function main() {
  const pkgPath = path.resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version || '1.6.0';
  const tag = `v${version}`;
  const owner = 'gugut2';
  const repo = 'albaqros';

  console.log(`\n==================================================`);
  console.log(`🚀 Publishing GitHub Release ${tag}`);
  console.log(`==================================================`);

  const token = getGitHubToken();
  if (!token) {
    console.error('❌ Could not obtain GitHub token.');
    process.exit(1);
  }

  const releaseTitle = `Albaqros v${version} - Detached Floating Note Windows & Multi-Tab Multitasking`;
  const releaseNotes = `## What's New in Albaqros v${version} 🦅

### 🪟 Detached Floating Note Windows
- **Pop Out Any Note into its Own Window**:
  - Pop out any note into an independent, frameless desktop window from either the note editor toolbar (**Pop Out**) or directly from the Knowledge & Notes sidebar.
  - Work across multiple Albaqros tabs simultaneously—keep your popped-out note open while exploring the **Canvas**, organizing **3D Assets**, reviewing **2D Art**, or checking daily **Tasks**.
- **Always on Top Pin**:
  - Pin the floating note to keep it visible on top of all applications (Blender, Krita, Photoshop, IDE, browser).
- **Full Live Markdown Editor**:
  - Retains all live formatting, nested sub-bullet indentation (\`Tab\` / \`Shift+Tab\`), \`[[\` autocomplete popup, tags, and character/word stats in the detached window.
- **Dock Back to Albaqros (\`Ctrl+Shift+D\`)**:
  - Seamlessly dock the note back into the main Albaqros window with one click or hotkey.
  - Auto-flushes any unsaved edits, closes the floating window, brings Albaqros to the foreground in Maximized Studio mode on the Notes tab, and focuses the note.
- **Instant Multi-Window Synchronization**:
  - Changes made in either window immediately persist to disk and broadcast across all open windows.
  - Renaming, deleting, or editing notes reflects live across every window.

---

### 📥 Downloads & Assets
- **Windows Installer**: [Albaqros-Setup-${version}.exe](https://github.com/${owner}/${repo}/releases/download/${tag}/Albaqros-Setup-${version}.exe)
- **Direct Installer Link**: [Albaqros.Setup.${version}.exe](https://github.com/${owner}/${repo}/releases/download/${tag}/Albaqros.Setup.${version}.exe)
`;

  // 1. Check if release already exists
  console.log(`Checking existing release for ${tag}...`);
  const existingRes = await requestJson(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`,
    {
      headers: {
        'User-Agent': 'Albaqros-Release-Publisher',
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  let releaseData = null;
  if (existingRes.status === 200 && existingRes.data && existingRes.data.id) {
    console.log(`ℹ️ Release for ${tag} already exists (id: ${existingRes.data.id}). Updating metadata...`);
    const updateRes = await requestJson(
      `https://api.github.com/repos/${owner}/${repo}/releases/${existingRes.data.id}`,
      {
        method: 'PATCH',
        headers: {
          'User-Agent': 'Albaqros-Release-Publisher',
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
      {
        tag_name: tag,
        name: releaseTitle,
        body: releaseNotes,
        draft: false,
        prerelease: false,
      }
    );
    releaseData = updateRes.data;
  } else {
    console.log(`Creating new release ${tag}...`);
    const createRes = await requestJson(
      `https://api.github.com/repos/${owner}/${repo}/releases`,
      {
        method: 'POST',
        headers: {
          'User-Agent': 'Albaqros-Release-Publisher',
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
      {
        tag_name: tag,
        name: releaseTitle,
        body: releaseNotes,
        draft: false,
        prerelease: false,
      }
    );

    if (createRes.status !== 201 && createRes.status !== 200) {
      console.error(`❌ Failed to create release (${createRes.status}):`, createRes.data || createRes.raw);
      process.exit(1);
    }
    releaseData = createRes.data;
    console.log(`✓ Created release ${releaseData.name} (id: ${releaseData.id})`);
  }

  const releaseId = releaseData.id;
  const uploadUrl = releaseData.upload_url;

  // 2. Upload Assets
  const releaseDir = path.resolve(__dirname, '..', 'release');
  const filesToUpload = [
    `Albaqros-Setup-${version}.exe`,
    `Albaqros-Setup-${version}.exe.blockmap`,
    'latest.yml',
    `Albaqros.Setup.${version}.exe`,
    `Albaqros.Setup.${version}.exe.blockmap`,
  ];

  // Delete existing assets if they match so we can upload freshly built ones
  if (Array.isArray(releaseData.assets) && releaseData.assets.length > 0) {
    for (const asset of releaseData.assets) {
      if (filesToUpload.includes(asset.name)) {
        console.log(`Deleting existing asset ${asset.name} (id: ${asset.id})...`);
        await requestJson(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${asset.id}`, {
          method: 'DELETE',
          headers: {
            'User-Agent': 'Albaqros-Release-Publisher',
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
          },
        });
      }
    }
  }

  console.log(`\nUploading ${filesToUpload.length} assets to GitHub release...`);
  for (const fileName of filesToUpload) {
    const fullPath = path.join(releaseDir, fileName);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ File not found, skipping: ${fileName}`);
      continue;
    }
    process.stdout.write(`  Uploading ${fileName} (${(fs.statSync(fullPath).size / 1024 / 1024).toFixed(2)} MB)... `);
    try {
      await uploadAsset(uploadUrl, fullPath, token);
      console.log(`✓ DONE`);
    } catch (err) {
      console.error(`❌ ERROR:`, err.message);
      process.exit(1);
    }
  }

  console.log(`\n🎉 Release v${version} successfully published on GitHub!`);
  console.log(`🔗 URL: ${releaseData.html_url}`);
  console.log(`==================================================\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
