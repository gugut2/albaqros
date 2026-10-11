import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FolderGit2,
  FolderOpen,
  Plus,
  Search,
  Play,
  Terminal,
  Archive,
  Download,
  Upload,
  Trash2,
  Edit2,
  ExternalLink,
  Layers,
  Box,
  Sparkles,
  Package,
  Tag,
  Check,
  Copy,
  FileText,
  FileCode,
  Folder,
  RefreshCw,
  SlidersHorizontal,
  HardDrive,
  Cloud,
  Laptop,
  ChevronRight,
  Info,
  X,
  LayoutGrid,
  List,
  AlertCircle,
  File,
  Code,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { ProjectWorkspace, ProjectType, ProjectStatus, ProjectFileEntry } from '../types';
import { ProjectsService } from '../services/projectsService';

interface ProjectsStudioViewProps {
  isStudioSidebarCollapsed?: boolean;
  onToggleStudioSidebar?: () => void;
  vaultPath?: string;
  vaultName?: string;
}

const CATEGORIES = [
  'All',
  'Game Dev',
  '3D Art & Animation',
  'Tools & Software',
  'Audio & VFX',
  'Experiments',
  'Other',
];

const PROJECT_TYPES: { id: ProjectType | 'all'; label: string; color: string; bg: string }[] = [
  { id: 'all', label: 'All Projects', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.15)' },
  { id: 'godot', label: 'Godot', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
  { id: 'blender', label: 'Blender', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' },
  { id: 'unity', label: 'Unity', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
  { id: 'unreal', label: 'Unreal', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)' },
  { id: 'web', label: 'Web / JS', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' },
  { id: 'python', label: 'Python', color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)' },
  { id: 'custom', label: 'Custom', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const ProjectsStudioView: React.FC<ProjectsStudioViewProps> = ({
  vaultPath,
  vaultName = 'Active Vault',
}) => {
  const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
  const [projectsDir, setProjectsDir] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<ProjectType | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'lastOpened' | 'name' | 'size'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [detailProject, setDetailProject] = useState<ProjectWorkspace | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'dependencies' | 'files' | 'notes'>('overview');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // New Project Form State
  const [newProjName, setNewProjName] = useState<string>('');
  const [newProjType, setNewProjType] = useState<ProjectType>('godot');
  const [newProjCategory, setNewProjCategory] = useState<string>('Game Dev');
  const [newProjTags, setNewProjTags] = useState<string>('');
  const [newProjNotes, setNewProjNotes] = useState<string>('');

  // Import Form State
  const [importFolderPath, setImportFolderPath] = useState<string>('');
  const [importName, setImportName] = useState<string>('');
  const [importCategory, setImportCategory] = useState<string>('Game Dev');
  const [importCopyToVault, setImportCopyToVault] = useState<boolean>(true);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // File explorer in details
  const [projectFiles, setProjectFiles] = useState<ProjectFileEntry[]>([]);
  const [currentSubpath, setCurrentSubpath] = useState<string>('');
  const [selectedFileContent, setSelectedFileContent] = useState<{ path: string; text: string } | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);

  // Detail Edit State
  const [editNotesText, setEditNotesText] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ProjectsService.listProjects();
      if (res.success) {
        setProjects(res.projects || []);
        if (res.projectsDir) setProjectsDir(res.projectsDir);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  // Filter and sort
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (selectedType !== 'all' && p.type !== selectedType) return false;
        if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
        if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchTags = p.tags.some((t) => t.toLowerCase().includes(q));
          const matchNotes = (p.notes || '').toLowerCase().includes(q);
          const matchCategory = p.category.toLowerCase().includes(q);
          if (!matchName && !matchTags && !matchNotes && !matchCategory) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'size') return (b.totalSizeBytes || 0) - (a.totalSizeBytes || 0);
        if (sortBy === 'lastOpened') {
          const aTime = a.lastOpenedAt ? new Date(a.lastOpenedAt).getTime() : 0;
          const bTime = b.lastOpenedAt ? new Date(b.lastOpenedAt).getTime() : 0;
          return bTime - aTime;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [projects, selectedType, selectedCategory, selectedStatus, searchQuery, sortBy]);

  // Load project files when switching to files tab in detail modal
  useEffect(() => {
    if (detailProject && detailTab === 'files') {
      loadProjectFiles(detailProject.id, currentSubpath);
    }
  }, [detailProject, detailTab, currentSubpath]);

  const loadProjectFiles = async (projId: string, subpath: string = '') => {
    setIsLoadingFiles(true);
    try {
      const res = await ProjectsService.listFiles(projId, subpath);
      if (res.success) {
        setProjectFiles(res.files || []);
      }
    } catch (e) {
      console.error('Error loading files:', e);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    setActionInProgress('Creating project scaffold in vault...');
    try {
      const tags = newProjTags
        .split(/[,\s]+/)
        .map((t) => (t.startsWith('#') ? t : `#${t}`))
        .filter((t) => t.length > 1);

      const res = await ProjectsService.createProject({
        name: newProjName.trim(),
        type: newProjType,
        category: newProjCategory,
        tags,
        notes: newProjNotes,
      });

      if (res.success && res.project) {
        showNotice(`Project "${res.project.name}" initialized in Vault! All files sync across machines.`);
        setIsNewProjectModalOpen(false);
        setNewProjName('');
        setNewProjNotes('');
        setNewProjTags('');
        loadProjects();
      } else {
        alert(res.error || 'Failed to create project');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating project');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSelectImportFolder = async () => {
    const res = await ProjectsService.selectProjectFolder();
    if (res.success && res.folderPath) {
      setImportFolderPath(res.folderPath);
      // Auto-populate name from folder basename
      const parts = res.folderPath.replace(/\\/g, '/').split('/');
      const last = parts[parts.length - 1] || 'Imported Project';
      setImportName(last.replace(/[-_]/g, ' '));
    }
  };

  const handleImportProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFolderPath.trim()) return;

    setIsImporting(true);
    setActionInProgress('Copying project and all dependencies into vault...');
    try {
      const res = await ProjectsService.importProject({
        sourcePath: importFolderPath,
        name: importName.trim() || undefined,
        category: importCategory,
        copyToVault: importCopyToVault,
      });

      if (res.success && res.project) {
        showNotice(`Project "${res.project.name}" saved to Vault with all dependencies!`);
        setIsImportModalOpen(false);
        setImportFolderPath('');
        setImportName('');
        loadProjects();
      } else {
        alert(res.error || 'Failed to import project');
      }
    } catch (err: any) {
      alert(err.message || 'Error importing project');
    } finally {
      setIsImporting(false);
      setActionInProgress(null);
    }
  };

  const handleOpenProject = async (projectId: string, method: 'default' | 'godot' | 'blender' | 'code' | 'explorer' | 'terminal' = 'default') => {
    try {
      const res = await ProjectsService.openProject(projectId, method);
      if (res.success) {
        showNotice('Project launched!');
        loadProjects(); // refresh lastOpened timestamp
      } else {
        showNotice(`Note: ${res.error || 'Could not launch directly'}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenFolder = async (projectId: string) => {
    await ProjectsService.openFolder(projectId);
  };

  const handleOpenTerminal = async (projectId: string) => {
    await ProjectsService.openTerminal(projectId);
    showNotice('Terminal opened in project folder');
  };

  const handleExportZip = async (projectId: string) => {
    setActionInProgress('Packaging project & dependencies into standalone ZIP...');
    try {
      const res = await ProjectsService.exportZip(projectId);
      if (res.success && res.zipPath) {
        showNotice(`Exported portable bundle to ${res.zipPath}`);
      } else if (!res.canceled) {
        alert(res.error || 'Failed to export zip');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleImportZip = async () => {
    setActionInProgress('Extracting project bundle into vault...');
    try {
      const res = await ProjectsService.importZip();
      if (res.success && res.project) {
        showNotice(`Imported project "${res.project.name}" into Vault with all dependencies!`);
        loadProjects();
      } else if (!res.canceled) {
        alert(res.error || 'Failed to import zip archive');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteProject = async (projectId: string, projName: string) => {
    const confirmDelete = window.confirm(
      `Remove "${projName}" from Albaqros Projects?\n\nClick OK to confirm. You will be asked next whether to keep or delete files on disk.`
    );
    if (!confirmDelete) return;

    const deleteDiskFiles = window.confirm(
      `Do you also want to permanently delete the project files on disk?\n\n- Click 'OK' to delete files from disk.\n- Click 'Cancel' to ONLY remove it from Albaqros (files stay on disk).`
    );

    const res = await ProjectsService.deleteProject(projectId, deleteDiskFiles);
    if (res.success) {
      showNotice(`Project removed${deleteDiskFiles ? ' and files deleted' : ''}.`);
      if (detailProject?.id === projectId) setDetailProject(null);
      loadProjects();
    } else {
      alert(res.error || 'Failed to delete project');
    }
  };

  const handleOpenVaultFolder = async () => {
    await ProjectsService.openVaultProjectsFolder();
  };

  const handleFileClick = async (file: ProjectFileEntry) => {
    if (!detailProject) return;
    if (file.isDirectory) {
      setCurrentSubpath(file.relativePath);
    } else {
      // Preview text file
      const textExts = ['.gd', '.txt', '.md', '.json', '.cfg', '.ini', '.js', '.ts', '.py', '.shader', '.gdshader', '.csv', '.xml', '.yml', '.yaml'];
      if (textExts.includes(file.extension || '')) {
        const res = await ProjectsService.readFile(detailProject.id, file.relativePath);
        if (res.success && res.content !== undefined) {
          setSelectedFileContent({ path: file.relativePath, text: res.content });
        } else {
          showNotice(res.error || 'Could not preview file content');
        }
      } else {
        showNotice(`Binary file: ${file.name} (${formatBytes(file.sizeBytes || 0)})`);
      }
    }
  };

  const handleSaveNotes = async () => {
    if (!detailProject) return;
    setIsSavingNotes(true);
    try {
      const res = await ProjectsService.updateProject({
        ...detailProject,
        notes: editNotesText,
      });
      if (res.success && res.project) {
        setDetailProject(res.project);
        showNotice('Project notes saved!');
        loadProjects();
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  const getTypeBadge = (type: ProjectType) => {
    switch (type) {
      case 'godot':
        return { label: 'Godot Engine', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
      case 'blender':
        return { label: 'Blender 3D', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.3)' };
      case 'unity':
        return { label: 'Unity', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)', border: 'rgba(167, 139, 250, 0.3)' };
      case 'unreal':
        return { label: 'Unreal Engine', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.3)' };
      case 'web':
        return { label: 'Web / Node', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', border: 'rgba(52, 211, 153, 0.3)' };
      case 'python':
        return { label: 'Python', color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.3)' };
      default:
        return { label: 'Custom Project', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-primary, #0f172a)',
        color: 'var(--text-primary, #f8fafc)',
        overflow: 'hidden',
      }}
    >
      {/* Toast Notification */}
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.2)',
            backdropFilter: 'blur(12px)',
            color: '#f8fafc',
            padding: '12px 20px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '0.875rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <Sparkles size={16} color="#38bdf8" />
          <span>{notice}</span>
        </div>
      )}

      {/* Action Progress Overlay */}
      {actionInProgress && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              border: '3px solid rgba(56, 189, 248, 0.2)',
              borderTopColor: '#38bdf8',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
            {actionInProgress}
          </div>
        </div>
      )}

      {/* Header & Multi-Machine Sync Banner */}
      <div
        style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.3))',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                }}
              >
                <FolderGit2 size={20} />
              </div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Projects Vault
              </h1>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#7dd3fc',
                  fontWeight: 600,
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 44px', fontSize: '0.825rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Save entire Blender, Godot & creative code projects with all dependencies intact to open across machines.
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleOpenVaultFolder}
              title="Reveal vault projects folder in Windows Explorer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: '0.825rem',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
            >
              <FolderOpen size={15} />
              <span>Vault Folder</span>
            </button>

            <button
              type="button"
              onClick={handleImportZip}
              title="Import a project from a portable ZIP archive bundle"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: '0.825rem',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={15} />
              <span>Import ZIP</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '0.825rem',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              <Upload size={15} />
              <span>Import Folder</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewProjectModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '0.825rem',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={16} />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Multi-Machine Sync Banner */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#93c5fd' }}>
            <Laptop size={15} color="#38bdf8" />
            <span>
              <strong>Cross-Machine Portability:</strong> Projects are saved in <code>{vaultName}</code>. When you open Albaqros on another machine, all project files and dependencies are preserved and dynamically resolved.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#cbd5e1' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <HardDrive size={13} color="#94a3b8" />
              Total Vault Size: <strong>{formatBytes(projects.reduce((acc, p) => acc + (p.totalSizeBytes || 0), 0))}</strong>
            </span>
            <button
              type="button"
              onClick={loadProjects}
              title="Refresh project files from disk"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.775rem',
              }}
            >
              <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
        }}
      >
        {/* Project Types Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {PROJECT_TYPES.map((t) => {
            const isActive = selectedType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: isActive ? `1px solid ${t.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                  backgroundColor: isActive ? t.bg : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              placeholder="Search projects, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 10px 6px 30px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: '0.8rem',
                outline: 'none',
                width: '180px',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} style={{ backgroundColor: '#1e293b', color: '#f8fafc' }}>
                {c === 'All' ? 'All Categories' : c}
              </option>
            ))}
          </select>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="updated" style={{ backgroundColor: '#1e293b' }}>Last Updated</option>
            <option value="lastOpened" style={{ backgroundColor: '#1e293b' }}>Last Opened</option>
            <option value="name" style={{ backgroundColor: '#1e293b' }}>Name (A-Z)</option>
            <option value="size" style={{ backgroundColor: '#1e293b' }}>Size (Largest)</option>
          </select>

          {/* View Mode Toggle */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'rgba(255, 255, 255, 0.15)' : 'none',
                border: 'none',
                color: viewMode === 'grid' ? '#ffffff' : '#64748b',
                padding: '4px 8px',
                borderRadius: '6px',
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
              style={{
                background: viewMode === 'table' ? 'rgba(255, 255, 255, 0.15)' : 'none',
                border: 'none',
                color: viewMode === 'table' ? '#ffffff' : '#64748b',
                padding: '4px 8px',
                borderRadius: '6px',
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

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {filteredProjects.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '360px',
              textAlign: 'center',
              padding: '40px',
              borderRadius: '16px',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              margin: '20px 0',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                marginBottom: '16px',
              }}
            >
              <FolderGit2 size={32} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 600 }}>
              {searchQuery ? 'No matching projects found' : 'Your Portable Projects Vault is Empty'}
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#94a3b8', maxWidth: '480px', lineHeight: 1.5 }}>
              {searchQuery
                ? `No projects matched "${searchQuery}". Try adjusting your filters.`
                : 'Save your entire Godot games, Blender animation scenes, or creative software projects right in Albaqros. All scenes, textures, addons, and dependencies are packed and sync across all your computers.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setNewProjType('godot');
                  setIsNewProjectModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} />
                <span>New Godot Project</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewProjType('blender');
                  setIsNewProjectModalOpen(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(251, 146, 60, 0.15)',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  color: '#fb923c',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={15} />
                <span>New Blender Project</span>
              </button>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Upload size={15} />
                <span>Import Existing Folder</span>
              </button>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {filteredProjects.map((project) => {
              const typeBadge = getTypeBadge(project.type);
              return (
                <div
                  key={project.id}
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.6)',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(8px)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                    e.currentTarget.style.boxShadow = '0 12px 24px -6px rgba(0, 0, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Card Header & Preview */}
                  <div
                    style={{
                      height: '110px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Background glow or preview */}
                    {project.previewUrl ? (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: `url(${project.previewUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          opacity: 0.25,
                          filter: 'blur(4px)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: `radial-gradient(circle at 50% 50%, ${typeBadge.bg}, transparent 70%)`,
                        }}
                      />
                    )}

                    {/* Main Thumbnail Icon */}
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      {project.previewUrl ? (
                        <img
                          src={project.previewUrl}
                          alt={project.name}
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            objectFit: 'contain',
                            backgroundColor: 'rgba(15, 23, 42, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            padding: '4px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            backgroundColor: typeBadge.bg,
                            border: `1px solid ${typeBadge.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: typeBadge.color,
                          }}
                        >
                          {project.type === 'godot' ? (
                            <FolderGit2 size={28} />
                          ) : project.type === 'blender' ? (
                            <Box size={28} />
                          ) : project.type === 'web' ? (
                            <FileCode size={28} />
                          ) : (
                            <Layers size={28} />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Top Right Badges */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        display: 'flex',
                        gap: '6px',
                        zIndex: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.675rem',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: typeBadge.bg,
                          color: typeBadge.color,
                          fontWeight: 600,
                          border: `1px solid ${typeBadge.border}`,
                        }}
                      >
                        {typeBadge.label}
                      </span>
                    </div>

                    {/* Top Left Sync Pill */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#6ee7b7',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        zIndex: 3,
                      }}
                    >
                      <Cloud size={11} />
                      <span>In Vault</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    <div>
                      <div
                        onClick={() => {
                          setDetailProject(project);
                          setEditNotesText(project.notes || '');
                        }}
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {project.name}
                        </span>
                        <ChevronRight size={16} color="#64748b" />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {project.engineVersion || typeBadge.label} &bull; {project.category}
                      </div>
                    </div>

                    {/* Disk / Files Stats Bar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        fontSize: '0.75rem',
                        color: '#cbd5e1',
                      }}
                    >
                      <span>
                        Size: <strong>{formatBytes(project.totalSizeBytes)}</strong>
                      </span>
                      <span>
                        Files: <strong>{project.fileCount}</strong>
                      </span>
                      {project.dependencies?.length > 0 && (
                        <span style={{ color: '#38bdf8' }}>
                          Deps: <strong>{project.dependencies.length}</strong>
                        </span>
                      )}
                      {project.hasGit && (
                        <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Code size={11} /> Git
                        </span>
                      )}
                    </div>

                    {/* Dependencies / Tags Pills */}
                    {project.dependencies?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {project.dependencies.slice(0, 3).map((dep, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.675rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(56, 189, 248, 0.1)',
                              color: '#7dd3fc',
                              border: '1px solid rgba(56, 189, 248, 0.2)',
                            }}
                          >
                            📦 {dep.name}
                          </span>
                        ))}
                        {project.dependencies.length > 3 && (
                          <span style={{ fontSize: '0.675rem', color: '#64748b', alignSelf: 'center' }}>
                            +{project.dependencies.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {project.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {project.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.675rem',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              color: '#94a3b8',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div
                      style={{
                        marginTop: 'auto',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenProject(project.id)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.8), rgba(37, 99, 235, 0.8))',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.775rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Play size={13} />
                        <span>Open Project</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenFolder(project.id)}
                        title="Reveal project folder in Windows Explorer"
                        style={{
                          padding: '7px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FolderOpen size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenTerminal(project.id)}
                        title="Open PowerShell terminal in project folder"
                        style={{
                          padding: '7px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Terminal size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportZip(project.id)}
                        title="Export portable ZIP archive (with all dependencies)"
                        style={{
                          padding: '7px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Archive size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div
            style={{
              backgroundColor: 'rgba(30, 41, 59, 0.5)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>Project Name</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Size</th>
                  <th style={{ padding: '12px 16px' }}>Files</th>
                  <th style={{ padding: '12px 16px' }}>Dependencies</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
                  const typeBadge = getTypeBadge(project.type);
                  return (
                    <tr
                      key={project.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <div
                          onClick={() => {
                            setDetailProject(project);
                            setEditNotesText(project.notes || '');
                          }}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <FolderGit2 size={16} color={typeBadge.color} />
                          <span>{project.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: '0.725rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: typeBadge.bg,
                            color: typeBadge.color,
                            fontWeight: 600,
                          }}
                        >
                          {typeBadge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{project.category}</td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{formatBytes(project.totalSizeBytes)}</td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{project.fileCount}</td>
                      <td style={{ padding: '12px 16px', color: '#38bdf8' }}>
                        {project.dependencies?.length || 0}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: '0.725rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#6ee7b7',
                          }}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenProject(project.id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(2, 132, 199, 0.2)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#38bdf8',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            Launch
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(project.id)}
                            title="Reveal in Explorer"
                            style={{
                              padding: '5px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: 'none',
                              color: '#cbd5e1',
                              cursor: 'pointer',
                            }}
                          >
                            <FolderOpen size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportZip(project.id)}
                            title="Export ZIP"
                            style={{
                              padding: '5px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              border: 'none',
                              color: '#cbd5e1',
                              cursor: 'pointer',
                            }}
                          >
                            <Archive size={14} />
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

      {/* ======================================================== */}
      {/* Detail / Inspector Modal */}
      {/* ======================================================== */}
      {detailProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              backgroundColor: '#1e293b',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: getTypeBadge(detailProject.type).bg,
                    border: `1px solid ${getTypeBadge(detailProject.type).border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: getTypeBadge(detailProject.type).color,
                  }}
                >
                  <FolderGit2 size={22} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                    {detailProject.name}
                  </h2>
                  <div style={{ fontSize: '0.775rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{detailProject.engineVersion || getTypeBadge(detailProject.type).label}</span>
                    <span>&bull;</span>
                    <span style={{ color: '#6ee7b7' }}>Saved in Vault (Multi-Machine Synced)</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenProject(detailProject.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Play size={14} />
                  <span>Launch</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailProject(null)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0 24px',
                backgroundColor: 'rgba(15, 23, 42, 0.3)',
              }}
            >
              {[
                { id: 'overview', label: 'Overview & Sync' },
                { id: 'dependencies', label: `Dependencies (${detailProject.dependencies?.length || 0})` },
                { id: 'files', label: 'In-App File Explorer' },
                { id: 'notes', label: 'Devlog & Design Notes' },
              ].map((tab) => {
                const isActive = detailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDetailTab(tab.id as any)}
                    style={{
                      padding: '12px 18px',
                      background: 'none',
                      border: 'none',
                      borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                      color: isActive ? '#ffffff' : '#94a3b8',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Tab Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {detailTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Portability Info Card */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(2, 132, 199, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 600, fontSize: '0.9rem' }}>
                      <Laptop size={17} />
                      <span>Multi-Machine Portability Architecture</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                      This project lives in your Albaqros Vault at <code>projects/{detailProject.slug}</code>. Because the entire directory is stored in your vault, any cloud synchronization (OneDrive, Google Drive, Dropbox, iCloud) or external drive automatically replicates all scenes, code, and dependencies. Albaqros automatically anchors the file paths for whichever computer you are currently using.
                    </p>
                    <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#94a3b8' }}>
                      Current Machine Path: <code>{detailProject.path}</code>
                    </div>
                  </div>

                  {/* Project Specs Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Total Disk Size</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{formatBytes(detailProject.totalSizeBytes)}</div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Total Files</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{detailProject.fileCount} files ({detailProject.folderCount} folders)</div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Primary Launch File</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#38bdf8' }}>{detailProject.primaryFile || 'Root Directory'}</div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Git Source Control</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: detailProject.hasGit ? '#34d399' : '#94a3b8' }}>
                        {detailProject.hasGit ? 'Enabled (.git)' : 'None'}
                      </div>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenFolder(detailProject.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}
                    >
                      <FolderOpen size={16} />
                      <span>Open in Windows Explorer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenTerminal(detailProject.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}
                    >
                      <Terminal size={16} />
                      <span>Open Terminal / PowerShell</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportZip(detailProject.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}
                    >
                      <Archive size={16} />
                      <span>Export Portable ZIP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteProject(detailProject.id, detailProject.name)}
                      style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}
                    >
                      <Trash2 size={16} />
                      <span>Delete Project</span>
                    </button>
                  </div>
                </div>
              )}

              {detailTab === 'dependencies' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Albaqros scans your project directories to detect addons, plugins, and dependencies packaged with the project.
                  </div>

                  {detailProject.dependencies?.length === 0 ? (
                    <div
                      style={{
                        padding: '30px',
                        textAlign: 'center',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                        color: '#94a3b8',
                        fontSize: '0.875rem',
                      }}
                    >
                      No external package or addon dependencies detected. The project is self-contained.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {detailProject.dependencies.map((dep, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '14px 18px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(15, 23, 42, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Package size={16} color="#38bdf8" />
                              <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{dep.name}</strong>
                              {dep.version && (
                                <span
                                  style={{
                                    fontSize: '0.725rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                    color: '#7dd3fc',
                                  }}
                                >
                                  v{dep.version}
                                </span>
                              )}
                            </div>
                            {dep.description && (
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                                {dep.description}
                              </div>
                            )}
                            {dep.path && (
                              <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '2px' }}>
                                Location: <code>{dep.path}</code>
                              </div>
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: '0.725rem',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#6ee7b7',
                              fontWeight: 600,
                            }}
                          >
                            Ready in Vault
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'files' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Breadcrumb navigation */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    }}
                  >
                    <span
                      onClick={() => setCurrentSubpath('')}
                      style={{ cursor: 'pointer', color: '#38bdf8', fontWeight: 600 }}
                    >
                      {detailProject.slug}
                    </span>
                    {currentSubpath && (
                      <>
                        <span>/</span>
                        <span>{currentSubpath}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const parts = currentSubpath.split('/');
                            parts.pop();
                            setCurrentSubpath(parts.join('/'));
                          }}
                          style={{
                            marginLeft: 'auto',
                            background: 'none',
                            border: 'none',
                            color: '#38bdf8',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          &uarr; Up One Level
                        </button>
                      </>
                    )}
                  </div>

                  {/* Files List & Preview Pane */}
                  <div style={{ display: 'flex', gap: '16px', minHeight: '300px' }}>
                    <div
                      style={{
                        flex: 1,
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                        overflowY: 'auto',
                        maxHeight: '380px',
                      }}
                    >
                      {isLoadingFiles ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Loading files...</div>
                      ) : projectFiles.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Empty directory</div>
                      ) : (
                        projectFiles.map((file, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleFileClick(file)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 14px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                              cursor: 'pointer',
                              fontSize: '0.825rem',
                              transition: 'background-color 0.1s ease',
                              backgroundColor: selectedFileContent?.path === file.relativePath ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                selectedFileContent?.path === file.relativePath ? 'rgba(56, 189, 248, 0.15)' : 'transparent')
                            }
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {file.isDirectory ? (
                                <Folder size={15} color="#38bdf8" />
                              ) : (
                                <File size={15} color="#94a3b8" />
                              )}
                              <span style={{ fontWeight: file.isDirectory ? 600 : 400, color: file.isDirectory ? '#f8fafc' : '#cbd5e1' }}>
                                {file.name}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                              {file.isDirectory ? 'Folder' : formatBytes(file.sizeBytes || 0)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Quick File Preview */}
                    {selectedFileContent && (
                      <div
                        style={{
                          flex: 1.2,
                          borderRadius: '10px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            fontSize: '0.75rem',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>{selectedFileContent.path}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedFileContent(null)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <pre
                          style={{
                            flex: 1,
                            margin: 0,
                            padding: '12px',
                            overflowY: 'auto',
                            fontSize: '0.75rem',
                            fontFamily: 'Consolas, monospace',
                            color: '#e2e8f0',
                            lineHeight: 1.5,
                            maxHeight: '340px',
                          }}
                        >
                          {selectedFileContent.text}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    Keep project design documents, controls, technical reflections, or devlogs saved right alongside your project.
                  </div>
                  <textarea
                    rows={12}
                    value={editNotesText}
                    onChange={(e) => setEditNotesText(e.target.value)}
                    placeholder="# Project Design & Notes&#10;&#10;Write markdown documentation here..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      fontFamily: 'Consolas, monospace',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isSavingNotes ? 'Saving...' : 'Save Devlog Notes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* New Project Modal */}
      {/* ======================================================== */}
      {isNewProjectModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#1e293b',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Initialize New Project</h3>
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProject} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Spooky Dungeon Crawler, Mech Animation"
                  value={newProjName}
                  onChange={(e) => setNewProjName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                  Project Type / Engine
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'godot', label: 'Godot 4.x Game', desc: 'project.godot, scenes, scripts & addons' },
                    { id: 'blender', label: 'Blender 3D Project', desc: 'scenes, textures, renders & cache' },
                    { id: 'web', label: 'Web / Creative App', desc: 'package.json, src & dev tooling' },
                    { id: 'custom', label: 'Custom Project', desc: 'Clean workspace & design documentation' },
                  ].map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setNewProjType(t.id as any)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: newProjType === t.id ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: newProjType === t.id ? 'rgba(56, 189, 248, 0.1)' : 'rgba(15, 23, 42, 0.4)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.825rem', color: newProjType === t.id ? '#38bdf8' : '#f8fafc' }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '2px' }}>
                        {t.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                    Category
                  </label>
                  <select
                    value={newProjCategory}
                    onChange={(e) => setNewProjCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c} style={{ backgroundColor: '#1e293b' }}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                    Tags (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. #rpg, #lowpoly"
                    value={newProjTags}
                    onChange={(e) => setNewProjTags(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                  Initial Project Notes / Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Goals, mechanics, polycount budget, or ideas..."
                  value={newProjNotes}
                  onChange={(e) => setNewProjNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: '#cbd5e1',
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Create Project in Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Import Project Modal */}
      {/* ======================================================== */}
      {isImportModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#1e293b',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Import Existing Project</h3>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportProject} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                  Select Project Folder *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    required
                    readOnly
                    placeholder="Click Browse to select folder..."
                    value={importFolderPath}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#f8fafc',
                      fontSize: '0.825rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSelectImportFolder}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Browse...
                  </button>
                </div>
              </div>

              {importFolderPath && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                      Project Display Name
                    </label>
                    <input
                      type="text"
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>
                      Category
                    </label>
                    <select
                      value={importCategory}
                      onChange={(e) => setImportCategory(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(15, 23, 42, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        outline: 'none',
                      }}
                    >
                      {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                        <option key={c} value={c} style={{ backgroundColor: '#1e293b' }}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Multi-Machine Copy Toggle */}
                  <div
                    onClick={() => setImportCopyToVault(!importCopyToVault)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: importCopyToVault ? 'rgba(2, 132, 199, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                      border: importCopyToVault ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={importCopyToVault}
                      onChange={() => {}}
                      style={{ marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f8fafc' }}>
                        Copy into Albaqros Vault (Recommended for Multi-Machine Sync)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                        Copies all project files and dependencies into your active vault. This ensures the project will open seamlessly on any other computer you use.
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: '#cbd5e1',
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importFolderPath || isImporting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: !importFolderPath || isImporting ? 0.6 : 1,
                  }}
                >
                  {isImporting ? 'Importing...' : 'Save Project to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
