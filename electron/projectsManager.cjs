const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { shell, dialog } = require('electron');
const { extractThumbnail } = require('./thumbnailExtractor.cjs');
const { renderBlenderAssetPreview, findBlenderExecutable } = require('./blenderAssetRenderer.cjs');

const PROJECTS_DIR_NAME = 'projects';
const PROJECTS_META_FILENAME = 'projects.json';

function getVaultProjectsDirectory(vaultDir) {
  const projectsDir = path.join(vaultDir, PROJECTS_DIR_NAME);
  if (!fs.existsSync(projectsDir)) {
    try {
      fs.mkdirSync(projectsDir, { recursive: true });
    } catch (e) {
      console.error('Error creating projects directory:', e);
    }
  }
  const previewsDir = path.join(projectsDir, '.previews');
  if (!fs.existsSync(previewsDir)) {
    try {
      fs.mkdirSync(previewsDir, { recursive: true });
    } catch (e) {}
  }
  return projectsDir;
}

function loadVaultProjectsMetadata(projectsDir) {
  const metaPath = path.join(projectsDir, PROJECTS_META_FILENAME);
  if (fs.existsSync(metaPath)) {
    try {
      const raw = fs.readFileSync(metaPath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error reading projects.json:', e);
    }
  }
  return [];
}

function saveVaultProjectsMetadata(projectsDir, projects) {
  const metaPath = path.join(projectsDir, PROJECTS_META_FILENAME);
  try {
    fs.writeFileSync(metaPath, JSON.stringify(projects, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving projects.json:', e);
  }
}

/**
 * Calculates project size and file count on disk.
 */
function calculateProjectStats(projectDir) {
  let totalSizeBytes = 0;
  let fileCount = 0;
  let folderCount = 0;
  let hasGit = false;

  function walk(current) {
    if (!fs.existsSync(current)) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === '.git') {
          hasGit = true;
          continue; // skip walking deep into git packfiles for performance
        }
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          folderCount++;
          // Skip enormous cache folders when deep walking to stay fast, but count folder
          if (entry.name === '.godot' || entry.name === 'node_modules' || entry.name === '__pycache__') {
            try {
              // Add top-level size
              const s = fs.statSync(full);
              totalSizeBytes += s.size;
            } catch (_) {}
            continue;
          }
          walk(full);
        } else if (entry.isFile()) {
          fileCount++;
          try {
            const s = fs.statSync(full);
            totalSizeBytes += s.size;
          } catch (_) {}
        }
      }
    } catch (e) {}
  }

  walk(projectDir);
  return { totalSizeBytes, fileCount, folderCount, hasGit };
}

/**
 * Detects the engine/type of the project and parses primary files & dependencies.
 */
function inspectProject(projectDir) {
  let type = 'custom';
  let primaryFile = '';
  let engineVersion = '';
  let dependencies = [];

  if (!fs.existsSync(projectDir)) {
    return { type, primaryFile, engineVersion, dependencies };
  }

  // 1. Check for Godot
  const godotProjectFile = path.join(projectDir, 'project.godot');
  if (fs.existsSync(godotProjectFile)) {
    type = 'godot';
    primaryFile = 'project.godot';
    engineVersion = 'Godot Engine';

    try {
      const godotContent = fs.readFileSync(godotProjectFile, 'utf8');
      if (godotContent.includes('config/features=PackedStringArray("4.')) {
        const match = godotContent.match(/config\/features=PackedStringArray\("([^"]+)"/);
        if (match) {
          engineVersion = `Godot ${match[1]}`;
        } else {
          engineVersion = 'Godot 4.x';
        }
      } else if (godotContent.includes('config_version=4')) {
        engineVersion = 'Godot 3.x';
      }
    } catch (_) {}

    // Scan addons directory for Godot plugins/addons
    const addonsDir = path.join(projectDir, 'addons');
    if (fs.existsSync(addonsDir)) {
      try {
        const addonEntries = fs.readdirSync(addonsDir, { withFileTypes: true });
        for (const addon of addonEntries) {
          if (addon.isDirectory()) {
            let addonVersion = '';
            let addonDesc = '';
            const pluginCfg = path.join(addonsDir, addon.name, 'plugin.cfg');
            if (fs.existsSync(pluginCfg)) {
              try {
                const cfg = fs.readFileSync(pluginCfg, 'utf8');
                const vMatch = cfg.match(/version="([^"]+)"/);
                if (vMatch) addonVersion = vMatch[1];
                const dMatch = cfg.match(/description="([^"]+)"/);
                if (dMatch) addonDesc = dMatch[1];
              } catch (_) {}
            }
            dependencies.push({
              name: addon.name,
              type: 'addon',
              version: addonVersion,
              path: `addons/${addon.name}`,
              description: addonDesc || 'Godot Addon / Plugin',
            });
          }
        }
      } catch (_) {}
    }

    return { type, primaryFile, engineVersion, dependencies };
  }

  // 2. Check for Blender project
  const blendFiles = [];
  try {
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.blend')) {
        blendFiles.push(entry.name);
      }
    }
  } catch (_) {}

  if (blendFiles.length > 0) {
    type = 'blender';
    engineVersion = 'Blender';
    // Prioritize main.blend, scene.blend, project.blend, or first blend file
    const preferred = blendFiles.find((f) => ['main.blend', 'scene.blend', 'project.blend'].includes(f.toLowerCase()));
    primaryFile = preferred || blendFiles[0];

    // Check for textures or assets folders as dependencies
    const texturesDir = path.join(projectDir, 'textures');
    if (fs.existsSync(texturesDir)) {
      dependencies.push({
        name: 'Textures & Shaders',
        type: 'asset',
        path: 'textures',
        description: 'Project texture dependencies',
      });
    }
    const modelsDir = path.join(projectDir, 'models');
    if (fs.existsSync(modelsDir)) {
      dependencies.push({
        name: 'Linked 3D Assets',
        type: 'asset',
        path: 'models',
        description: 'External linked models',
      });
    }

    return { type, primaryFile, engineVersion, dependencies };
  }

  // 3. Check for Unity
  const unitySettings = path.join(projectDir, 'ProjectSettings', 'ProjectVersion.txt');
  if (fs.existsSync(unitySettings)) {
    type = 'unity';
    engineVersion = 'Unity';
    try {
      const vText = fs.readFileSync(unitySettings, 'utf8');
      const match = vText.match(/m_EditorVersion:\s*([^\r\n]+)/);
      if (match) engineVersion = `Unity ${match[1]}`;
    } catch (_) {}
    primaryFile = 'Assets';
    return { type, primaryFile, engineVersion, dependencies };
  }

  // 4. Check for Unreal Engine
  try {
    const entries = fs.readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.uproject')) {
        type = 'unreal';
        primaryFile = entry.name;
        engineVersion = 'Unreal Engine';
        try {
          const uRaw = fs.readFileSync(path.join(projectDir, entry.name), 'utf8');
          const uJson = JSON.parse(uRaw);
          if (uJson.EngineAssociation) {
            engineVersion = `Unreal Engine ${uJson.EngineAssociation}`;
          }
        } catch (_) {}
        return { type, primaryFile, engineVersion, dependencies };
      }
    }
  } catch (_) {}

  // 5. Check for Web / Node.js
  const pkgJsonPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    type = 'web';
    primaryFile = 'package.json';
    engineVersion = 'Node.js / Web';
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.dependencies) {
        for (const [depName, version] of Object.entries(pkg.dependencies)) {
          dependencies.push({
            name: depName,
            type: 'package',
            version: String(version),
            description: 'NPM dependency',
          });
        }
      }
      if (pkg.devDependencies) {
        for (const [depName, version] of Object.entries(pkg.devDependencies)) {
          dependencies.push({
            name: depName,
            type: 'package',
            version: String(version),
            description: 'Dev dependency',
          });
        }
      }
    } catch (_) {}
    return { type, primaryFile, engineVersion, dependencies };
  }

  // 6. Check for Python
  const reqTxt = path.join(projectDir, 'requirements.txt');
  const pyProject = path.join(projectDir, 'pyproject.toml');
  const mainPy = path.join(projectDir, 'main.py');
  if (fs.existsSync(reqTxt) || fs.existsSync(pyProject) || fs.existsSync(mainPy)) {
    type = 'python';
    primaryFile = fs.existsSync(mainPy) ? 'main.py' : (fs.existsSync(reqTxt) ? 'requirements.txt' : 'pyproject.toml');
    engineVersion = 'Python';
    if (fs.existsSync(reqTxt)) {
      try {
        const lines = fs.readFileSync(reqTxt, 'utf8').split('\n');
        for (const l of lines) {
          const clean = l.trim();
          if (clean && !clean.startsWith('#')) {
            dependencies.push({
              name: clean,
              type: 'package',
              description: 'Pip requirement',
            });
          }
        }
      } catch (_) {}
    }
    return { type, primaryFile, engineVersion, dependencies };
  }

  return { type, primaryFile, engineVersion, dependencies };
}

/**
 * Extracts or loads preview icon/thumbnail for the project.
 */
async function extractProjectPreview(projectDir, type, primaryFile, previewsDir, projectId) {
  try {
    // 1. Godot: check for icon.svg or icon.png
    if (type === 'godot') {
      const svgIcon = path.join(projectDir, 'icon.svg');
      if (fs.existsSync(svgIcon)) {
        try {
          const svgContent = fs.readFileSync(svgIcon, 'utf8');
          const base64 = Buffer.from(svgContent).toString('base64');
          return `data:image/svg+xml;base64,${base64}`;
        } catch (_) {}
      }
      const pngIcon = path.join(projectDir, 'icon.png');
      if (fs.existsSync(pngIcon)) {
        try {
          const buf = fs.readFileSync(pngIcon);
          return `data:image/png;base64,${buf.toString('base64')}`;
        } catch (_) {}
      }
    }

    // 2. Blender: render or extract thumbnail of primary .blend file
    if (type === 'blender' && primaryFile) {
      const blendFilePath = path.join(projectDir, primaryFile);
      if (fs.existsSync(blendFilePath)) {
        const previewPngPath = path.join(previewsDir, `${projectId}.png`);
        try {
          const renderRes = await renderBlenderAssetPreview(blendFilePath, previewPngPath);
          if (renderRes.success && renderRes.dataUrl) {
            return renderRes.dataUrl;
          }
        } catch (_) {}

        try {
          const fallback = await extractThumbnail(blendFilePath);
          if (fallback) return fallback;
        } catch (_) {}
      }
    }

    // 3. Check for generic cover/icon images in project root
    const coverCandidates = [
      'cover.png', 'cover.jpg', 'cover.webp',
      'thumbnail.png', 'thumbnail.jpg',
      'preview.png', 'preview.jpg',
      'icon.png', 'icon.svg', 'logo.png', 'logo.svg'
    ];
    for (const cand of coverCandidates) {
      const candPath = path.join(projectDir, cand);
      if (fs.existsSync(candPath)) {
        try {
          const ext = path.extname(cand).toLowerCase();
          const buf = fs.readFileSync(candPath);
          const mime = ext === '.svg' ? 'image/svg+xml' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : (ext === '.webp' ? 'image/webp' : 'image/png'));
          return `data:${mime};base64,${buf.toString('base64')}`;
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('Error extracting preview for project:', err.message);
  }

  return '';
}

/**
 * Lists projects in the vault.
 * Re-anchors all paths to the current machine's active vault directory,
 * ensuring 100% portability when moving between computers/drives.
 */
async function listProjects(vaultDir) {
  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const previewsDir = path.join(projectsDir, '.previews');
  let projects = loadVaultProjectsMetadata(projectsDir);
  if (!Array.isArray(projects)) projects = [];

  let hasChanges = false;
  const existingSlugs = new Set();

  // Scan disk for existing project folders in vault/projects/
  let diskFolders = [];
  try {
    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // ignore .previews, .git
      if (entry.isDirectory()) {
        diskFolders.push(entry.name);
      }
    }
  } catch (e) {
    console.error('Error scanning projects directory:', e);
  }

  // 1. Re-anchor existing projects and refresh missing info
  for (const proj of projects) {
    // Slug is the relative folder name inside vault/projects/
    const slug = proj.slug || path.basename(proj.path || proj.name);
    proj.slug = slug;
    existingSlugs.add(slug.toLowerCase());

    const expectedDiskPath = path.join(projectsDir, slug);
    // Dynamic re-anchoring: always point to the current machine's vault location!
    proj.path = expectedDiskPath;
    proj.relativePath = slug;
    proj.isInsideVault = true;

    if (fs.existsSync(expectedDiskPath)) {
      const stats = calculateProjectStats(expectedDiskPath);
      proj.totalSizeBytes = stats.totalSizeBytes;
      proj.fileCount = stats.fileCount;
      proj.folderCount = stats.folderCount;
      proj.hasGit = stats.hasGit;

      // If missing type or dependencies, inspect
      if (!proj.type || proj.type === 'custom' || !proj.primaryFile) {
        const insp = inspectProject(expectedDiskPath);
        if (insp.type !== 'custom') {
          proj.type = insp.type;
          proj.primaryFile = insp.primaryFile;
          proj.engineVersion = insp.engineVersion;
          proj.dependencies = insp.dependencies;
          hasChanges = true;
        }
      }

      // Check preview if empty
      if (!proj.previewUrl) {
        const pUrl = await extractProjectPreview(expectedDiskPath, proj.type, proj.primaryFile, previewsDir, proj.id);
        if (pUrl) {
          proj.previewUrl = pUrl;
          hasChanges = true;
        }
      }
    }
  }

  // 2. Auto-register any new folders found on disk that aren't indexed yet
  for (const folderName of diskFolders) {
    if (!existingSlugs.has(folderName.toLowerCase())) {
      const folderPath = path.join(projectsDir, folderName);
      const insp = inspectProject(folderPath);
      const stats = calculateProjectStats(folderPath);
      const id = 'proj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

      const previewUrl = await extractProjectPreview(folderPath, insp.type, insp.primaryFile, previewsDir, id);

      const newProject = {
        id,
        name: folderName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        slug: folderName,
        type: insp.type,
        path: folderPath,
        relativePath: folderName,
        isInsideVault: true,
        primaryFile: insp.primaryFile,
        previewUrl: previewUrl || '',
        totalSizeBytes: stats.totalSizeBytes,
        fileCount: stats.fileCount,
        folderCount: stats.folderCount,
        category: insp.type === 'godot' || insp.type === 'unity' || insp.type === 'unreal' ? 'Game Dev' : (insp.type === 'blender' ? '3D Art & Animation' : 'Tools & Software'),
        tags: [`#${insp.type}`],
        status: 'active',
        engineVersion: insp.engineVersion,
        hasGit: stats.hasGit,
        dependencies: insp.dependencies,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      projects.unshift(newProject);
      existingSlugs.add(folderName.toLowerCase());
      hasChanges = true;
    }
  }

  if (hasChanges) {
    saveVaultProjectsMetadata(projectsDir, projects);
  }

  return { success: true, projects, projectsDir };
}

/**
 * Imports an existing project folder from disk into the vault.
 * Copies all files and dependencies so that the project is completely portable.
 */
async function importProjectFolder(vaultDir, { sourcePath, name, category, tags, notes, copyToVault = true }) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return { success: false, error: 'Source directory does not exist: ' + sourcePath };
  }

  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const previewsDir = path.join(projectsDir, '.previews');
  const baseName = (name || path.basename(sourcePath)).replace(/[\\/:*?"<>|]/g, '').trim();

  let slug = baseName.toLowerCase().replace(/\s+/g, '-');
  let targetDir = path.join(projectsDir, slug);

  let counter = 1;
  while (fs.existsSync(targetDir) && path.normalize(targetDir).toLowerCase() !== path.normalize(sourcePath).toLowerCase()) {
    slug = `${baseName.toLowerCase().replace(/\s+/g, '-')}-${counter}`;
    targetDir = path.join(projectsDir, slug);
    counter++;
  }

  // Copy whole project tree into vault
  if (copyToVault && path.normalize(targetDir).toLowerCase() !== path.normalize(sourcePath).toLowerCase()) {
    try {
      fs.cpSync(sourcePath, targetDir, { recursive: true });
    } catch (err) {
      console.error('Failed to copy project folder:', err);
      return { success: false, error: 'Failed to copy project files: ' + err.message };
    }
  } else if (!copyToVault) {
    // If user opts not to copy, use sourcePath directly
    targetDir = sourcePath;
  }

  const insp = inspectProject(targetDir);
  const stats = calculateProjectStats(targetDir);
  const id = 'proj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const previewUrl = await extractProjectPreview(targetDir, insp.type, insp.primaryFile, previewsDir, id);

  const newProject = {
    id,
    name: baseName,
    slug: path.basename(targetDir),
    type: insp.type,
    path: targetDir,
    relativePath: path.relative(projectsDir, targetDir).replace(/\\/g, '/'),
    isInsideVault: copyToVault,
    primaryFile: insp.primaryFile,
    previewUrl: previewUrl || '',
    totalSizeBytes: stats.totalSizeBytes,
    fileCount: stats.fileCount,
    folderCount: stats.folderCount,
    category: category || (insp.type === 'godot' ? 'Game Dev' : (insp.type === 'blender' ? '3D Art & Animation' : 'Tools & Software')),
    tags: tags || [`#${insp.type}`],
    status: 'active',
    engineVersion: insp.engineVersion,
    hasGit: stats.hasGit,
    dependencies: insp.dependencies,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const projects = loadVaultProjectsMetadata(projectsDir);
  projects.unshift(newProject);
  saveVaultProjectsMetadata(projectsDir, projects);

  return { success: true, project: newProject };
}

/**
 * Creates a brand new project scaffold directly inside the vault.
 */
async function createProjectScaffold(vaultDir, { name, type, category, tags, notes }) {
  if (!name || !name.trim()) {
    return { success: false, error: 'Project name is required' };
  }

  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const baseName = name.trim().replace(/[\\/:*?"<>|]/g, '');
  let slug = baseName.toLowerCase().replace(/\s+/g, '-');
  let targetDir = path.join(projectsDir, slug);

  let counter = 1;
  while (fs.existsSync(targetDir)) {
    slug = `${baseName.toLowerCase().replace(/\s+/g, '-')}-${counter}`;
    targetDir = path.join(projectsDir, slug);
    counter++;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  let primaryFile = '';
  let engineVersion = '';
  let previewUrl = '';
  const dependencies = [];

  // Scaffolding templates
  if (type === 'godot') {
    primaryFile = 'project.godot';
    engineVersion = 'Godot 4.3';
    const godotConfig = [
      '; Engine configuration file.',
      '; It\'s best edited using the editor UI and not directly,',
      '; since the parameters that go here are not all obvious.',
      '',
      'config_version=5',
      '',
      '[application]',
      '',
      `config/name="${baseName}"`,
      'config/features=PackedStringArray("4.3", "Forward Plus")',
      'config/icon="res://icon.svg"',
      '',
      '[dotnet]',
      '',
      'project/assembly_name="' + baseName + '"',
    ].join('\n');
    fs.writeFileSync(path.join(targetDir, 'project.godot'), godotConfig, 'utf8');

    // Default Godot SVG Icon
    const godotSvg = `<svg height="128" width="128" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" rx="28" fill="#478cbf"/><path d="M64 24c-15.4 0-28 12.6-28 28v4H24v12h12v12h-8v12h8v8c0 13.2 10.8 24 24 24h8c13.2 0 24-10.8 24-24v-8h8V80h-8V68h12V56H92v-4c0-15.4-12.6-28-28-28zm-16 48a8 8 0 110 16 8 8 0 010-16zm32 0a8 8 0 110 16 8 8 0 010-16z" fill="#ffffff"/></svg>`;
    fs.writeFileSync(path.join(targetDir, 'icon.svg'), godotSvg, 'utf8');
    previewUrl = `data:image/svg+xml;base64,${Buffer.from(godotSvg).toString('base64')}`;

    // Starter folders
    fs.mkdirSync(path.join(targetDir, 'scenes'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'addons'), { recursive: true });

    // .gitignore
    const gitignore = ['.godot/', '*.translation', '*.tmp'].join('\n');
    fs.writeFileSync(path.join(targetDir, '.gitignore'), gitignore, 'utf8');
  } else if (type === 'blender') {
    primaryFile = 'scenes/main.blend';
    engineVersion = 'Blender 4.x';
    fs.mkdirSync(path.join(targetDir, 'scenes'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'textures'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'references'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'renders'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'cache'), { recursive: true });

    dependencies.push({
      name: 'textures',
      type: 'asset',
      path: 'textures',
      description: 'Project texture folder',
    });
  } else if (type === 'web') {
    primaryFile = 'package.json';
    engineVersion = 'Node.js / Web';
    const pkg = {
      name: slug,
      version: '0.1.0',
      private: true,
      description: notes || `${baseName} workspace`,
      scripts: {
        dev: 'vite',
        build: 'vite build',
      },
    };
    fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf8');
    fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'src', 'index.js'), '// ' + baseName + ' entry point\nconsole.log("Initialized ' + baseName + '");\n', 'utf8');
  } else if (type === 'python') {
    primaryFile = 'main.py';
    engineVersion = 'Python 3.x';
    fs.writeFileSync(path.join(targetDir, 'main.py'), `# ${baseName}\ndef main():\n    print("Hello from ${baseName}!")\n\nif __name__ == "__main__":\n    main()\n`, 'utf8');
    fs.writeFileSync(path.join(targetDir, 'requirements.txt'), '# Add project dependencies here\n', 'utf8');
  }

  // Common README.md
  const readmeContent = [
    `# ${baseName}`,
    '',
    notes || `Project created and managed in Albaqros.`,
    '',
    `## Details`,
    `- **Type**: ${type || 'Custom'}`,
    `- **Created**: ${new Date().toLocaleDateString()}`,
    `- **Storage**: Albaqros Vault (Portable)`,
  ].join('\n');
  fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf8');

  const stats = calculateProjectStats(targetDir);
  const id = 'proj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

  const newProject = {
    id,
    name: baseName,
    slug,
    type: type || 'custom',
    path: targetDir,
    relativePath: slug,
    isInsideVault: true,
    primaryFile,
    previewUrl,
    totalSizeBytes: stats.totalSizeBytes,
    fileCount: stats.fileCount,
    folderCount: stats.folderCount,
    category: category || (type === 'godot' ? 'Game Dev' : (type === 'blender' ? '3D Art & Animation' : 'Tools & Software')),
    tags: tags || [`#${type}`],
    status: 'active',
    engineVersion,
    hasGit: false,
    dependencies,
    notes: notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const projects = loadVaultProjectsMetadata(projectsDir);
  projects.unshift(newProject);
  saveVaultProjectsMetadata(projectsDir, projects);

  return { success: true, project: newProject };
}

/**
 * Updates project metadata (tags, notes, status, category, name).
 */
function updateProject(vaultDir, updatedData) {
  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const projects = loadVaultProjectsMetadata(projectsDir);
  const idx = projects.findIndex((p) => p.id === updatedData.id);

  if (idx === -1) {
    return { success: false, error: 'Project not found' };
  }

  const existing = projects[idx];
  const merged = {
    ...existing,
    ...updatedData,
    updatedAt: new Date().toISOString(),
  };

  projects[idx] = merged;
  saveVaultProjectsMetadata(projectsDir, projects);
  return { success: true, project: merged };
}

/**
 * Deletes a project from metadata, optionally removing the folder from disk.
 */
function deleteProject(vaultDir, { projectId, deleteFiles = false }) {
  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const projects = loadVaultProjectsMetadata(projectsDir);
  const target = projects.find((p) => p.id === projectId);

  if (!target) {
    return { success: false, error: 'Project not found' };
  }

  const filtered = projects.filter((p) => p.id !== projectId);
  saveVaultProjectsMetadata(projectsDir, filtered);

  if (deleteFiles && target.path && fs.existsSync(target.path)) {
    try {
      // Safety check: ensure target path is inside vault projects directory
      const normTarget = path.normalize(target.path).toLowerCase();
      const normProjectsDir = path.normalize(projectsDir).toLowerCase();
      if (normTarget.startsWith(normProjectsDir) && normTarget !== normProjectsDir) {
        fs.rmSync(target.path, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('Error deleting project files:', err);
      return { success: false, error: 'Removed from vault list, but failed to delete files: ' + err.message };
    }
  }

  return { success: true };
}

/**
 * Finds Godot executable on the user's system.
 */
function findGodotExecutable() {
  const possiblePaths = [
    'godot',
    'godot.exe',
    'C:\\Program Files\\Godot\\Godot_v4.3-stable_win64.exe',
    'C:\\Program Files\\Godot\\Godot_v4.2-stable_win64.exe',
    'C:\\Program Files\\Godot\\godot.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Godot', 'godot.exe'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Launches the project using the best available software.
 */
async function openProject(vaultDir, { projectId, openMethod = 'default' }) {
  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const projects = loadVaultProjectsMetadata(projectsDir);
  const project = projects.find((p) => p.id === projectId);

  if (!project) return { success: false, error: 'Project not found' };

  // Re-anchor path to ensure it matches current machine
  const projectPath = project.path && fs.existsSync(project.path)
    ? project.path
    : path.join(projectsDir, project.slug || project.name);

  if (!fs.existsSync(projectPath)) {
    return { success: false, error: 'Project directory not found on disk: ' + projectPath };
  }

  // Update lastOpenedAt
  project.lastOpenedAt = new Date().toISOString();
  saveVaultProjectsMetadata(projectsDir, projects);

  try {
    if (openMethod === 'explorer') {
      await shell.openPath(projectPath);
      return { success: true };
    }

    if (openMethod === 'terminal') {
      exec(`start powershell -NoExit -WorkingDirectory "${projectPath}"`, () => {});
      return { success: true };
    }

    if (openMethod === 'code') {
      exec(`code "${projectPath}"`, (err) => {
        if (err) {
          shell.openPath(projectPath);
        }
      });
      return { success: true };
    }

    // Default / Software specific
    if (project.type === 'godot') {
      const godotFile = path.join(projectPath, 'project.godot');
      const godotExe = findGodotExecutable();
      if (godotExe) {
        exec(`"${godotExe}" --path "${projectPath}" -e`, () => {});
        return { success: true };
      }
      if (fs.existsSync(godotFile)) {
        await shell.openPath(godotFile);
        return { success: true };
      }
    }

    if (project.type === 'blender') {
      const blendExe = findBlenderExecutable();
      const primaryBlend = project.primaryFile ? path.join(projectPath, project.primaryFile) : null;

      if (primaryBlend && fs.existsSync(primaryBlend)) {
        if (blendExe) {
          exec(`"${blendExe}" "${primaryBlend}"`, () => {});
          return { success: true };
        }
        await shell.openPath(primaryBlend);
        return { success: true };
      }
    }

    // Fallback: open with system default handler or folder
    if (project.primaryFile && fs.existsSync(path.join(projectPath, project.primaryFile))) {
      await shell.openPath(path.join(projectPath, project.primaryFile));
      return { success: true };
    }

    await shell.openPath(projectPath);
    return { success: true };
  } catch (err) {
    console.error('Error opening project:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Exports the entire project as a standalone ZIP archive for easy transfer/backup.
 */
async function exportProjectZip(vaultDir, projectId, destinationZipPath) {
  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const projects = loadVaultProjectsMetadata(projectsDir);
  const project = projects.find((p) => p.id === projectId);

  if (!project) return { success: false, error: 'Project not found' };

  const projectPath = project.path && fs.existsSync(project.path)
    ? project.path
    : path.join(projectsDir, project.slug || project.name);

  if (!fs.existsSync(projectPath)) {
    return { success: false, error: 'Project folder does not exist on disk' };
  }

  return new Promise((resolve) => {
    // PowerShell Compress-Archive command
    const psCommand = `powershell -NoProfile -Command "Compress-Archive -Path '${projectPath}\\*' -DestinationPath '${destinationZipPath}' -Force"`;

    exec(psCommand, { maxBuffer: 1024 * 1024 * 50 }, (error) => {
      if (error) {
        // Fallback: tar -czf on Windows 10/11
        exec(`tar -caf "${destinationZipPath}" -C "${projectPath}" .`, (tarErr) => {
          if (tarErr) {
            return resolve({ success: false, error: 'Failed to create zip archive: ' + error.message });
          }
          resolve({ success: true, zipPath: destinationZipPath });
        });
        return;
      }
      resolve({ success: true, zipPath: destinationZipPath });
    });
  });
}

/**
 * Imports a project from a ZIP file into the vault.
 */
async function importProjectZip(vaultDir, zipFilePath) {
  if (!zipFilePath || !fs.existsSync(zipFilePath)) {
    return { success: false, error: 'Zip file does not exist' };
  }

  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const baseName = path.basename(zipFilePath, path.extname(zipFilePath)).replace(/[\\/:*?"<>|]/g, '').trim();
  let slug = baseName.toLowerCase().replace(/\s+/g, '-');
  let targetDir = path.join(projectsDir, slug);

  let counter = 1;
  while (fs.existsSync(targetDir)) {
    slug = `${baseName.toLowerCase().replace(/\s+/g, '-')}-${counter}`;
    targetDir = path.join(projectsDir, slug);
    counter++;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  return new Promise((resolve) => {
    const psCommand = `powershell -NoProfile -Command "Expand-Archive -Path '${zipFilePath}' -DestinationPath '${targetDir}' -Force"`;

    exec(psCommand, { maxBuffer: 1024 * 1024 * 50 }, async (error) => {
      if (error) {
        // Fallback: tar -xf
        exec(`tar -xf "${zipFilePath}" -C "${targetDir}"`, async (tarErr) => {
          if (tarErr) {
            return resolve({ success: false, error: 'Failed to extract zip archive: ' + error.message });
          }
          await finalizeImport();
        });
        return;
      }
      await finalizeImport();
    });

    async function finalizeImport() {
      const insp = inspectProject(targetDir);
      const stats = calculateProjectStats(targetDir);
      const previewsDir = path.join(projectsDir, '.previews');
      const id = 'proj-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const previewUrl = await extractProjectPreview(targetDir, insp.type, insp.primaryFile, previewsDir, id);

      const newProject = {
        id,
        name: baseName,
        slug,
        type: insp.type,
        path: targetDir,
        relativePath: slug,
        isInsideVault: true,
        primaryFile: insp.primaryFile,
        previewUrl: previewUrl || '',
        totalSizeBytes: stats.totalSizeBytes,
        fileCount: stats.fileCount,
        folderCount: stats.folderCount,
        category: insp.type === 'godot' ? 'Game Dev' : (insp.type === 'blender' ? '3D Art & Animation' : 'Tools & Software'),
        tags: [`#${insp.type}`],
        status: 'active',
        engineVersion: insp.engineVersion,
        hasGit: stats.hasGit,
        dependencies: insp.dependencies,
        notes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const projects = loadVaultProjectsMetadata(projectsDir);
      projects.unshift(newProject);
      saveVaultProjectsMetadata(projectsDir, projects);

      resolve({ success: true, project: newProject });
    }
  });
}

/**
 * Lists the directory files and subfolders of a project for the in-app explorer.
 */
function listProjectFiles(vaultDir, projectId, subpath = '') {
  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const projects = loadVaultProjectsMetadata(projectsDir);
  const project = projects.find((p) => p.id === projectId);

  if (!project) return { success: false, error: 'Project not found', files: [] };

  const projectRoot = project.path && fs.existsSync(project.path)
    ? project.path
    : path.join(projectsDir, project.slug || project.name);

  const targetDir = subpath ? path.join(projectRoot, subpath) : projectRoot;

  if (!fs.existsSync(targetDir)) {
    return { success: false, error: 'Directory does not exist', files: [] };
  }

  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (entry.name === '.git') continue;
      const full = path.join(targetDir, entry.name);
      const rel = path.relative(projectRoot, full).replace(/\\/g, '/');

      let sizeBytes = 0;
      if (entry.isFile()) {
        try {
          sizeBytes = fs.statSync(full).size;
        } catch (_) {}
      }

      files.push({
        name: entry.name,
        relativePath: rel,
        isDirectory: entry.isDirectory(),
        sizeBytes,
        extension: path.extname(entry.name).toLowerCase(),
      });
    }

    // Sort folders first, then files alphabetically
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return { success: true, files, currentSubpath: subpath };
  } catch (err) {
    return { success: false, error: err.message, files: [] };
  }
}

/**
 * Reads a text file within a project.
 */
function readProjectFile(vaultDir, projectId, relativeFilePath) {
  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const projects = loadVaultProjectsMetadata(projectsDir);
  const project = projects.find((p) => p.id === projectId);

  if (!project) return { success: false, error: 'Project not found' };

  const projectRoot = project.path && fs.existsSync(project.path)
    ? project.path
    : path.join(projectsDir, project.slug || project.name);

  const safePath = path.normalize(path.join(projectRoot, relativeFilePath));

  // Security check
  if (!safePath.toLowerCase().startsWith(projectRoot.toLowerCase())) {
    return { success: false, error: 'Access denied: path traversal' };
  }

  if (!fs.existsSync(safePath)) {
    return { success: false, error: 'File does not exist: ' + relativeFilePath };
  }

  try {
    const stats = fs.statSync(safePath);
    if (stats.size > 2 * 1024 * 1024) {
      return { success: false, error: 'File is too large for text preview (>2MB)' };
    }
    const content = fs.readFileSync(safePath, 'utf8');
    return { success: true, content, size: stats.size };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Saves content to a file inside a project.
 */
function saveProjectFile(vaultDir, projectId, relativeFilePath, content) {
  const projectsDir = getVaultProjectsDirectory(vaultDir);
  const projects = loadVaultProjectsMetadata(projectsDir);
  const project = projects.find((p) => p.id === projectId);

  if (!project) return { success: false, error: 'Project not found' };

  const projectRoot = project.path && fs.existsSync(project.path)
    ? project.path
    : path.join(projectsDir, project.slug || project.name);

  const safePath = path.normalize(path.join(projectRoot, relativeFilePath));

  if (!safePath.toLowerCase().startsWith(projectRoot.toLowerCase())) {
    return { success: false, error: 'Access denied: path traversal' };
  }

  try {
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(safePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  getVaultProjectsDirectory,
  listProjects,
  importProjectFolder,
  createProjectScaffold,
  updateProject,
  deleteProject,
  openProject,
  exportProjectZip,
  importProjectZip,
  listProjectFiles,
  readProjectFile,
  saveProjectFile,
  findGodotExecutable,
};
