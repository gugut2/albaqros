import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
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
  FileCode,
  Tag,
  CheckSquare,
  Square,
  AlertCircle,
  Eye,
  X,
  Upload,
  ChevronDown,
  Info,
  Folder,
  FolderPlus,
  Move,
} from 'lucide-react';
import { BlenderAsset } from '../types';
import { AssetsService } from '../services/assetsService';
import { routeAndImportFiles, setActive3DFolder } from '../services/fileDropRouter';

interface AssetsStudioViewProps {
  isStudioSidebarCollapsed?: boolean;
  onToggleStudioSidebar?: () => void;
}

const CATEGORIES = [
  'All',
  'Characters',
  'Props',
  'Environment',
  'Vehicles',
  'Architecture',
  'Weapons',
  'Modular',
  'Other',
];

export const AssetsStudioView: React.FC<AssetsStudioViewProps> = ({
  isStudioSidebarCollapsed = false,
  onToggleStudioSidebar,
}) => {
  const [assets, setAssets] = useState<BlenderAsset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [renderingAssetId, setRenderingAssetId] = useState<string | null>(null);
  const [isBatchRendering, setIsBatchRendering] = useState<boolean>(false);
  const [detailAsset, setDetailAsset] = useState<BlenderAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isSceneModalOpen, setIsSceneModalOpen] = useState<boolean>(false);
  const [sceneName, setSceneName] = useState<string>('');
  const [isAssembling, setIsAssembling] = useState<boolean>(false);

  // Folder management state
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = All, "" = Root/Unsorted, or "Folder"
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isBatchMoveModalOpen, setIsBatchMoveModalOpen] = useState<boolean>(false);
  const [batchTargetFolder, setBatchTargetFolder] = useState<string>('');

  // Edit fields for detail modal
  const [editName, setEditName] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Props');
  const [editTags, setEditTags] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editFolder, setEditFolder] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await AssetsService.listAssets();
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
      console.error('Failed to load assets:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
    const handleAssetsUpdated = () => {
      loadAssets();
    };
    window.addEventListener('albaqros-assets-updated', handleAssetsUpdated);
    return () => {
      window.removeEventListener('albaqros-assets-updated', handleAssetsUpdated);
    };
  }, [loadAssets]);

  // Synchronize active folder so global drag & drop automatically saves into this folder
  useEffect(() => {
    setActive3DFolder(selectedFolder || undefined);
    return () => setActive3DFolder(undefined);
  }, [selectedFolder]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  // Import handler
  const handleImportClick = async () => {
    try {
      const targetFolder = selectedFolder && selectedFolder !== '' ? selectedFolder : undefined;
      const res = await AssetsService.selectAndImportAsset({ folder: targetFolder });
      if (res.success && res.assets && res.assets.length > 0) {
        const dest = targetFolder ? ` into "${targetFolder}"` : '';
        showNotice(`Imported ${res.assets.length} model(s)${dest} with 3/4 preview render`);
        await loadAssets();
      }
    } catch (err: any) {
      showNotice('Import error: ' + err.message);
    }
  };

  // Drag and drop handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const targetFolder = selectedFolder && selectedFolder !== '' ? selectedFolder : undefined;
    showNotice(`Processing ${e.dataTransfer.files.length} dropped file(s)...`);

    try {
      const summary = await routeAndImportFiles(e.dataTransfer.files, {
        default3DFolder: targetFolder,
        default3DCategory: selectedCategory !== 'All' ? selectedCategory : 'Props',
        onProgress: (current, total, name) => {
          showNotice(`Importing (${current}/${total}): ${name}...`);
        },
      });

      if (summary.totalSuccess > 0) {
        const msgParts: string[] = [];
        if (summary.imported3D.length > 0) {
          const dest = targetFolder ? ` into "${targetFolder}"` : '';
          msgParts.push(`${summary.imported3D.length} 3D model(s)${dest}`);
        }
        if (summary.imported2D.length > 0) {
          msgParts.push(`${summary.imported2D.length} artwork(s) to 2D Art Library`);
        }
        showNotice(`✨ Saved ${msgParts.join(' & ')}!`);
        await loadAssets();
      } else if (summary.unsupportedNames.length > 0) {
        showNotice(`No supported 3D or 2D media recognized in dropped file(s)`);
      }
    } catch (err: any) {
      showNotice('Drop import error: ' + err.message);
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
      const res = await AssetsService.createFolder(clean);
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
      ? `Are you sure you want to delete folder "${selectedFolder}" and all ${itemsInFolder} model(s) inside it from disk?`
      : `Delete empty folder "${selectedFolder}"?`;
    if (!window.confirm(msg)) return;

    try {
      const res = await AssetsService.deleteFolder(selectedFolder);
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
      await AssetsService.openAssetsFolder(selectedFolder || undefined);
      showNotice(`Opened ${selectedFolder ? `"${selectedFolder}"` : 'models vault'} in Windows Explorer`);
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
        const res = await AssetsService.moveAsset(id, batchTargetFolder);
        if (res.success) movedCount++;
      }
      showNotice(`Moved ${movedCount} model(s) to ${batchTargetFolder ? `"${batchTargetFolder}"` : 'Root / Unsorted'}`);
      setIsBatchMoveModalOpen(false);
      setSelectedAssetIds([]);
      await loadAssets();
    } catch (err: any) {
      showNotice('Error moving models: ' + err.message);
    }
  };

  // Re-render single asset 3/4 preview
  const handleReRender = async (asset: BlenderAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRenderingAssetId(asset.id);
    showNotice(`Blender rendering 3/4 preview with materials for "${asset.name}"...`);
    try {
      const res = await AssetsService.renderPreview(asset.id);
      if (res.success && res.asset) {
        setAssets((prev) => prev.map((a) => (a.id === asset.id ? res.asset! : a)));
        if (detailAsset && detailAsset.id === asset.id) {
          setDetailAsset(res.asset);
        }
        showNotice(`3/4 preview updated with materials for "${asset.name}"`);
      } else {
        showNotice('Render failed: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      showNotice('Render error: ' + err.message);
    } finally {
      setRenderingAssetId(null);
    }
  };

  // Open asset in Blender
  const handleOpenInBlender = async (asset: BlenderAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await AssetsService.openInBlender(asset.filePath);
      showNotice(`Opened "${asset.name}" in Blender`);
    } catch (err: any) {
      showNotice('Error opening Blender: ' + err.message);
    }
  };

  // Copy append script
  const handleCopyAppendScript = async (asset: BlenderAsset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await AssetsService.generateAppendScript(asset.filePath);
      if (res.script) {
        await navigator.clipboard.writeText(res.script);
        setCopiedId(asset.id);
        setTimeout(() => setCopiedId(null), 2500);
        showNotice('Copied Blender Python append script to clipboard!');
      }
    } catch (err: any) {
      showNotice('Failed to copy script: ' + err.message);
    }
  };

  // Open detail modal
  const handleOpenDetail = (asset: BlenderAsset) => {
    setDetailAsset(asset);
    setEditName(asset.name);
    setEditCategory(asset.category || 'Props');
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
        const moveRes = await AssetsService.moveAsset(detailAsset.id, editFolder);
        if (moveRes.success && moveRes.asset) {
          currentAsset = moveRes.asset;
        }
      }

      const updated: BlenderAsset = {
        ...currentAsset,
        name: editName.trim() || currentAsset.name,
        category: editCategory,
        tags: parsedTags,
        notes: editNotes,
        folder: editFolder,
      };

      const res = await AssetsService.updateAsset(updated);
      if (res.success && res.asset) {
        setAssets((prev) => prev.map((a) => (a.id === updated.id ? res.asset! : a)));
        setDetailAsset(res.asset);
        showNotice('Asset details and folder location saved');
        await loadAssets();
      }
    } catch (err: any) {
      showNotice('Failed to save: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete asset
  const handleDeleteAsset = async (assetId: string, deleteFile = true) => {
    const targetAsset = assets.find((a) => a.id === assetId);
    const assetName = targetAsset ? targetAsset.name : 'this model';
    if (!window.confirm(`Delete "${assetName}"?\n\nThe file will be permanently removed from your vault and deleted from cloud storage.`)) {
      return;
    }
    try {
      const res = await AssetsService.deleteAsset(assetId, deleteFile);
      if (res.success) {
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
        setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId));
        if (detailAsset?.id === assetId) {
          setDetailAsset(null);
        }
        showNotice('Model deleted from library & cloud');
      } else {
        showNotice('Failed to delete asset: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      showNotice('Failed to delete asset: ' + err.message);
    }
  };

  // Batch delete assets
  const handleBatchDelete = async (deleteFiles = true) => {
    if (selectedAssetIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedAssetIds.length} selected 3D model(s)?\n\nAll model files and renders will be permanently removed from your vault and deleted from cloud storage.`
      )
    ) {
      return;
    }
    let deletedCount = 0;
    for (const id of selectedAssetIds) {
      try {
        const res = await AssetsService.deleteAsset(id, deleteFiles);
        if (res.success) deletedCount++;
      } catch (e) {
        console.error('Failed to delete asset:', id, e);
      }
    }
    setAssets((prev) => prev.filter((a) => !selectedAssetIds.includes(a.id)));
    setSelectedAssetIds([]);
    showNotice(`Deleted ${deletedCount} 3D model(s) from vault & cloud`);
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

  // Create assembled scene from selected assets
  const handleAssembleScene = async () => {
    if (selectedAssetIds.length === 0) return;
    setIsAssembling(true);
    showNotice(`Assembling ${selectedAssetIds.length} assets into new Blender scene...`);
    try {
      const res = await AssetsService.createScene(selectedAssetIds, sceneName || undefined);
      if (res.success) {
        showNotice('Scene assembled & opened in Blender!');
        setIsSceneModalOpen(false);
        setSceneName('');
        setSelectedAssetIds([]);
      } else {
        showNotice('Failed to assemble scene: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      showNotice('Error assembling scene: ' + err.message);
    } finally {
      setIsAssembling(false);
    }
  };

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch =
        searchQuery === '' ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        asset.notes?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === 'All' ||
        (asset.category && asset.category.toLowerCase() === selectedCategory.toLowerCase());

      const matchesFolder =
        selectedFolder === null ||
        (selectedFolder === '' && (!asset.folder || asset.folder === '')) ||
        (selectedFolder !== null && selectedFolder !== '' && (asset.folder === selectedFolder || asset.folder?.startsWith(selectedFolder + '/')));

      return matchesSearch && matchesCat && matchesFolder;
    });
  }, [assets, searchQuery, selectedCategory, selectedFolder]);

  // Total stats
  const totalFaces = useMemo(() => {
    return assets.reduce((sum, a) => sum + (a.metadata?.faceCount || 0), 0);
  }, [assets]);

  const totalVerts = useMemo(() => {
    return assets.reduce((sum, a) => sum + (a.metadata?.vertexCount || 0), 0);
  }, [assets]);

  // Batch re-render previews with materials
  const handleBatchReRender = async (targetIds?: string[]) => {
    const ids =
      targetIds && targetIds.length > 0
        ? targetIds
        : selectedAssetIds.length > 0
        ? selectedAssetIds
        : filteredAssets.map((a) => a.id);

    if (ids.length === 0) {
      showNotice('No models to re-render.');
      return;
    }

    setIsBatchRendering(true);
    showNotice(`Blender rendering ${ids.length} preview(s) with materials...`);
    try {
      const res = await AssetsService.batchRenderPreviews(ids);
      if (res.success && res.assets) {
        setAssets(res.assets);
        if (detailAsset) {
          const updatedDetail = res.assets.find((a) => a.id === detailAsset.id);
          if (updatedDetail) setDetailAsset(updatedDetail);
        }
        showNotice(`Rendered ${res.updatedCount ?? ids.length} preview(s) with materials!`);
      } else {
        showNotice('Batch render failed: ' + (res.error || 'Unknown error'));
      }
    } catch (err: any) {
      showNotice('Batch render error: ' + err.message);
    } finally {
      setIsBatchRendering(false);
    }
  };

  return (
    <div
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
          <Sparkles size={16} color="#818cf8" />
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
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px dashed var(--accent-indigo)',
            borderRadius: '12px',
            margin: '12px',
            gap: '16px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--accent-indigo)',
            }}
          >
            <Upload size={38} color="#818cf8" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginBottom: '6px' }}>
              Drop .blend Models to Add to Library
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Albaqros will automatically generate a standardized 3/4 isometric preview and index technical specs.
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #e87a24 0%, #d45914 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(232, 122, 36, 0.35)',
              }}
            >
              <Box size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'var(--font-display)' }}>
                  3D Asset Library
                </h1>
                <span
                  style={{
                    fontSize: '0.675rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(232, 122, 36, 0.2)',
                    color: '#fb923c',
                    fontWeight: 700,
                    border: '1px solid rgba(232, 122, 36, 0.3)',
                  }}
                >
                  BLENDER READY
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Completed 3D models with standardized 3/4 isometric preview renders, ready for scene composition.
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges & Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.775rem',
                color: 'var(--text-secondary)',
              }}
            >
              <div>
                <strong style={{ color: '#ffffff', fontWeight: 700 }}>{assets.length}</strong> Models
              </div>
              <span style={{ opacity: 0.3 }}>|</span>
              <div>
                <strong style={{ color: '#818cf8', fontWeight: 700 }}>
                  {totalFaces >= 1000 ? `${(totalFaces / 1000).toFixed(1)}k` : totalFaces}
                </strong>{' '}
                Polys
              </div>
              <span style={{ opacity: 0.3 }}>|</span>
              <div>
                <strong style={{ color: '#38bdf8', fontWeight: 700 }}>
                  {totalVerts >= 1000 ? `${(totalVerts / 1000).toFixed(1)}k` : totalVerts}
                </strong>{' '}
                Verts
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleBatchReRender()}
              className="btn-secondary"
              disabled={isBatchRendering || assets.length === 0}
              title="Re-render all 3D asset previews with current materials and studio lighting"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              <RotateCw size={14} className={isBatchRendering ? 'animate-spin' : ''} />
              {isBatchRendering ? 'Rendering...' : 'Re-render Previews'}
            </button>

            <button
              type="button"
              onClick={() => AssetsService.openAssetsFolder()}
              className="btn-secondary"
              title="Open Vault Models folder in Windows Explorer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            >
              <FolderOpen size={15} /> Models Folder
            </button>

            <button
              type="button"
              onClick={handleImportClick}
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                backgroundColor: '#e87a24',
                borderColor: '#e87a24',
              }}
            >
              <Plus size={15} /> Import Model
            </button>
          </div>
        </div>

        {/* Folders Navigation Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', paddingRight: '4px' }}>
            <Folder size={13} color="#e87a24" />
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
              borderColor: selectedFolder === null ? '#e87a24' : 'rgba(255,255,255,0.08)',
              backgroundColor: selectedFolder === null ? 'rgba(232, 122, 36, 0.22)' : 'rgba(255,255,255,0.02)',
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
                  borderColor: selectedFolder === '' ? '#e87a24' : 'rgba(255,255,255,0.08)',
                  backgroundColor: selectedFolder === '' ? 'rgba(232, 122, 36, 0.22)' : 'rgba(255,255,255,0.02)',
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
                  borderColor: isSelected ? '#e87a24' : 'rgba(255,255,255,0.08)',
                  backgroundColor: isSelected ? 'rgba(232, 122, 36, 0.25)' : 'rgba(255,255,255,0.02)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <Folder size={12} color={isSelected ? '#fdba74' : '#94a3b8'} />
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
            title="Create new folder in 3D models vault"
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              border: '1px dashed rgba(232, 122, 36, 0.5)',
              backgroundColor: 'rgba(232, 122, 36, 0.08)',
              color: '#fdba74',
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
              backgroundColor: 'rgba(232, 122, 36, 0.1)',
              border: '1px solid rgba(232, 122, 36, 0.25)',
              fontSize: '0.775rem',
              color: '#fed7aa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={14} color="#fdba74" />
              <span>
                Active Folder:{' '}
                <strong style={{ color: '#ffffff' }}>
                  {selectedFolder === '' ? 'Root / Unsorted' : selectedFolder}
                </strong>
                {' '}({filteredAssets.length} model{filteredAssets.length === 1 ? '' : 's'})
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
                  color: '#fdba74',
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

        {/* Search, Filter Categories, and View Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Categories */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedCategory === cat ? '1px solid #e87a24' : '1px solid var(--border-subtle)',
                  backgroundColor: selectedCategory === cat ? 'rgba(232, 122, 36, 0.18)' : 'transparent',
                  color: selectedCategory === cat ? '#fdba74' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Search Box */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models, tags..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#161b26',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <div
              style={{
                display: 'flex',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#161b26',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid Card View"
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: viewMode === 'grid' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: viewMode === 'grid' ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table Specification View"
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: viewMode === 'table' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: viewMode === 'table' ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Multi-Select Staging Bar (Visible when items selected) */}
        {selectedAssetIds.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid var(--accent-indigo)',
              color: '#c7d2fe',
              fontSize: '0.825rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700 }}>{selectedAssetIds.length}</span> model(s) selected
              <button
                type="button"
                onClick={() => setSelectedAssetIds([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a5b4fc',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '0.75rem',
                }}
              >
                Clear selection
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isBatchRendering}
                onClick={() => handleBatchReRender(selectedAssetIds)}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#38bdf8',
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                }}
              >
                <RotateCw size={13} className={isBatchRendering ? 'animate-spin' : ''} />
                Re-render Selected ({selectedAssetIds.length})
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setBatchTargetFolder(selectedFolder || '');
                  setIsBatchMoveModalOpen(true);
                }}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Move size={14} /> Move to Folder
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleBatchDelete(true)}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#f87171',
                  borderColor: 'rgba(248, 113, 113, 0.4)',
                  backgroundColor: 'rgba(248, 113, 113, 0.1)',
                }}
              >
                <Trash2 size={13} /> Delete Selected ({selectedAssetIds.length}) & Remove from Cloud
              </button>

              <button
                type="button"
                onClick={() => setIsSceneModalOpen(true)}
                className="btn-primary"
                style={{
                  padding: '5px 12px',
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#6366f1',
                }}
              >
                <Layers size={14} /> Create Blender Scene from Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
            <RotateCw size={28} className="spin" color="#818cf8" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading 3D asset library...</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '380px',
              padding: '40px',
              textAlign: 'center',
              border: '1px dashed var(--border-medium)',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(232, 122, 36, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Box size={32} color="#e87a24" />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
              {searchQuery || selectedCategory !== 'All' ? 'No matching models found' : 'No 3D Models in Library Yet'}
            </h3>
            <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
              {searchQuery || selectedCategory !== 'All'
                ? 'Try broadening your search or switching categories.'
                : 'Send completed Blender (.blend) files to Albaqros to render standardized 3/4 isometric previews and organize them for scene composition.'}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleImportClick}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#e87a24' }}
              >
                <Plus size={16} /> Import Blender Model
              </button>
              <button
                type="button"
                onClick={() => AssetsService.openAssetsFolder()}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FolderOpen size={16} /> Open Models Folder
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px',
            }}
          >
            {filteredAssets.map((asset) => {
              const isSelected = selectedAssetIds.includes(asset.id);
              const isRendering = renderingAssetId === asset.id;

              return (
                <div
                  key={asset.id}
                  className="glass-panel"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: isSelected
                      ? '2px solid var(--accent-indigo)'
                      : '1px solid var(--border-subtle)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    cursor: 'pointer',
                    backgroundColor: '#12161f',
                  }}
                  onClick={() => handleOpenDetail(asset)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Top Preview Image Container (Square 1:1 with standardized 3/4 render) */}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      position: 'relative',
                      backgroundColor: '#0a0d13',
                      backgroundImage:
                        'radial-gradient(circle at center, rgba(30, 41, 59, 0.4) 0%, rgba(10, 13, 19, 0.95) 100%), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                      backgroundSize: '100% 100%, 20px 20px, 20px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {isRendering ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <RotateCw size={24} className="spin" color="#e87a24" />
                        <span style={{ fontSize: '0.75rem', color: '#fdba74', fontWeight: 600 }}>
                          Rendering 3/4 Preview...
                        </span>
                      </div>
                    ) : asset.previewUrl ? (
                      <img
                        src={asset.previewUrl}
                        alt={asset.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          padding: '12px',
                          transition: 'transform 0.25s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                        <Box size={36} color="var(--text-muted)" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Preview</span>
                      </div>
                    )}

                    {/* Top Left Checkbox for Multi-select */}
                    <div
                      style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}
                      onClick={(e) => toggleSelectAsset(asset.id, e)}
                    >
                      <button
                        type="button"
                        style={{
                          background: isSelected ? 'var(--accent-indigo)' : 'rgba(15, 23, 42, 0.75)',
                          border: isSelected ? 'none' : '1px solid rgba(255, 255, 255, 0.3)',
                          borderRadius: '6px',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#ffffff',
                          padding: 0,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} style={{ opacity: 0.5 }} />}
                      </button>
                    </div>

                    {/* Top Right Category Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        zIndex: 10,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid var(--border-medium)',
                        color: '#94a3b8',
                        fontSize: '0.675rem',
                        fontWeight: 700,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {asset.category || 'Props'}
                    </div>

                    {/* Standardized 3/4 Angle Marker Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        zIndex: 10,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        color: '#94a3b8',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Rendered in Standardized 3/4 Isometric Perspective"
                    >
                      <span>3/4 ISO</span>
                    </div>
                  </div>

                  {/* Card Information Body */}
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    <div>
                      <div
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={asset.name}
                      >
                        {asset.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.725rem',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {asset.fileName}
                      </div>
                    </div>

                    {/* Technical Specs Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {asset.metadata?.faceCount !== undefined && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#e2e8f0',
                            border: '1px solid var(--border-subtle)',
                            fontWeight: 600,
                          }}
                        >
                          🔷 {asset.metadata.faceCount.toLocaleString()} faces
                        </span>
                      )}

                      {asset.metadata?.dimensions && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#cbd5e1',
                            border: '1px solid var(--border-subtle)',
                          }}
                          title={`Dimensions: ${asset.metadata.dimensions.x}m x ${asset.metadata.dimensions.y}m x ${asset.metadata.dimensions.z}m`}
                        >
                          📐 {asset.metadata.dimensions.x}×{asset.metadata.dimensions.z}m
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {asset.tags && asset.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {asset.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.675rem',
                              color: '#818cf8',
                              fontWeight: 600,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                        {asset.tags.length > 3 && (
                          <span style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                            +{asset.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Card Actions Bottom Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 'auto',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleOpenInBlender(asset, e)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(232, 122, 36, 0.15)',
                          border: '1px solid rgba(232, 122, 36, 0.3)',
                          color: '#fb923c',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e87a24';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(232, 122, 36, 0.15)';
                          e.currentTarget.style.color = '#fb923c';
                        }}
                      >
                        <ExternalLink size={12} /> Open in Blender
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={(e) => handleCopyAppendScript(asset, e)}
                          title="Copy Blender Python append code snippet"
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', padding: 0 }}
                        >
                          {copiedId === asset.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleReRender(asset, e)}
                          title="Re-render 3/4 preview with materials"
                          disabled={isRendering}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', padding: 0 }}
                        >
                          <RotateCw size={14} className={isRendering ? 'animate-spin' : ''} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAsset(asset.id, true);
                          }}
                          title="Delete 3D Model (removes from disk and cloud)"
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', padding: 0, color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div
            className="glass-panel"
            style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#141822', borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px', width: '36px' }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0 ? (
                        <CheckSquare size={16} color="#818cf8" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th style={{ padding: '12px 14px', width: '64px' }}>Preview</th>
                  <th style={{ padding: '12px 14px' }}>Name & File</th>
                  <th style={{ padding: '12px 14px' }}>Category</th>
                  <th style={{ padding: '12px 14px' }}>Polygons</th>
                  <th style={{ padding: '12px 14px' }}>Vertices</th>
                  <th style={{ padding: '12px 14px' }}>Dimensions</th>
                  <th style={{ padding: '12px 14px' }}>Size</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const isSelected = selectedAssetIds.includes(asset.id);
                  return (
                    <tr
                      key={asset.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleOpenDetail(asset)}
                    >
                      <td style={{ padding: '10px 14px' }} onClick={(e) => toggleSelectAsset(asset.id, e)}>
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: isSelected ? 'var(--accent-indigo)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                      </td>

                      {/* Preview Thumbnail */}
                      <td style={{ padding: '8px 14px' }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '6px',
                            backgroundColor: '#0e121a',
                            border: '1px solid var(--border-subtle)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {asset.previewUrl ? (
                            <img src={asset.previewUrl} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <Box size={20} color="var(--text-muted)" />
                          )}
                        </div>
                      </td>

                      {/* Name & File */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{asset.name}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{asset.fileName}</div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            color: '#94a3b8',
                          }}
                        >
                          {asset.category || 'Props'}
                        </span>
                      </td>

                      {/* Faces */}
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                        {asset.metadata?.faceCount !== undefined ? asset.metadata.faceCount.toLocaleString() : '—'}
                      </td>

                      {/* Verts */}
                      <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>
                        {asset.metadata?.vertexCount !== undefined ? asset.metadata.vertexCount.toLocaleString() : '—'}
                      </td>

                      {/* Dimensions */}
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {asset.metadata?.dimensions
                          ? `${asset.metadata.dimensions.x} × ${asset.metadata.dimensions.y} × ${asset.metadata.dimensions.z}m`
                          : '—'}
                      </td>

                      {/* Size */}
                      <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {asset.fileSize ? `${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB` : '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={(e) => handleOpenInBlender(asset, e)}
                            className="btn-icon"
                            title="Open in Blender"
                            style={{ color: '#fb923c' }}
                          >
                            <ExternalLink size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopyAppendScript(asset, e)}
                            className="btn-icon"
                            title="Copy Append Snippet"
                          >
                            {copiedId === asset.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleReRender(asset, e)}
                            className="btn-icon"
                            disabled={renderingAssetId === asset.id}
                            title="Re-render 3/4 Preview with materials"
                          >
                            <RotateCw size={14} className={renderingAssetId === asset.id ? 'animate-spin' : ''} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAsset(asset.id, true);
                            }}
                            className="btn-icon"
                            title="Delete 3D Model (removes from disk and cloud)"
                          >
                            <Trash2 size={14} color="#ef4444" />
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

      {/* Asset Detail & Technical Specifications Modal */}
      {detailAsset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setDetailAsset(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              backgroundColor: '#11151f',
              borderRadius: '14px',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#161b26',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(232, 122, 36, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box size={18} color="#e87a24" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                    {detailAsset.name}
                  </h3>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{detailAsset.filePath}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenInBlender(detailAsset)}
                  className="btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#e87a24',
                    fontSize: '0.8rem',
                  }}
                >
                  <ExternalLink size={14} /> Open in Blender
                </button>
                <button
                  type="button"
                  onClick={() => setDetailAsset(null)}
                  className="btn-icon"
                  style={{ width: '32px', height: '32px' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Two Column Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '20px', padding: '20px', overflowY: 'auto' }}>
              {/* Left Column: Standardized 3/4 Preview Showcase */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: '10px',
                    backgroundColor: '#0a0d13',
                    backgroundImage:
                      'radial-gradient(circle at center, rgba(30, 41, 59, 0.5) 0%, rgba(10, 13, 19, 0.98) 100%), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
                    backgroundSize: '100% 100%, 20px 20px, 20px 20px',
                    border: '1px solid var(--border-medium)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {renderingAssetId === detailAsset.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <RotateCw size={32} className="spin" color="#e87a24" />
                      <span style={{ fontSize: '0.8rem', color: '#fdba74' }}>Rendering 3/4 Preview...</span>
                    </div>
                  ) : detailAsset.previewUrl ? (
                    <img
                      src={detailAsset.previewUrl}
                      alt={detailAsset.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '16px' }}
                    />
                  ) : (
                    <Box size={48} color="var(--text-muted)" style={{ opacity: 0.4 }} />
                  )}

                  <div
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.75)',
                      color: '#94a3b8',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}
                  >
                    Standard 3/4 Isometric Perspective
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleReRender(detailAsset)}
                    disabled={renderingAssetId === detailAsset.id}
                    className="btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.775rem' }}
                  >
                    <RotateCw size={13} className={renderingAssetId === detailAsset.id ? 'animate-spin' : ''} />
                    {renderingAssetId === detailAsset.id ? 'Rendering...' : 'Re-render with Materials'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyAppendScript(detailAsset)}
                    className="btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.775rem' }}
                  >
                    {copiedId === detailAsset.id ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    <span>Copy Append Code</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Technical Specifications & Metadata Editing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Technical Specs Strip */}
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Polygon / Face Count</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                      {detailAsset.metadata?.faceCount?.toLocaleString() || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vertex Count</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                      {detailAsset.metadata?.vertexCount?.toLocaleString() || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bounding Dimensions</span>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                      {detailAsset.metadata?.dimensions
                        ? `${detailAsset.metadata.dimensions.x}m × ${detailAsset.metadata.dimensions.y}m × ${detailAsset.metadata.dimensions.z}m`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mesh Objects</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                      {detailAsset.metadata?.objectCount || 1}
                    </div>
                  </div>
                  {detailAsset.metadata?.materials && detailAsset.metadata.materials.length > 0 && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Materials:</span>{' '}
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {detailAsset.metadata.materials.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Edit Fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Asset Title
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: '#161b26',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Category
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: '#161b26',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                      }}
                    >
                      {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Folder Selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Vault Folder / Location
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={editFolder}
                        onChange={(e) => setEditFolder(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-medium)',
                          backgroundColor: '#161b26',
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
                        className="btn-secondary"
                        onClick={() => {
                          const name = window.prompt('Enter new folder name:');
                          if (name && name.trim()) {
                            const clean = name.trim().replace(/[\\:*?"<>|]/g, '');
                            AssetsService.createFolder(clean).then((res) => {
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

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="#character, #lowpoly, #props"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: '#161b26',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Technical Notes / Scene Ideas
                    </label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="Notes on rigging, UV maps, shader nodes, poly budgets..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: '#161b26',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteAsset(detailAsset.id, true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '0.775rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Trash2 size={13} /> Delete Model & Remove from Cloud
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDetailEdits}
                    className="btn-primary"
                    disabled={isSavingEdit}
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scene Assembler Modal */}
      {isSceneModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1150,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setIsSceneModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#11151f',
              borderRadius: '12px',
              border: '1px solid var(--accent-indigo)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={20} color="#818cf8" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Assemble Blender Scene
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Compose {selectedAssetIds.length} assets into a new .blend scene
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Albaqros will create a new scene in your Vault, append all selected model objects organized into clean collections, arrange them along the studio floor, and launch Blender!
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#ffffff', marginBottom: '6px' }}>
                Scene Name
              </label>
              <input
                type="text"
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                placeholder="e.g. Town_Square_Scene"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#161b26',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setIsSceneModalOpen(false)}
                className="btn-secondary"
                disabled={isAssembling}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssembleScene}
                className="btn-primary"
                disabled={isAssembling}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#6366f1' }}
              >
                {isAssembling ? (
                  <>
                    <RotateCw size={14} className="spin" /> Assembling...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> Assemble & Open in Blender
                  </>
                )}
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
              border: '1px solid #e87a24',
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
                  backgroundColor: 'rgba(232, 122, 36, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fdba74',
                }}
              >
                <FolderPlus size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Create New Folder
                </h3>
                <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                  Organize your 3D models into categorized subfolders
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
                  placeholder="e.g. Characters, Vehicles, Weapons"
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
                  className="btn-secondary"
                  onClick={() => setIsNewFolderModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ backgroundColor: '#e87a24', borderColor: '#e87a24' }}
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
                  Move {selectedAssetIds.length} Model{selectedAssetIds.length === 1 ? '' : 's'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                  Choose destination folder in models vault
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
                className="btn-secondary"
                onClick={() => setIsBatchMoveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBatchMove}
                style={{ backgroundColor: '#e87a24', borderColor: '#e87a24' }}
              >
                Move Models
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
