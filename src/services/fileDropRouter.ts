import { AssetsService } from './assetsService';
import { Art2dService } from './art2dService';
import { BlenderAsset, Art2DAsset } from '../types';

export const SUPPORTED_3D_EXTENSIONS = [
  '.blend',
  '.obj',
  '.fbx',
  '.gltf',
  '.glb',
  '.stl',
  '.dae',
  '.3ds',
  '.ply',
  '.abc',
  '.step',
  '.stp',
] as const;

export const SUPPORTED_2D_EXTENSIONS = [
  '.kra',
  '.psd',
  '.psb',
  '.clip',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.bmp',
  '.gif',
  '.tiff',
  '.tif',
  '.ai',
  '.procreate',
  '.xcf',
  '.ase',
  '.aseprite',
] as const;

export function getFileExtension(filenameOrPath: string): string {
  if (!filenameOrPath) return '';
  const idx = filenameOrPath.lastIndexOf('.');
  if (idx === -1) return '';
  return filenameOrPath.slice(idx).toLowerCase();
}

export function is3DFile(filenameOrPath: string): boolean {
  const ext = getFileExtension(filenameOrPath);
  return (SUPPORTED_3D_EXTENSIONS as readonly string[]).includes(ext);
}

export function is2DFile(filenameOrPath: string): boolean {
  const ext = getFileExtension(filenameOrPath);
  return (SUPPORTED_2D_EXTENSIONS as readonly string[]).includes(ext);
}

export function isSupportedMediaFile(filenameOrPath: string): boolean {
  return is3DFile(filenameOrPath) || is2DFile(filenameOrPath);
}

// Active folder tracking so drops into the window automatically inherit the current folder
let currentActive3DFolder: string | undefined = undefined;
let currentActive2DFolder: string | undefined = undefined;

export function setActive3DFolder(folder?: string) {
  currentActive3DFolder = folder && folder.trim() ? folder.trim() : undefined;
}

export function getActive3DFolder(): string | undefined {
  return currentActive3DFolder;
}

export function setActive2DFolder(folder?: string) {
  currentActive2DFolder = folder && folder.trim() ? folder.trim() : undefined;
}

export function getActive2DFolder(): string | undefined {
  return currentActive2DFolder;
}

export function getFilePath(file: File): string {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getPathForFile) {
    try {
      const p = (window as any).electronAPI.getPathForFile(file);
      if (p) return p;
    } catch (e) {}
  }
  return (file as any).path || '';
}

export interface ClassifiedFiles {
  threeD: { file: File; path: string; ext: string; name: string }[];
  twoD: { file: File; path: string; ext: string; name: string }[];
  unsupported: { file: File; path: string; ext: string; name: string }[];
  missingPath: File[];
}

export function classifyDroppedFiles(files: File[] | FileList): ClassifiedFiles {
  const fileArray = Array.from(files);
  const result: ClassifiedFiles = {
    threeD: [],
    twoD: [],
    unsupported: [],
    missingPath: [],
  };

  for (const file of fileArray) {
    const pathOnDisk = getFilePath(file);
    const identifier = pathOnDisk || file.name;
    const ext = getFileExtension(identifier);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');

    if (!pathOnDisk) {
      result.missingPath.push(file);
      continue;
    }

    if (is3DFile(identifier)) {
      result.threeD.push({ file, path: pathOnDisk, ext, name: cleanName });
    } else if (is2DFile(identifier)) {
      result.twoD.push({ file, path: pathOnDisk, ext, name: cleanName });
    } else {
      result.unsupported.push({ file, path: pathOnDisk, ext, name: cleanName });
    }
  }

  return result;
}

export interface ImportResultSummary {
  imported3D: { name: string; asset?: BlenderAsset; error?: string }[];
  imported2D: { name: string; asset?: Art2DAsset; error?: string }[];
  unsupportedNames: string[];
  missingPathCount: number;
  totalProcessed: number;
  totalSuccess: number;
}

export async function routeAndImportFiles(
  files: File[] | FileList,
  options?: {
    default3DFolder?: string;
    default2DFolder?: string;
    default3DCategory?: string;
    default2DCategory?: string;
    onProgress?: (current: number, total: number, currentFileName: string) => void;
  }
): Promise<ImportResultSummary> {
  const classified = classifyDroppedFiles(files);
  const totalCount = classified.threeD.length + classified.twoD.length;
  let processed = 0;

  const summary: ImportResultSummary = {
    imported3D: [],
    imported2D: [],
    unsupportedNames: classified.unsupported.map((u) => u.file.name),
    missingPathCount: classified.missingPath.length,
    totalProcessed: 0,
    totalSuccess: 0,
  };

  // 1. Process 3D Files -> 3D Asset Library
  for (const item of classified.threeD) {
    processed++;
    options?.onProgress?.(processed, totalCount, item.file.name);

    try {
      const res = await AssetsService.importAsset({
        sourceFilePath: item.path,
        name: item.name,
        folder: options?.default3DFolder !== undefined ? options.default3DFolder : getActive3DFolder(),
        category: options?.default3DCategory || 'Props',
        copyToVault: true,
      });

      if (res.success && res.asset) {
        summary.imported3D.push({ name: item.name, asset: res.asset });
        summary.totalSuccess++;
      } else {
        summary.imported3D.push({ name: item.name, error: res.error || 'Import failed' });
      }
    } catch (err: any) {
      summary.imported3D.push({ name: item.name, error: err.message || 'Import error' });
    }
  }

  // 2. Process 2D Files -> 2D Art Library
  for (const item of classified.twoD) {
    processed++;
    options?.onProgress?.(processed, totalCount, item.file.name);

    try {
      const res = await Art2dService.importAsset({
        sourceFilePath: item.path,
        name: item.name,
        folder: options?.default2DFolder !== undefined ? options.default2DFolder : getActive2DFolder(),
        category: options?.default2DCategory || 'Illustrations',
        copyToVault: true,
      });

      if (res.success && res.asset) {
        summary.imported2D.push({ name: item.name, asset: res.asset });
        summary.totalSuccess++;
      } else {
        summary.imported2D.push({ name: item.name, error: res.error || 'Import failed' });
      }
    } catch (err: any) {
      summary.imported2D.push({ name: item.name, error: err.message || 'Import error' });
    }
  }

  summary.totalProcessed = processed;

  // Dispatch global change events to trigger reactive UI updates across all views
  if (typeof window !== 'undefined') {
    if (summary.imported3D.some((i) => i.asset)) {
      window.dispatchEvent(new CustomEvent('albaqros-assets-updated'));
    }
    if (summary.imported2D.some((i) => i.asset)) {
      window.dispatchEvent(new CustomEvent('albaqros-art2d-updated'));
    }
  }

  return summary;
}
