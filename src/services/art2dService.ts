import { Art2DAsset } from '../types';

const FALLBACK_STORAGE_KEY = 'albaqros_art2d_assets_v1';

function getFallbackArtAssets(): Art2DAsset[] {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return [
    {
      id: 'demo-art-neon-cityscape',
      name: 'Cyberpunk Skyline Rain',
      fileName: 'cyberpunk_skyline_rain.kra',
      filePath: 'C:/AlbaqrosVault/art/cyberpunk_skyline_rain.kra',
      relativePath: 'cyberpunk_skyline_rain.kra',
      previewUrl: '',
      fileSize: 1024 * 1024 * 18.4,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      category: 'Concept Art',
      tags: ['#cyberpunk', '#environment', '#krita', '#rain', '#night'],
      notes: 'Atmospheric lighting study with wet asphalt reflections. Tested heavy textured brush for rain mist.',
      software: 'krita',
      metadata: {
        width: 3840,
        height: 2160,
        aspectRatio: 1.778,
        resolutionLabel: '4K UHD',
        format: 'kra',
        colorMode: 'RGBA',
        bitDepth: 8,
        dpi: 300,
        hasAlpha: true,
        software: 'krita',
      },
    },
    {
      id: 'demo-art-character-portrait',
      name: 'Valkyrie Character Concept',
      fileName: 'valkyrie_hero_portrait.psd',
      filePath: 'C:/AlbaqrosVault/art/valkyrie_hero_portrait.psd',
      relativePath: 'valkyrie_hero_portrait.psd',
      previewUrl: '',
      fileSize: 1024 * 1024 * 34.2,
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      category: 'Character Design',
      tags: ['#character', '#portrait', '#photoshop', '#armor', '#fantasy'],
      notes: 'Golden rim lighting and feathered helmet detail. Focus on metallic subsurface scatter.',
      software: 'photoshop',
      metadata: {
        width: 2800,
        height: 3500,
        aspectRatio: 0.8,
        resolutionLabel: '3:4 Portrait',
        format: 'psd',
        colorMode: 'RGB',
        bitDepth: 8,
        dpi: 300,
        hasAlpha: true,
        software: 'photoshop',
      },
    },
    {
      id: 'demo-art-magic-potion-sprite',
      name: 'Mana Crystal Vial Icon',
      fileName: 'mana_crystal_vial.png',
      filePath: 'C:/AlbaqrosVault/art/mana_crystal_vial.png',
      relativePath: 'mana_crystal_vial.png',
      previewUrl: '',
      fileSize: 1024 * 240,
      createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
      category: 'UI & Graphic Design',
      tags: ['#sprite', '#gameicon', '#crystal', '#png'],
      notes: 'Clean transparency, game inventory item asset.',
      software: 'image',
      metadata: {
        width: 512,
        height: 512,
        aspectRatio: 1.0,
        resolutionLabel: 'Square (512px)',
        format: 'png',
        colorMode: 'RGBA',
        bitDepth: 8,
        hasAlpha: true,
        software: 'image',
      },
    },
  ];
}

function saveFallbackArtAssets(assets: Art2DAsset[]) {
  try {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(assets));
  } catch (e) {}
}

export const Art2dService = {
  async listAssets(): Promise<{ success: boolean; assets: Art2DAsset[]; artDir?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.listAssets) {
      try {
        const res = await (window as any).electronAPI.art2d.listAssets();
        if (res && res.success) {
          return { success: true, assets: res.assets || [], artDir: res.artDir };
        }
        return { success: false, assets: [], error: res?.error };
      } catch (err: any) {
        console.error('Error listing 2D art assets via Electron:', err);
        return { success: false, assets: [], error: err.message };
      }
    }

    return { success: true, assets: getFallbackArtAssets() };
  },

  async importAsset(params: {
    sourceFilePath: string;
    name?: string;
    category?: string;
    tags?: string[];
    notes?: string;
    copyToVault?: boolean;
  }): Promise<{ success: boolean; asset?: Art2DAsset; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.importAsset) {
      try {
        return await (window as any).electronAPI.art2d.importAsset(params);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const assets = getFallbackArtAssets();
    const fileName = params.sourceFilePath.split(/[\\/]/).pop() || 'artwork.png';
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
    const software = ext === 'kra' ? 'krita' : ext === 'psd' ? 'photoshop' : 'image';

    const newAsset: Art2DAsset = {
      id: 'art-' + Date.now(),
      name: params.name || fileName.replace(/\.[^/.]+$/, ''),
      fileName,
      filePath: params.sourceFilePath,
      fileSize: 1024 * 1024 * 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: params.category || 'Illustrations',
      tags: params.tags || [],
      notes: params.notes || '',
      software,
      metadata: {
        width: 1920,
        height: 1080,
        aspectRatio: 1.778,
        resolutionLabel: '1080p FHD',
        format: ext,
        software,
      },
    };
    assets.unshift(newAsset);
    saveFallbackArtAssets(assets);
    return { success: true, asset: newAsset };
  },

  async selectAndImportAsset(): Promise<{ success: boolean; assets?: Art2DAsset[]; canceled?: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.selectAndImportAsset) {
      try {
        return await (window as any).electronAPI.art2d.selectAndImportAsset();
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'File dialog requires Electron desktop app.' };
  },

  async extractPreview(assetId: string): Promise<{ success: boolean; asset?: Art2DAsset; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.extractPreview) {
      try {
        return await (window as any).electronAPI.art2d.extractPreview(assetId);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Preview re-extraction requires Electron desktop app.' };
  },

  async updateAsset(asset: Art2DAsset): Promise<{ success: boolean; asset?: Art2DAsset; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.updateAsset) {
      try {
        return await (window as any).electronAPI.art2d.updateAsset(asset);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const assets = getFallbackArtAssets();
    const idx = assets.findIndex((a) => a.id === asset.id);
    if (idx >= 0) {
      assets[idx] = { ...assets[idx], ...asset, updatedAt: new Date().toISOString() };
      saveFallbackArtAssets(assets);
      return { success: true, asset: assets[idx] };
    }
    return { success: false, error: 'Artwork not found' };
  },

  async deleteAsset(assetId: string, deleteFile = true): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.deleteAsset) {
      try {
        return await (window as any).electronAPI.art2d.deleteAsset(assetId, deleteFile);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    let assets = getFallbackArtAssets();
    assets = assets.filter((a) => a.id !== assetId);
    saveFallbackArtAssets(assets);
    return { success: true };
  },

  async openInSoftware(filePath: string, preferredSoftware?: string): Promise<{ success: boolean; software?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.openInSoftware) {
      try {
        return await (window as any).electronAPI.art2d.openInSoftware(filePath, preferredSoftware);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Opening files in creative software requires Electron desktop app.' };
  },

  async openArtFolder(): Promise<{ success: boolean; artDir?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.openFolder) {
      try {
        return await (window as any).electronAPI.art2d.openFolder();
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Opening folder requires Electron desktop app.' };
  },

  async copyImageToClipboard(assetId: string): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.copyToClipboard) {
      try {
        return await (window as any).electronAPI.art2d.copyToClipboard(assetId);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Clipboard copy requires Electron desktop app.' };
  },

  async exportPreview(assetId: string): Promise<{ success: boolean; targetPath?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.exportPreview) {
      try {
        return await (window as any).electronAPI.art2d.exportPreview(assetId);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Exporting preview requires Electron desktop app.' };
  },

  async addToCanvas(assetId: string, canvasPath: string): Promise<{ success: boolean; node?: any; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.art2d?.addToCanvas) {
      try {
        return await (window as any).electronAPI.art2d.addToCanvas(assetId, canvasPath);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Adding to canvas requires Electron desktop app.' };
  },
};
