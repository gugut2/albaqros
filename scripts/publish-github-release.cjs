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

  const releaseTitle = `Albaqros v${version} - Global Drag-and-Drop Router, Project Pausing & Default Window Mode`;
  const releaseNotes = `## What's New in Albaqros v${version} 🦅

### 🎯 Global Drag-and-Drop Asset Router
- **Drag-and-Drop Anywhere**:
  - Drag and drop 3D assets (\`.blend\`, \`.obj\`, \`.fbx\`, \`.gltf\`, \`.glb\`) or 2D artwork & textures (\`.kra\`, \`.psd\`, \`.png\`, \`.jpg\`, \`.webp\`, etc.) anywhere on Albaqros to automatically route and save them into the correct studio library.
- **Glass Drop Overlay & Live Progress**:
  - Displays a responsive dropzone with file type detection, real-time import progress notifications, and 1-click navigation buttons directly to the target library.

### ⏸️ Project Pause & Resume Controls
- **Pause Major Projects / Goals**:
  - Put major goals and their linked tasks on pause with one click.
  - Paused projects suppress linked daily tasks from cluttering the daily focus checklist, carryover rollovers, and history views until resumed.
  - Project cadence displays clear \`⏸️ Project Paused\` status badges instead of false overdue warnings.
  - Dedicated filter bar in the Major Goals view to view All, Active, Paused, or Completed projects.

### 🖥️ Main Window Default Version Selector
- **Configurable Startup Mode**:
  - Select whether Albaqros defaults to the compact floating side widget (420×680) or the maximized studio workspace (1240×840 centered) under Settings -> Desktop Behaviors.
  - Electron window creation directly applies the saved mode on boot, eliminating flickering or screen jumps.
  - Manual session toggles via the title bar switch views without overwriting your saved default preference.

### ⚡ Streamlined Focus & Analytics (Energy Evaluation Removed)
- **Simpler, Distraction-Free Daily Flow**:
  - Completely removed the redundant energy intensity ratings, mood dots, and energy distribution donut charts from tasks, notes, and analytics.
  - Task creation and daily headers are streamlined for immediate task capture.
  - Analytics view highlights **Current Streak**, **Total Completed Tasks**, **Completion Rate**, and full-width **Consistency by Life Facet**.

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
