import { CanvasData, CanvasDocument, CanvasMetadata } from '../types';

const FALLBACK_CANVAS_STORAGE_KEY = 'albaqros_canvas_data_v1';

const STARTER_CANVAS: CanvasData = {
  nodes: [
    {
      id: 'welcome-card',
      type: 'text',
      x: -260,
      y: -140,
      width: 360,
      height: 240,
      color: 'blue',
      text: '### 🎨 Welcome to Canvas!\n\nThis is your infinite visual workspace inspired by **Obsidian Canvas**.\n\n- 🖼️ Add images, scale & resize them\n- 📝 Type cards, notes & ideas\n- 🔗 Connect cards with arrows\n- 📁 Put them in folders just like notes',
    },
    {
      id: 'shortcuts-card',
      type: 'text',
      x: 220,
      y: -140,
      width: 340,
      height: 240,
      color: 'purple',
      text: '### ⚡ Quick Navigation\n\n- **Pan Canvas**: Hold `Space` + Drag or Middle Click\n- **Zoom Canvas**: Mouse Wheel or `+` / `-` buttons\n- **Scale & Resize**: Drag any card corner or edge\n- **Connect Arrows**: Drag from side dots to link cards',
    },
    {
      id: 'ideas-card',
      type: 'text',
      x: -30,
      y: 190,
      width: 320,
      height: 200,
      color: 'green',
      text: '### 💡 Infinite Uses\n\n- Moodboards & concept art\n- Project pipelines & mindmaps\n- Game design schematics\n- Brainstorming & study flows',
    },
  ],
  edges: [
    {
      id: 'edge-1',
      fromNode: 'welcome-card',
      fromSide: 'right',
      toNode: 'shortcuts-card',
      toSide: 'left',
      label: 'navigation',
    },
    {
      id: 'edge-2',
      fromNode: 'shortcuts-card',
      fromSide: 'bottom',
      toNode: 'ideas-card',
      toSide: 'top',
    },
  ],
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
};

function getFallbackCanvases(): Record<string, CanvasDocument> {
  try {
    const raw = localStorage.getItem(FALLBACK_CANVAS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const defaultStarter: CanvasDocument = {
    id: 'Welcome to Albaqros Canvas.canvas',
    title: 'Welcome to Albaqros Canvas',
    fileName: 'Welcome to Albaqros Canvas.canvas',
    relativePath: 'Welcome to Albaqros Canvas.canvas',
    folder: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodeCount: STARTER_CANVAS.nodes.length,
    data: STARTER_CANVAS,
  };
  return { [defaultStarter.id]: defaultStarter };
}

function saveFallbackCanvases(map: Record<string, CanvasDocument>) {
  try {
    localStorage.setItem(FALLBACK_CANVAS_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {}
}

export const CanvasService = {
  async listCanvases(): Promise<{
    success: boolean;
    canvases: CanvasMetadata[];
    folders?: string[];
    canvasDir?: string;
  }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.canvas?.listCanvases) {
      try {
        const res = await (window as any).electronAPI.canvas.listCanvases();
        if (res && res.success) {
          return {
            success: true,
            canvases: res.canvases || [],
            folders: res.folders || [],
            canvasDir: res.canvasDir,
          };
        }
      } catch (err) {
        console.error('Error listing canvases via Electron:', err);
      }
    }

    // Fallback
    const map = getFallbackCanvases();
    const canvases: CanvasMetadata[] = Object.values(map).map(({ data, ...meta }) => meta);
    const folders = Array.from(new Set(canvases.map((c) => c.folder).filter(Boolean) as string[])).sort();
    return { success: true, canvases, folders, canvasDir: 'LocalStorage (Dev Mode)' };
  },

  async readCanvas(relativePath: string): Promise<CanvasDocument | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.canvas?.readCanvas) {
      try {
        const res = await (window as any).electronAPI.canvas.readCanvas(relativePath);
        if (res && res.success) {
          const folder = relativePath.includes('/')
            ? relativePath.substring(0, relativePath.lastIndexOf('/'))
            : '';
          const title = (res.fileName || relativePath).replace(/\.(canvas|json)$/i, '');
          const nodeCount = Array.isArray(res.data?.nodes) ? res.data.nodes.length : 0;
          return {
            id: relativePath,
            title,
            fileName: res.fileName || relativePath.split('/').pop() || relativePath,
            relativePath,
            folder,
            data: res.data || { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
            updatedAt: res.updatedAt || new Date().toISOString(),
            createdAt: res.updatedAt || new Date().toISOString(),
            nodeCount,
          };
        }
      } catch (err) {
        console.error('Error reading canvas via Electron:', err);
      }
    }

    // Fallback
    const map = getFallbackCanvases();
    return map[relativePath] || null;
  },

  async writeCanvas(relativePath: string, data: CanvasData): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.canvas?.writeCanvas) {
      try {
        const res = await (window as any).electronAPI.canvas.writeCanvas(relativePath, data);
        if (res && res.success) return true;
      } catch (err) {
        console.warn('Electron IPC canvas-write unavailable, using fallback cache:', err);
      }
    }

    // Fallback
    const map = getFallbackCanvases();
    const existing = map[relativePath] || {
      id: relativePath,
      title: relativePath.replace(/\.(canvas|json)$/i, '').split('/').pop() || relativePath,
      fileName: relativePath.split('/').pop() || relativePath,
      relativePath,
      folder: relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodeCount: data.nodes.length,
      data,
    };

    map[relativePath] = {
      ...existing,
      updatedAt: new Date().toISOString(),
      nodeCount: data.nodes.length,
      data,
    };
    saveFallbackCanvases(map);
    return true;
  },

  async createCanvas(
    title: string,
    folder?: string,
    initialData?: CanvasData
  ): Promise<{ relativePath: string; fileName: string; data: CanvasData } | null> {
    const cleanTitle = (title || 'Untitled Canvas').replace(/[\\/:*?"<>|]/g, '').trim();
    const defaultData = initialData || {
      nodes: [
        {
          id: `card-${Date.now()}`,
          type: 'text',
          x: 0,
          y: 0,
          width: 300,
          height: 180,
          color: 'default',
          text: `## ${cleanTitle}\n\nStart brainstorming, adding images, and connecting thoughts!`,
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    if (typeof window !== 'undefined' && (window as any).electronAPI?.canvas?.createCanvas) {
      try {
        const res = await (window as any).electronAPI.canvas.createCanvas(cleanTitle, folder, defaultData);
        if (res && res.success) {
          return {
            relativePath: res.relativePath,
            fileName: res.fileName,
            data: res.data || defaultData,
          };
        }
      } catch (err) {
        console.error('Error creating canvas via Electron:', err);
      }
    }

    // Fallback
    const fileName = `${cleanTitle}.canvas`;
    const targetFolder = folder ? folder.trim().replace(/^[/\\]+|[/\\]+$/g, '') : '';
    const relPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    const map = getFallbackCanvases();
    map[relPath] = {
      id: relPath,
      title: cleanTitle,
      fileName,
      relativePath: relPath,
      folder: targetFolder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodeCount: defaultData.nodes.length,
      data: defaultData,
    };
    saveFallbackCanvases(map);
    return { relativePath: relPath, fileName, data: defaultData };
  },

  async deleteCanvas(relativePath: string): Promise<boolean> {
    let electronSuccess = false;
    if (typeof window !== 'undefined' && (window as any).electronAPI?.canvas?.deleteCanvas) {
      try {
        const res = await (window as any).electronAPI.canvas.deleteCanvas(relativePath);
        electronSuccess = Boolean(res && res.success);
      } catch (err) {
        console.error('Error deleting canvas via Electron:', err);
      }
    }

    const map = getFallbackCanvases();
    if (map[relativePath]) {
      delete map[relativePath];
      saveFallbackCanvases(map);
    }
    return electronSuccess || Boolean(map[relativePath] === undefined);
  },

  async renameCanvas(
    oldRelativePath: string,
    newTitle?: string,
    newFolder?: string
  ): Promise<{ relativePath: string; fileName?: string } | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.canvas?.renameCanvas) {
      try {
        const res = await (window as any).electronAPI.canvas.renameCanvas(oldRelativePath, newTitle, newFolder);
        if (res && res.success) {
          return { relativePath: res.relativePath, fileName: res.fileName };
        }
      } catch (err) {
        console.error('Error renaming canvas via Electron:', err);
      }
    }

    // Fallback
    const map = getFallbackCanvases();
    const existing = map[oldRelativePath];
    if (!existing) return null;

    const cleanTitle = (newTitle || existing.title).replace(/[\\/:*?"<>|]/g, '').trim();
    const fileName = `${cleanTitle}.canvas`;
    const targetFolder = newFolder !== undefined ? newFolder : existing.folder;
    const newRelPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;

    delete map[oldRelativePath];
    map[newRelPath] = {
      ...existing,
      id: newRelPath,
      title: cleanTitle,
      fileName,
      relativePath: newRelPath,
      folder: targetFolder,
      updatedAt: new Date().toISOString(),
    };
    saveFallbackCanvases(map);
    return { relativePath: newRelPath, fileName };
  },

  async createFolder(folderPath: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.canvas?.createFolder) {
      try {
        const res = await (window as any).electronAPI.canvas.createFolder(folderPath);
        return Boolean(res && res.success);
      } catch (err) {
        console.error('Error creating canvas folder via Electron:', err);
        return false;
      }
    }
    return true;
  },

  async openCanvasFolder(relativePath?: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.canvas?.openCanvasFolder) {
      try {
        return await (window as any).electronAPI.canvas.openCanvasFolder(relativePath);
      } catch (err) {
        console.error('Error opening canvas folder via Electron:', err);
      }
    }
    return false;
  },

  // Helper to prompt for an image file from disk
  async pickImageFile(): Promise<{ dataUrl: string; fileName: string; aspectRatio?: number } | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.selectCoverImage) {
      try {
        const dataUrl = await (window as any).electronAPI.selectCoverImage();
        if (dataUrl) {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.naturalWidth / (img.naturalHeight || 1);
              resolve({ dataUrl, fileName: 'Image', aspectRatio });
            };
            img.onerror = () => {
              resolve({ dataUrl, fileName: 'Image', aspectRatio: 4 / 3 });
            };
            img.src = dataUrl;
          });
        }
      } catch (e) {
        console.warn('selectCoverImage failed, falling back to input:', e);
      }
    }

    // Web browser fallback: file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const img = new Image();
          img.onload = () => {
            const aspectRatio = img.naturalWidth / (img.naturalHeight || 1);
            resolve({ dataUrl, fileName: file.name, aspectRatio });
          };
          img.onerror = () => resolve({ dataUrl, fileName: file.name, aspectRatio: 4 / 3 });
          img.src = dataUrl;
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  },
};
