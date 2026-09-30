import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Palette,
  Image as ImageIcon,
  Plus,
  FolderOpen,
  Search,
  ExternalLink,
  RotateCw,
  Trash2,
  Edit2,
  Copy,
  Check,
  LayoutGrid,
  List,
  Sparkles,
  Layers,
  Tag,
  CheckSquare,
  Square,
  AlertCircle,
  Eye,
  X,
  Upload,
  ChevronDown,
  Info,
  Download,
  Maximize2,
  SlidersHorizontal,
  FileImage,
  Brush,
  Folder,
  FolderPlus,
  Move,
} from 'lucide-react';
import { Art2DAsset, Art2DSoftware } from '../types';
import { Art2dService } from '../services/art2dService';

interface Art2DStudioViewProps {
  isStudioSidebarCollapsed?: boolean;
  onToggleStudioSidebar?: () => void;
}

const CATEGORIES = [
  'All',
  'Illustrations',
  'Character Design',
  'Concept Art',
  'Environments',
  'Sketches & Studies',
  'Sprites & Pixel Art',
  'UI & Graphic Design',
  'Textures & Patterns',
  'WIP / In Progress',
  'Other',
];

const SOFTWARE_FILTERS: { label: string; value: string }[] = [
  { label: 'All Software', value: 'all' },
  { label: 'Krita (.kra)', value: 'krita' },
  { label: 'Photoshop (.psd)', value: 'photoshop' },
  { label: 'Clip Studio (.clip)', value: 'clipstudio' },
  { label: 'Images (.png/.jpg)', value: 'image' },
  { label: 'Vector (.svg)', value: 'vector' },
];

const QUICK_TAG_SUGGESTIONS = [
  '#wip',
  '#finished',
  '#study',
  '#character',
  '#environment',
  '#portrait',
  '#fanart',
  '#original',
  '#speedpaint',
  '#concept',
  '#lineart',
  '#colorstudy',
];

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const Art2DStudioView: React.FC<Art2DStudioViewProps> = ({
  isStudioSidebarCollapsed = false,
  onToggleStudioSidebar,
}) => {
  const [assets, setAssets] = useState<Art2DAsset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [softwareFilter, setSoftwareFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [cardSize, setCardSize] = useState<'compact' | 'medium' | 'large'>('medium');
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('cover');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size' | 'resolution'>('newest');

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [extractingAssetId, setExtractingAssetId] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<Art2DAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Folder management state
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = All, "" = Root/Unsorted, or "Folder"
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isBatchMoveModalOpen, setIsBatchMoveModalOpen] = useState<boolean>(false);
  const [batchTargetFolder, setBatchTargetFolder] = useState<string>('');

  // Detail edit fields
  const [editName, setEditName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Illustrations');
  const [editTags, setEditTags] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editFolder, setEditFolder] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Batch edit state
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState<boolean>(false);
  const [batchCategory, setBatchCategory] = useState<string>('Illustrations');

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await Art2dService.listAssets();
      if (res.success) {
        setAssets(res.assets || []);
        const diskFolders = res.folders || [];
        const assetFolders = (res.assets || [])
          .map((a) => a.folder)
          .filter((f): f is string => Boolean(f && f.trim()));
        const unique = Array.from(new Set([...diskFolders, ...assetFolders])).sort();
        setFolders(unique);
      }
    } catch (err) {
      console.error('Failed to load 2D art assets:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Import handler via file picker dialog
  const handleImportClick = async () => {
    try {
      const targetFolder = selectedFolder && selectedFolder !== '' ? selectedFolder : undefined;
      const res = await Art2dService.selectAndImportAsset({ folder: targetFolder });
      if (res.success && res.assets && res.assets.length > 0) {
        const dest = targetFolder ? ` into "${targetFolder}"` : '';
        showNotice(`Imported ${res.assets.length} artwork(s)${dest} with full preview extraction!`);
        await loadAssets();
      }
    } catch (err: any) {
      showNotice('Import error: ' + err.message);
    }
  };

  // Drag and drop handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const files = Array.from(e.dataTransfer.files);
    let importedCount = 0;
    const supportedExts = ['.kra', '.psd', '.psb', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.clip', '.bmp', '.gif', '.tiff'];
    const targetFolder = selectedFolder && selectedFolder !== '' ? selectedFolder : undefined;

    showNotice(`Importing & rendering previews for ${files.length} file(s)...`);

    for (const file of files) {
      const pathOnDisk = (file as any).path;
      if (pathOnDisk) {
        const ext = '.' + pathOnDisk.split('.').pop()?.toLowerCase();
        if (supportedExts.includes(ext)) {
          const res = await Art2dService.importAsset({
            sourceFilePath: pathOnDisk,
            name: file.name.replace(/\.[^/.]+$/, ''),
            category: selectedCategory !== 'All' ? selectedCategory : 'Illustrations',
            folder: targetFolder,
            copyToVault: true,
          });
          if (res.success) importedCount++;
        }
      }
    }

    if (importedCount > 0) {
      const dest = targetFolder ? ` into "${targetFolder}"` : '';
      showNotice(`Successfully added ${importedCount} artwork(s)${dest} to your 2D library!`);
      await loadAssets();
    } else {
      showNotice('No supported creative files found in dropped items.');
    }
  };

  // Folder creation handler
  const handleCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = newFolderName.trim().replace(/[\\:*?"<>|]/g, '');
    if (!clean) {
      showNotice('Please enter a valid folder name');
      return;
    }
    try {
      const res = await Art2dService.createFolder(clean);
      if (res.success && res.folder) {
        showNotice(`Created folder "${res.folder}"`);
        setNewFolderName('');
        setIsNewFolderModalOpen(false);
        await loadAssets();
        setSelectedFolder(res.folder);
      } else {
        showNotice('Failed to create folder: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      showNotice('Error creating folder: ' + err.message);
    }
  };

  // Delete current selected folder
  const handleDeleteCurrentFolder = async () => {
    if (!selectedFolder) return;
    const itemsInFolder = assets.filter((a) => a.folder === selectedFolder || a.folder?.startsWith(selectedFolder + '/')).length;
    const msg = itemsInFolder > 0
      ? `Are you sure you want to delete folder "${selectedFolder}" and all ${itemsInFolder} artwork(s) inside it from disk?`
      : `Delete empty folder "${selectedFolder}"?`;
    if (!window.confirm(msg)) return;

    try {
      const res = await Art2dService.deleteFolder(selectedFolder);
      if (res.success) {
        showNotice(`Folder "${selectedFolder}" deleted`);
        setSelectedFolder(null);
        await loadAssets();
      } else {
        showNotice('Failed to delete folder: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      showNotice('Error deleting folder: ' + err.message);
    }
  };

  // Open folder in explorer
  const handleOpenCurrentFolderInExplorer = async () => {
    try {
      await Art2dService.openArtFolder(selectedFolder || undefined);
      showNotice(`Opened ${selectedFolder ? `"${selectedFolder}"` : '2D Art vault'} in Windows Explorer`);
    } catch (err: any) {
      showNotice('Error opening folder: ' + err.message);
    }
  };

  // Batch move handler
  const handleBatchMove = async () => {
    if (selectedAssetIds.length === 0) return;
    try {
      let movedCount = 0;
      for (const id of selectedAssetIds) {
        const res = await Art2dService.moveAsset(id, batchTargetFolder);
        if (res.success) movedCount++;
      }
      showNotice(`Moved ${movedCount} artwork(s) to ${batchTargetFolder ? `"${batchTargetFolder}"` : 'Root / Unsorted'}`);
      setIsBatchMoveModalOpen(false);
      setSelectedAssetIds([]);
      await loadAssets();
    } catch (err: any) {
      showNotice('Error moving artworks: ' + err.message);
    }
  };

  // Re-extract preview for a single asset
  const handleReExtractPreview = async (asset: Art2DAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExtractingAssetId(asset.id);
    showNotice(`Re-extracting thumbnail preview for "${asset.name}"...`);
    try {
      const res = await Art2dService.extractPreview(asset.id);
      if (res.success && res.asset) {
        setAssets((prev) => prev.map((a) => (a.id === asset.id ? res.asset! : a)));
        if (detailAsset && detailAsset.id === asset.id) {
          setDetailAsset(res.asset);
        }
        showNotice(`Preview updated for "${asset.name}"`);
      } else {
        showNotice('Extraction failed: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      showNotice('Extraction error: ' + err.message);
    } finally {
      setExtractingAssetId(null);
    }
  };

  // Open asset in Krita / Photoshop / Default
  const handleOpenInSoftware = async (asset: Art2DAsset, preferred?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await Art2dService.openInSoftware(asset.filePath, preferred);
      showNotice(`Opening "${asset.name}" in ${res.software || 'software'}...`);
    } catch (err: any) {
      showNotice('Error opening software: ' + err.message);
    }
  };

  // Copy preview image directly to clipboard
  const handleCopyImage = async (asset: Art2DAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await Art2dService.copyImageToClipboard(asset.id);
      if (res.success) {
        setCopiedId(asset.id);
        setTimeout(() => setCopiedId(null), 2500);
        showNotice(`Copied image "${asset.name}" to clipboard! Ready to paste.`);
      } else {
        showNotice('Clipboard copy failed: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      showNotice('Clipboard error: ' + err.message);
    }
  };

  // Export preview PNG to file system
  const handleExportPreview = async (asset: Art2DAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await Art2dService.exportPreview(asset.id);
      if (res.success && res.targetPath) {
        showNotice(`Exported preview to ${res.targetPath.split(/[\\/]/).pop()}`);
      }
    } catch (err: any) {
      showNotice('Export error: ' + err.message);
    }
  };

  // Open detail modal
  const handleOpenDetail = (asset: Art2DAsset) => {
    setDetailAsset(asset);
    setEditName(asset.name);
    setEditCategory(asset.category || 'Illustrations');
    setEditTags(asset.tags?.join(', ') || '');
    setEditNotes(asset.notes || '');
    setEditFolder(asset.folder || '');
  };

  // Save detail edits
  const handleSaveDetailEdits = async () => {
    if (!detailAsset) return;
    setIsSavingEdit(true);
    try {
      const parsedTags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith('#') ? t : `#${t}`));

      let currentAsset = detailAsset;
      if (editFolder !== (detailAsset.folder || '')) {
        const moveRes = await Art2dService.moveAsset(detailAsset.id, editFolder);
        if (moveRes.success && moveRes.asset) {
          currentAsset = moveRes.asset;
        }
      }

      const updated: Art2DAsset = {
        ...currentAsset,
        name: editName.trim() || currentAsset.name,
        category: editCategory,
        tags: parsedTags,
        notes: editNotes,
        folder: editFolder,
      };

      const res = await Art2dService.updateAsset(updated);
      if (res.success && res.asset) {
        setAssets((prev) => prev.map((a) => (a.id === updated.id ? res.asset! : a)));
        setDetailAsset(res.asset);
        showNotice('Artwork details and folder location saved');
        await loadAssets();
      }
    } catch (err: any) {
      showNotice('Failed to save: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Add quick tag to detail modal
  const handleAddQuickTag = (tag: string) => {
    const existing = editTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!existing.includes(tag)) {
      setEditTags([...existing, tag].join(', '));
    }
  };

  // Delete artwork
  const handleDeleteAsset = async (assetId: string, deleteFile = false) => {
    if (!window.confirm(`Delete this artwork from your library${deleteFile ? ' and permanently remove from disk' : ''}?`)) {
      return;
    }
    try {
      const res = await Art2dService.deleteAsset(assetId, deleteFile);
      if (res.success) {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
        setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId));
        if (detailAsset?.id === assetId) {
          setDetailAsset(null);
        }
        showNotice('Artwork removed from library');
      }
    } catch (err: any) {
      showNotice('Failed to delete artwork: ' + err.message);
    }
  };

  // Multi-select helpers
  const toggleSelectAsset = (assetId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAssetIds.length === filteredAssets.length) {
      setSelectedAssetIds([]);
    } else {
      setSelectedAssetIds(filteredAssets.map((a) => a.id));
    }
  };

  // Batch delete
  const handleBatchDelete = async (deleteFiles = false) => {
    if (selectedAssetIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedAssetIds.length} selected artwork(s)${deleteFiles ? ' and remove from disk' : ''}?`)) {
      return;
    }
    for (const id of selectedAssetIds) {
      await Art2dService.deleteAsset(id, deleteFiles);
    }
    setAssets((prev) => prev.filter((a) => !selectedAssetIds.includes(a.id)));
    setSelectedAssetIds([]);
    showNotice(`Deleted ${selectedAssetIds.length} artworks`);
  };

  // Batch category change
  const handleApplyBatchCategory = async () => {
    if (selectedAssetIds.length === 0) return;
    for (const id of selectedAssetIds) {
      const target = assets.find((a) => a.id === id);
      if (target) {
        await Art2dService.updateAsset({ ...target, category: batchCategory });
      }
    }
    setAssets((prev) =>
      prev.map((a) => (selectedAssetIds.includes(a.id) ? { ...a, category: batchCategory } : a))
    );
    setIsBatchCategoryModalOpen(false);
    showNotice(`Updated category for ${selectedAssetIds.length} artworks`);
  };

  // Open Vault Art folder
  const handleOpenArtFolder = async () => {
    try {
      await Art2dService.openArtFolder();
      showNotice('Opened 2D Art directory in Windows Explorer');
    } catch (err: any) {
      showNotice('Error opening folder: ' + err.message);
    }
  };

  // Filtered and sorted assets
  const filteredAssets = useMemo(() => {
    let list = assets.filter((asset) => {
      const matchesSearch =
        searchQuery === '' ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        asset.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (asset.metadata?.resolutionLabel &&
          asset.metadata.resolutionLabel.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (asset.software && asset.software.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategory === 'All' ||
        (asset.category && asset.category.toLowerCase() === selectedCategory.toLowerCase());

      const matchesSoftware =
        softwareFilter === 'all' ||
        (asset.software && asset.software.toLowerCase() === softwareFilter.toLowerCase()) ||
        (softwareFilter === 'krita' && asset.fileName.toLowerCase().endsWith('.kra')) ||
        (softwareFilter === 'photoshop' && (asset.fileName.toLowerCase().endsWith('.psd') || asset.fileName.toLowerCase().endsWith('.psb'))) ||
        (softwareFilter === 'clipstudio' && asset.fileName.toLowerCase().endsWith('.clip')) ||
        (softwareFilter === 'vector' && asset.fileName.toLowerCase().endsWith('.svg')) ||
        (softwareFilter === 'image' && ['.png', '.jpg', '.jpeg', '.webp'].some((e) => asset.fileName.toLowerCase().endsWith(e)));

      const matchesFolder =
        selectedFolder === null ||
        (selectedFolder === '' && (!asset.folder || asset.folder === '')) ||
        (selectedFolder !== null && selectedFolder !== '' && (asset.folder === selectedFolder || asset.folder?.startsWith(selectedFolder + '/')));

      return matchesSearch && matchesCat && matchesSoftware && matchesFolder;
    });

    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return (b.fileSize || 0) - (a.fileSize || 0);
      if (sortBy === 'resolution') {
        const resA = (a.metadata?.width || 0) * (a.metadata?.height || 0);
        const resB = (b.metadata?.width || 0) * (b.metadata?.height || 0);
        return resB - resA;
      }
      return 0;
    });

    return list;
  }, [assets, searchQuery, selectedCategory, softwareFilter, selectedFolder, sortBy]);

  // Total stats
  const stats = useMemo(() => {
    let kritaCount = 0;
    let psdCount = 0;
    let imageCount = 0;
    let totalBytes = 0;

    for (const a of assets) {
      totalBytes += a.fileSize || 0;
      const ext = (a.fileName || '').split('.').pop()?.toLowerCase();
      if (ext === 'kra' || a.software === 'krita') kritaCount++;
      else if (ext === 'psd' || ext === 'psb' || a.software === 'photoshop') psdCount++;
      else imageCount++;
    }

    return {
      total: assets.length,
      kritaCount,
      psdCount,
      imageCount,
      totalBytes,
    };
  }, [assets]);

  // Software badge renderer
  const renderSoftwareBadge = (asset: Art2DAsset) => {
    const ext = (asset.fileName || '').split('.').pop()?.toLowerCase();
    const software = asset.software || (ext === 'kra' ? 'krita' : ext === 'psd' ? 'photoshop' : 'image');

    if (software === 'krita' || ext === 'kra') {
      return (
        <span
          style={{
            fontSize: '0.625rem',
            padding: '2px 7px',
            borderRadius: '999px',
            backgroundColor: 'rgba(56, 189, 248, 0.2)',
            color: '#38bdf8',
            fontWeight: 800,
            letterSpacing: '0.04em',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Brush size={10} />
          KRITA
        </span>
      );
    }

    if (software === 'photoshop' || ext === 'psd' || ext === 'psb') {
      return (
        <span
          style={{
            fontSize: '0.625rem',
            padding: '2px 7px',
            borderRadius: '999px',
            backgroundColor: 'rgba(37, 99, 235, 0.25)',
            color: '#60a5fa',
            fontWeight: 800,
            letterSpacing: '0.04em',
            border: '1px solid rgba(37, 99, 235, 0.45)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Layers size={10} />
          PHOTOSHOP
        </span>
      );
    }

    if (software === 'clipstudio' || ext === 'clip') {
      return (
        <span
          style={{
            fontSize: '0.625rem',
            padding: '2px 7px',
            borderRadius: '999px',
            backgroundColor: 'rgba(168, 85, 247, 0.25)',
            color: '#c084fc',
            fontWeight: 800,
            border: '1px solid rgba(168, 85, 247, 0.4)',
          }}
        >
          CLIP STUDIO
        </span>
      );
    }

    if (software === 'vector' || ext === 'svg') {
      return (
        <span
          style={{
            fontSize: '0.625rem',
            padding: '2px 7px',
            borderRadius: '999px',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            color: '#fbbf24',
            fontWeight: 800,
            border: '1px solid rgba(245, 158, 11, 0.35)',
          }}
        >
          SVG VECTOR
        </span>
      );
    }

    return (
      <span
        style={{
          fontSize: '0.625rem',
          padding: '2px 7px',
          borderRadius: '999px',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          color: '#34d399',
          fontWeight: 800,
          border: '1px solid rgba(16, 185, 129, 0.35)',
        }}
      >
        {ext?.toUpperCase() || 'IMAGE'}
      </span>
    );
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0b0d11',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Toast Notification */}
      {notice && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '24px',
            zIndex: 1000,
            padding: '10px 18px',
            borderRadius: '8px',
            backgroundColor: '#1f2430',
            border: '1px solid var(--accent-indigo)',
            color: '#c7d2fe',
            boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Sparkles size={16} color="#ec4899" />
          <span>{notice}</span>
        </div>
      )}

      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 950,
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px dashed #ec4899',
            borderRadius: '12px',
            margin: '12px',
            gap: '16px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: 'rgba(236, 72, 153, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #ec4899',
              boxShadow: '0 0 30px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Upload size={40} color="#f472b6" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
              Drop Artwork Files to Archive in 2D Library
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '520px' }}>
              Supports Krita (.kra), Photoshop (.psd), Clip Studio (.clip), PNG, JPEG, WebP & SVG. Previews and resolution will be automatically extracted and preserved.
            </p>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: '#0e1117',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)',
              }}
            >
              <Palette size={23} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'var(--font-display)' }}>
                  2D Art & Creative Library
                </h1>
                <span
                  style={{
                    fontSize: '0.675rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                    color: '#f472b6',
                    fontWeight: 700,
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                  }}
                >
                  {stats.total} {stats.total === 1 ? 'Piece' : 'Artworks'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Your personal vault of completed illustrations, Krita painting files, PSD concepts & digital artwork
              </p>
            </div>
          </div>

          {/* Quick Header Stats Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{stats.kritaCount}</span> Krita
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>{stats.psdCount}</span> PSD
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span style={{ color: '#34d399', fontWeight: 700 }}>{stats.imageCount}</span> Images
              <span style={{ color: 'var(--border-subtle)' }}>•</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatBytes(stats.totalBytes)}</span>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleOpenArtFolder}
              title="Open the art folder in Windows Explorer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 12px' }}
            >
              <FolderOpen size={15} />
              Vault Folder
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadAssets}
              title="Refresh and rescan folder"
              style={{ padding: '7px 10px' }}
            >
              <RotateCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImportClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '0.85rem',
                padding: '7px 15px',
                background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)',
              }}
            >
              <Plus size={16} />
              Add Artwork
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search by title, tag, resolution, software..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 34px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.825rem',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Software Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
            {SOFTWARE_FILTERS.map((sf) => (
              <button
                key={sf.value}
                type="button"
                onClick={() => setSoftwareFilter(sf.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                  fontWeight: softwareFilter === sf.value ? 700 : 500,
                  border: '1px solid',
                  borderColor: softwareFilter === sf.value ? '#ec4899' : 'rgba(255,255,255,0.08)',
                  backgroundColor: softwareFilter === sf.value ? 'rgba(236, 72, 153, 0.18)' : 'transparent',
                  color: softwareFilter === sf.value ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {sf.label}
              </button>
            ))}
          </div>

          {/* Sort & View Mode Switches */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '6px 10px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="size">Sort: File Size</option>
              <option value="resolution">Sort: Resolution</option>
            </select>

            {/* Fit mode toggle */}
            {viewMode === 'grid' && (
              <button
                type="button"
                className="btn-icon"
                onClick={() => setFitMode((m) => (m === 'cover' ? 'contain' : 'cover'))}
                title={fitMode === 'cover' ? 'Switch to Aspect-Ratio Fit' : 'Switch to Cropped Fill'}
                style={{
                  width: '30px',
                  height: '30px',
                  padding: 0,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: fitMode === 'contain' ? '#ec4899' : 'var(--text-muted)',
                }}
              >
                {fitMode === 'cover' ? 'FILL' : 'FIT'}
              </button>
            )}

            {/* Grid size toggle */}
            {viewMode === 'grid' && (
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  padding: '2px',
                }}
              >
                {(['compact', 'medium', 'large'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCardSize(s)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: cardSize === s ? 'rgba(236, 72, 153, 0.3)' : 'transparent',
                      color: cardSize === s ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {s === 'compact' ? 'S' : s === 'medium' ? 'M' : 'L'}
                  </button>
                ))}
              </div>
            )}

            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid Gallery View"
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: viewMode === 'grid' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                  color: viewMode === 'grid' ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table List View"
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: viewMode === 'table' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                  color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Folders Navigation Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingRight: '4px' }}>
            <Folder size={13} color="#ec4899" />
            <span>Folders:</span>
          </div>

          {/* All Folders */}
          <button
            type="button"
            onClick={() => setSelectedFolder(null)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: selectedFolder === null ? 700 : 500,
              border: '1px solid',
              borderColor: selectedFolder === null ? '#ec4899' : 'rgba(255,255,255,0.08)',
              backgroundColor: selectedFolder === null ? 'rgba(236, 72, 153, 0.22)' : 'rgba(255,255,255,0.02)',
              color: selectedFolder === null ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <span>All Folders</span>
            <span style={{ fontSize: '0.675rem', opacity: 0.7 }}>({assets.length})</span>
          </button>

          {/* Root / Unsorted */}
          {(() => {
            const rootCount = assets.filter((a) => !a.folder || a.folder === '').length;
            return (
              <button
                type="button"
                onClick={() => setSelectedFolder('')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: selectedFolder === '' ? 700 : 500,
                  border: '1px solid',
                  borderColor: selectedFolder === '' ? '#ec4899' : 'rgba(255,255,255,0.08)',
                  backgroundColor: selectedFolder === '' ? 'rgba(236, 72, 153, 0.22)' : 'rgba(255,255,255,0.02)',
                  color: selectedFolder === '' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Root / Unsorted</span>
                <span style={{ fontSize: '0.675rem', opacity: 0.7 }}>({rootCount})</span>
              </button>
            );
          })()}

          {/* Custom Folders */}
          {folders.map((f) => {
            const count = assets.filter((a) => a.folder === f || a.folder?.startsWith(f + '/')).length;
            const isSelected = selectedFolder === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFolder(isSelected ? null : f)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? 700 : 500,
                  border: '1px solid',
                  borderColor: isSelected ? '#ec4899' : 'rgba(255,255,255,0.08)',
                  backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255,255,255,0.02)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Folder size={12} color={isSelected ? '#f472b6' : '#94a3b8'} />
                <span>{f}</span>
                <span style={{ fontSize: '0.675rem', opacity: 0.75 }}>({count})</span>
              </button>
            );
          })}

          {/* New Folder Button */}
          <button
            type="button"
            onClick={() => {
              setNewFolderName('');
              setIsNewFolderModalOpen(true);
            }}
            title="Create new folder in 2D art vault"
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: '1px dashed rgba(236, 72, 153, 0.5)',
              backgroundColor: 'rgba(236, 72, 153, 0.08)',
              color: '#f472b6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            <FolderPlus size={13} />
            <span>New Folder</span>
          </button>
        </div>

        {/* Selected Folder Active Indicator & Action Strip */}
        {selectedFolder !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(236, 72, 153, 0.1)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              fontSize: '0.775rem',
              color: '#fbcfe8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={14} color="#f472b6" />
              <span>
                Active Folder:{' '}
                <strong style={{ color: '#ffffff' }}>
                  {selectedFolder === '' ? 'Root / Unsorted' : selectedFolder}
                </strong>
                {' '}({filteredAssets.length} artwork{filteredAssets.length === 1 ? '' : 's'})
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.725rem' }}>
                • New imports will save here
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleOpenCurrentFolderInExplorer}
                title="Open this folder in Windows Explorer"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f472b6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.725rem',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                <FolderOpen size={12} />
                Open in Explorer
              </button>

              {selectedFolder !== '' && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentFolder}
                  title="Delete this folder from disk"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  <Trash2 size={12} />
                  Delete Folder
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedFolder(null)}
                title="Clear folder filter (Show all)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Category Filter Pills Bar */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {CATEGORIES.map((cat) => {
            const count =
              cat === 'All'
                ? assets.length
                : assets.filter((a) => (a.category || '').toLowerCase() === cat.toLowerCase()).length;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '999px',
                  fontSize: '0.775rem',
                  fontWeight: selectedCategory === cat ? 700 : 500,
                  border: '1px solid',
                  borderColor: selectedCategory === cat ? '#ec4899' : 'rgba(255,255,255,0.08)',
                  backgroundColor: selectedCategory === cat ? 'rgba(236, 72, 153, 0.2)' : 'transparent',
                  color: selectedCategory === cat ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{cat}</span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    opacity: 0.75,
                    padding: '0 4px',
                    borderRadius: '999px',
                    backgroundColor: selectedCategory === cat ? 'rgba(236, 72, 153, 0.4)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Batch Selection Bar */}
      {selectedAssetIds.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 800,
            backgroundColor: '#1f2430',
            border: '1px solid var(--accent-indigo)',
            borderRadius: '12px',
            padding: '10px 20px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            animation: 'slideUp 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#ec4899',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}
            >
              {selectedAssetIds.length}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
              Selected
            </span>
          </div>

          <div style={{ height: '20px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setBatchTargetFolder(selectedFolder || '');
              setIsBatchMoveModalOpen(true);
            }}
            style={{ fontSize: '0.775rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <Move size={13} />
            Move to Folder
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsBatchCategoryModalOpen(true)}
            style={{ fontSize: '0.775rem', padding: '5px 10px' }}
          >
            Change Category
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => handleBatchDelete(false)}
            style={{ fontSize: '0.775rem', padding: '5px 10px', color: '#f87171' }}
          >
            Remove from Library
          </button>

          <button
            type="button"
            className="btn-icon"
            onClick={() => setSelectedAssetIds([])}
            title="Clear selection"
            style={{ padding: '4px', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {filteredAssets.length === 0 ? (
          /* Empty State */
          <div
            style={{
              height: '100%',
              minHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '40px 20px',
            }}
          >
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
                border: '1px solid rgba(236, 72, 153, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                boxShadow: '0 8px 30px rgba(236, 72, 153, 0.15)',
              }}
            >
              <Palette size={42} color="#ec4899" />
            </div>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
              {assets.length === 0 ? 'Your 2D Art Library is Empty' : 'No Artworks Matched Your Filter'}
            </h3>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', lineHeight: '1.5', marginBottom: '24px' }}>
              {assets.length === 0
                ? 'Drop your Krita (.kra), Photoshop (.psd), Clip Studio (.clip), or PNG/JPEG image files directly here to start your digital art archive.'
                : 'Try adjusting your search query, software filters, or category pills above.'}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImportClick}
              style={{
                padding: '10px 22px',
                fontSize: '0.9rem',
                background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                border: 'none',
                boxShadow: '0 4px 16px rgba(236, 72, 153, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Plus size={18} />
              Import Artwork Files
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid / Masonry View */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                cardSize === 'compact'
                  ? 'repeat(auto-fill, minmax(220px, 1fr))'
                  : cardSize === 'large'
                  ? 'repeat(auto-fill, minmax(360px, 1fr))'
                  : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            {filteredAssets.map((asset) => {
              const isSelected = selectedAssetIds.includes(asset.id);
              const isExtracting = extractingAssetId === asset.id;
              const hasPreview = Boolean(asset.previewUrl);

              return (
                <div
                  key={asset.id}
                  onClick={() => handleOpenDetail(asset)}
                  style={{
                    backgroundColor: '#121620',
                    borderRadius: '12px',
                    border: isSelected
                      ? '2px solid #ec4899'
                      : '1px solid rgba(255,255,255,0.07)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    position: 'relative',
                    boxShadow: isSelected
                      ? '0 0 20px rgba(236, 72, 153, 0.3)'
                      : '0 4px 12px rgba(0,0,0,0.4)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.45)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {/* Thumbnail Container */}
                  <div
                    style={{
                      height: cardSize === 'compact' ? '160px' : cardSize === 'large' ? '280px' : '210px',
                      backgroundColor: '#07090d',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      // Checkered background for transparency
                      backgroundImage:
                        'linear-gradient(45deg, #0d1017 25%, transparent 25%), linear-gradient(-45deg, #0d1017 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0d1017 75%), linear-gradient(-45deg, transparent 75%, #0d1017 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    }}
                  >
                    {hasPreview ? (
                      <img
                        src={asset.previewUrl}
                        alt={asset.name}
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: fitMode,
                          transition: 'transform 0.25s ease',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <ImageIcon size={36} opacity={0.4} />
                        <span style={{ fontSize: '0.725rem' }}>No preview available</span>
                      </div>
                    )}

                    {/* Top Left: Multi-select Checkbox & Resolution */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        zIndex: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleSelectAsset(asset.id, e)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? '#ec4899' : 'rgba(15, 23, 42, 0.75)',
                          border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        {isSelected ? <Check size={14} color="#ffffff" /> : null}
                      </button>

                      {asset.metadata?.resolutionLabel && (
                        <span
                          style={{
                            fontSize: '0.625rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(15, 23, 42, 0.8)',
                            color: '#e2e8f0',
                            backdropFilter: 'blur(4px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            fontWeight: 600,
                          }}
                        >
                          {asset.metadata.resolutionLabel}
                        </span>
                      )}
                    </div>

                    {/* Top Right: Software Badge */}
                    <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10 }}>
                      {renderSoftwareBadge(asset)}
                    </div>

                    {/* Hover Action Overlay Icons */}
                    <div
                      className="card-hover-actions"
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        opacity: 0.92,
                        zIndex: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleCopyImage(asset, e)}
                        title="Copy Image to Clipboard"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: copiedId === asset.id ? '#10b981' : 'rgba(15, 23, 42, 0.85)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          backdropFilter: 'blur(6px)',
                        }}
                      >
                        {copiedId === asset.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleOpenInSoftware(asset, undefined, e)}
                        title="Open in Native Software"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(15, 23, 42, 0.85)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          backdropFilter: 'blur(6px)',
                        }}
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>

                    {/* Re-extracting Spinner */}
                    {isExtracting && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          color: '#f472b6',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          zIndex: 20,
                        }}
                      >
                        <RotateCw size={24} className="animate-spin" />
                        <span>Extracting preview...</span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <h4
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.3',
                        }}
                        title={asset.name}
                      >
                        {asset.name}
                      </h4>
                    </div>

                    {/* Metadata Subtitle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: 'var(--text-secondary)',
                          fontSize: '0.7rem',
                        }}
                      >
                        {asset.category || 'Artwork'}
                      </span>
                      <span>{formatBytes(asset.fileSize)}</span>
                    </div>

                    {/* Dimensions & Date */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {asset.metadata?.width && asset.metadata?.height ? (
                        <span>
                          {asset.metadata.width} × {asset.metadata.height} px
                        </span>
                      ) : (
                        <span>{asset.fileName}</span>
                      )}
                      <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Tags */}
                    {asset.tags && asset.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {asset.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.65rem',
                              color: '#c084fc',
                              backgroundColor: 'rgba(192, 132, 252, 0.1)',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {asset.tags.length > 3 && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            +{asset.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table / List View */
          <div
            style={{
              backgroundColor: '#121620',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#0d1017', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', width: '36px' }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                    >
                      {selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0 ? (
                        <CheckSquare size={16} color="#ec4899" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th style={{ padding: '10px 14px', width: '60px' }}>Preview</th>
                  <th style={{ padding: '10px 14px' }}>Artwork Title</th>
                  <th style={{ padding: '10px 14px' }}>Software</th>
                  <th style={{ padding: '10px 14px' }}>Resolution</th>
                  <th style={{ padding: '10px 14px' }}>Category</th>
                  <th style={{ padding: '10px 14px' }}>Size</th>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  return (
                    <tr
                      key={asset.id}
                      onClick={() => handleOpenDetail(asset)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={{ padding: '10px 14px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSelectAsset(asset.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: isSelected ? '#ec4899' : 'var(--text-muted)' }}
                        >
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '6px',
                            backgroundColor: '#07090d',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {asset.previewUrl ? (
                            <img src={asset.previewUrl} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <ImageIcon size={20} color="var(--text-muted)" />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{asset.name}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{asset.fileName}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>{renderSoftwareBadge(asset)}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                        {asset.metadata?.width && asset.metadata?.height
                          ? `${asset.metadata.width} × ${asset.metadata.height}`
                          : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '0.725rem' }}>
                          {asset.category}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{formatBytes(asset.fileSize)}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                        {new Date(asset.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleCopyImage(asset)}
                            title="Copy Image to Clipboard"
                            style={{ padding: '4px' }}
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleOpenInSoftware(asset)}
                            title="Open in native app"
                            style={{ padding: '4px' }}
                          >
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Artwork Detail Modal */}
      {detailAsset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setDetailAsset(null)}
        >
          <div
            style={{
              width: '95%',
              maxWidth: '1050px',
              height: '86vh',
              backgroundColor: '#121620',
              borderRadius: '16px',
              border: '1px solid rgba(236, 72, 153, 0.3)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
              display: 'flex',
              overflow: 'hidden',
              flexDirection: 'row',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Preview Lightbox Area */}
            <div
              style={{
                flex: '1 1 60%',
                backgroundColor: '#07090e',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                borderRight: '1px solid var(--border-subtle)',
                overflow: 'hidden',
              }}
            >
              {/* Top controls over preview */}
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  left: '14px',
                  right: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  zIndex: 20,
                  pointerEvents: 'auto',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {renderSoftwareBadge(detailAsset)}
                  {detailAsset.metadata?.resolutionLabel && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        color: '#ffffff',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        fontWeight: 600,
                      }}
                    >
                      {detailAsset.metadata.resolutionLabel}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleCopyImage(detailAsset)}
                    style={{ fontSize: '0.75rem', padding: '5px 10px', backgroundColor: 'rgba(15,23,42,0.85)' }}
                  >
                    <Copy size={13} style={{ marginRight: '5px' }} />
                    Copy Image
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleExportPreview(detailAsset)}
                    style={{ fontSize: '0.75rem', padding: '5px 10px', backgroundColor: 'rgba(15,23,42,0.85)' }}
                  >
                    <Download size={13} style={{ marginRight: '5px' }} />
                    Export PNG
                  </button>
                </div>
              </div>

              {/* Main Image Lightbox Display */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '50px 20px 20px',
                  overflow: 'hidden',
                  // Checkered transparency pattern
                  backgroundImage:
                    'linear-gradient(45deg, #0e121a 25%, transparent 25%), linear-gradient(-45deg, #0e121a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0e121a 75%), linear-gradient(-45deg, transparent 75%, #0e121a 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                }}
              >
                {detailAsset.previewUrl ? (
                  <img
                    src={detailAsset.previewUrl}
                    alt={detailAsset.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      borderRadius: '6px',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.8)',
                    }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <ImageIcon size={48} opacity={0.3} style={{ marginBottom: '8px' }} />
                    <div>No rendered preview found</div>
                  </div>
                )}
              </div>

              {/* Bottom Quick Bar */}
              <div
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#0a0d13',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>{detailAsset.fileName}</span>
                <button
                  type="button"
                  onClick={() => handleReExtractPreview(detailAsset)}
                  disabled={extractingAssetId === detailAsset.id}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f472b6',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  <RotateCw size={13} className={extractingAssetId === detailAsset.id ? 'animate-spin' : ''} />
                  Re-extract Thumbnail
                </button>
              </div>
            </div>

            {/* Right: Metadata & Edit Controls Sidebar */}
            <div
              style={{
                flex: '1 1 40%',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                overflowY: 'auto',
                backgroundColor: '#121620',
              }}
            >
              {/* Header Title & Close */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Artwork Title
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{
                      width: '100%',
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color: '#ffffff',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      marginTop: '4px',
                      outline: 'none',
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setDetailAsset(null)}
                  style={{ padding: '6px', color: 'var(--text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Action Buttons: Open in Software */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenInSoftware(detailAsset)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '0.85rem',
                    padding: '9px 16px',
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  <ExternalLink size={16} />
                  Open in {detailAsset.software === 'krita' ? 'Krita' : detailAsset.software === 'photoshop' ? 'Photoshop' : 'Software'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    if ((window as any).electronAPI?.showItemInFolder) {
                      await (window as any).electronAPI.showItemInFolder(detailAsset.filePath);
                    }
                  }}
                  title="Reveal file in Windows Explorer"
                  style={{ padding: '9px 12px' }}
                >
                  <FolderOpen size={16} />
                </button>
              </div>

              {/* Category Selector */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Folder Selector */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Vault Folder / Location
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={editFolder}
                    onChange={(e) => setEditFolder(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">📁 Root / Unsorted</option>
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        📁 {f}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      const name = window.prompt('Enter new folder name:');
                      if (name && name.trim()) {
                        const clean = name.trim().replace(/[\\:*?"<>|]/g, '');
                        Art2dService.createFolder(clean).then((res) => {
                          if (res.success && res.folder) {
                            loadAssets();
                            setEditFolder(res.folder);
                            showNotice(`Created folder "${res.folder}"`);
                          }
                        });
                      }
                    }}
                    title="Create new folder"
                    style={{ padding: '0 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <FolderPlus size={14} />
                    <span>New</span>
                  </button>
                </div>
              </div>

              {/* Tags Input */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="e.g. #character, #krita, #conceptart"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />

                {/* Quick Tag suggestions */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {QUICK_TAG_SUGGESTIONS.map((qt) => (
                    <button
                      key={qt}
                      type="button"
                      onClick={() => handleAddQuickTag(qt)}
                      style={{
                        fontSize: '0.675rem',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {qt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Artist Reflection / Notes */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Artist Process Notes & Learnings
                </label>
                <textarea
                  rows={4}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Techniques explored, color palettes, brush settings, or milestone context..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.825rem',
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: '1.4',
                  }}
                />
              </div>

              {/* Technical Specifications Card */}
              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                  Technical Specifications
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.775rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Dimensions: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>
                      {detailAsset.metadata?.width && detailAsset.metadata?.height
                        ? `${detailAsset.metadata.width} × ${detailAsset.metadata.height} px`
                        : 'Unknown'}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Aspect Ratio: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>
                      {detailAsset.metadata?.aspectRatio || '—'}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Format: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600, textTransform: 'uppercase' }}>
                      {detailAsset.metadata?.format || detailAsset.fileName.split('.').pop()}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Color Mode: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>
                      {detailAsset.metadata?.colorMode || 'RGB'}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>File Size: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>
                      {formatBytes(detailAsset.fileSize)}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Resolution Preset: </span>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>
                      {detailAsset.metadata?.resolutionLabel || 'Custom'}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '4px', fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  Path: {detailAsset.filePath}
                </div>
              </div>

              {/* Save & Delete Footer */}
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleDeleteAsset(detailAsset.id, false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 0',
                  }}
                >
                  <Trash2 size={14} />
                  Delete Artwork
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveDetailEdits}
                  disabled={isSavingEdit}
                  style={{
                    padding: '8px 20px',
                    fontSize: '0.85rem',
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Category Modal */}
      {isBatchCategoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsBatchCategoryModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#1f2430',
              borderRadius: '12px',
              border: '1px solid var(--accent-indigo)',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', marginBottom: '12px' }}>
              Change Category for {selectedAssetIds.length} Artworks
            </h3>

            <select
              value={batchCategory}
              onChange={(e) => setBatchCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
                marginBottom: '18px',
              }}
            >
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsBatchCategoryModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleApplyBatchCategory}
                style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', border: 'none' }}
              >
                Apply Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isNewFolderModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsNewFolderModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#1f2430',
              borderRadius: '12px',
              border: '1px solid #ec4899',
              padding: '22px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(236, 72, 153, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f472b6',
                }}
              >
                <FolderPlus size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Create New Folder
                </h3>
                <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                  Organize your 2D artworks into categorized subfolders
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateFolder}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Folder Name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Characters, Environments, Studies"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewFolderModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', border: 'none' }}
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Move Modal */}
      {isBatchMoveModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsBatchMoveModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#1f2430',
              borderRadius: '12px',
              border: '1px solid var(--accent-indigo)',
              padding: '22px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                }}
              >
                <Move size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Move {selectedAssetIds.length} Artwork{selectedAssetIds.length === 1 ? '' : 's'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                  Choose destination folder in vault
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Target Folder
              </label>
              <select
                value={batchTargetFolder}
                onChange={(e) => setBatchTargetFolder(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="">📁 Root / Unsorted</option>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    📁 {f}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsBatchMoveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBatchMove}
                style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', border: 'none' }}
              >
                Move Artworks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
