import { BlenderAsset } from '../types';

const FALLBACK_STORAGE_KEY = 'albaqros_blender_assets_v1';

function getFallbackAssets(): BlenderAsset[] {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return [
    {
      id: 'demo-asset-suzanne',
      name: 'Suzanne Monkey Mascot',
      fileName: 'suzanne_mascot.blend',
      filePath: 'C:/AlbaqrosVault/models/suzanne_mascot.blend',
      relativePath: 'suzanne_mascot.blend',
      previewUrl: '',
      fileSize: 1024 * 480,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'Characters',
      tags: ['#mascot', '#character', '#lowpoly'],
      notes: 'Standard 3/4 isometric preview demo asset.',
      metadata: {
        faceCount: 534,
        vertexCount: 571,
        objectCount: 2,
        materialCount: 1,
        materials: ['ClayStudio'],
        dimensions: { x: 4.102, y: 3.0, z: 3.177 },
      },
    },
  ];
}

function saveFallbackAssets(assets: BlenderAsset[]) {
  try {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(assets));
  } catch (e) {}
}

export const AssetsService = {
  async listAssets(): Promise<{ success: boolean; assets: BlenderAsset[]; modelsDir?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.listAssets) {
      try {
        const res = await (window as any).electronAPI.assets.listAssets();
        if (res && res.success) {
          return { success: true, assets: res.assets || [], modelsDir: res.modelsDir };
        }
        return { success: false, assets: [], error: res?.error };
      } catch (err: any) {
        console.error('Error listing assets via Electron:', err);
        return { success: false, assets: [], error: err.message };
      }
    }

    return { success: true, assets: getFallbackAssets() };
  },

  async importAsset(params: {
    sourceFilePath: string;
    name?: string;
    category?: string;
    tags?: string[];
    notes?: string;
    copyToVault?: boolean;
  }): Promise<{ success: boolean; asset?: BlenderAsset; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.importAsset) {
      try {
        return await (window as any).electronAPI.assets.importAsset(params);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const assets = getFallbackAssets();
    const newAsset: BlenderAsset = {
      id: 'demo-asset-' + Date.now(),
      name: params.name || 'Imported Model',
      fileName: 'model.blend',
      filePath: params.sourceFilePath,
      fileSize: 1024 * 1024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: params.category || 'Props',
      tags: params.tags || [],
      notes: params.notes || '',
      metadata: {
        faceCount: 1200,
        vertexCount: 1250,
        objectCount: 1,
        dimensions: { x: 2.0, y: 2.0, z: 2.0 },
      },
    };
    assets.unshift(newAsset);
    saveFallbackAssets(assets);
    return { success: true, asset: newAsset };
  },

  async selectAndImportAsset(): Promise<{ success: boolean; assets?: BlenderAsset[]; canceled?: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.selectAndImportAsset) {
      try {
        return await (window as any).electronAPI.assets.selectAndImportAsset();
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'File dialog requires Electron desktop app.' };
  },

  async renderPreview(assetId: string): Promise<{ success: boolean; asset?: BlenderAsset; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.renderPreview) {
      try {
        return await (window as any).electronAPI.assets.renderPreview(assetId);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Preview rendering requires Electron desktop app with Blender.' };
  },

  async updateAsset(asset: BlenderAsset): Promise<{ success: boolean; asset?: BlenderAsset; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.updateAsset) {
      try {
        return await (window as any).electronAPI.assets.updateAsset(asset);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const assets = getFallbackAssets();
    const idx = assets.findIndex((a) => a.id === asset.id);
    if (idx >= 0) {
      assets[idx] = { ...assets[idx], ...asset, updatedAt: new Date().toISOString() };
      saveFallbackAssets(assets);
      return { success: true, asset: assets[idx] };
    }
    return { success: false, error: 'Asset not found' };
  },

  async deleteAsset(assetId: string, deleteFile = true): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.deleteAsset) {
      try {
        return await (window as any).electronAPI.assets.deleteAsset(assetId, deleteFile);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    let assets = getFallbackAssets();
    assets = assets.filter((a) => a.id !== assetId);
    saveFallbackAssets(assets);
    return { success: true };
  },

  async openInBlender(filePath: string): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.openInBlender) {
      try {
        return await (window as any).electronAPI.assets.openInBlender(filePath);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Opening Blender requires Electron desktop app.' };
  },

  async openAssetsFolder(): Promise<{ success: boolean; modelsDir?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.openAssetsFolder) {
      try {
        return await (window as any).electronAPI.assets.openAssetsFolder();
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Opening folder requires Electron desktop app.' };
  },

  async createScene(assetIds: string[], sceneName?: string): Promise<{ success: boolean; scenePath?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.createScene) {
      try {
        return await (window as any).electronAPI.assets.createScene(assetIds, sceneName);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Scene creation requires Electron desktop app.' };
  },

  async generateAppendScript(filePath: string): Promise<{ success: boolean; script?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.assets?.generateAppendScript) {
      try {
        return await (window as any).electronAPI.assets.generateAppendScript(filePath);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const safePath = (filePath || '').replace(/\\/g, '/');
    const snippet = `# Run this in Blender's Python Console to append the asset into your current scene:
import bpy

asset_path = r"${safePath}"
with bpy.data.libraries.load(asset_path) as (data_from, data_to):
    data_to.objects = data_from.objects

for obj in data_to.objects:
    if obj is not None:
        bpy.context.collection.objects.link(obj)

print("Successfully imported objects from " + asset_path)
`;
    return { success: true, script: snippet };
  },
};
