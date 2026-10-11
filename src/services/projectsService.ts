import { ProjectWorkspace, ProjectFileEntry, ProjectType } from '../types';

const FALLBACK_PROJECTS_KEY = 'albaqros_projects_workspaces_v1';

function getFallbackProjects(): ProjectWorkspace[] {
  try {
    const raw = localStorage.getItem(FALLBACK_PROJECTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return [
    {
      id: 'demo-proj-godot-dungeon',
      name: 'Crypt Crawler RPG',
      slug: 'crypt-crawler-rpg',
      type: 'godot',
      path: 'C:/AlbaqrosVault/projects/crypt-crawler-rpg',
      relativePath: 'crypt-crawler-rpg',
      isInsideVault: true,
      primaryFile: 'project.godot',
      previewUrl: '',
      totalSizeBytes: 1024 * 1024 * 148,
      fileCount: 142,
      folderCount: 18,
      category: 'Game Dev',
      tags: ['#godot4', '#pixelart', '#actionrpg'],
      status: 'active',
      engineVersion: 'Godot 4.3',
      hasGit: true,
      dependencies: [
        {
          name: 'dialogic',
          type: 'addon',
          version: '2.0-Alpha',
          path: 'addons/dialogic',
          description: 'Dialog & narrative system for Godot',
        },
        {
          name: 'phantom_camera',
          type: 'addon',
          version: '0.7.2',
          path: 'addons/phantom_camera',
          description: 'Advanced 2D/3D camera controller',
        },
      ],
      notes: '# Crypt Crawler RPG\n\nTop-down dungeon crawler prototype built in Godot 4.3.\n\n### Current Milestones\n- [x] Tilemap & Room generation\n- [ ] Player dash & melee attack\n- [ ] Inventory item pickups',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    },
    {
      id: 'demo-proj-blender-mech',
      name: 'Cyberpunk Titan Mech',
      slug: 'cyberpunk-titan-mech',
      type: 'blender',
      path: 'C:/AlbaqrosVault/projects/cyberpunk-titan-mech',
      relativePath: 'cyberpunk-titan-mech',
      isInsideVault: true,
      primaryFile: 'scenes/main.blend',
      previewUrl: '',
      totalSizeBytes: 1024 * 1024 * 420,
      fileCount: 68,
      folderCount: 8,
      category: '3D Art & Animation',
      tags: ['#blender', '#hardsurface', '#rigging'],
      status: 'in-progress',
      engineVersion: 'Blender 4.2',
      hasGit: false,
      dependencies: [
        {
          name: 'textures',
          type: 'asset',
          path: 'textures',
          description: '4K PBR Substance Painter maps',
        },
        {
          name: 'references',
          type: 'asset',
          path: 'references',
          description: 'Industrial hydraulics photo reference',
        },
      ],
      notes: '# Cyberpunk Titan Mech\n\nComplete hard-surface robot animation project with packed textures and FK/IK rigging.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    },
  ];
}

function saveFallbackProjects(projects: ProjectWorkspace[]) {
  try {
    localStorage.setItem(FALLBACK_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {}
}

export const ProjectsService = {
  async listProjects(): Promise<{
    success: boolean;
    projects: ProjectWorkspace[];
    projectsDir?: string;
    error?: string;
  }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.listProjects) {
      try {
        const res = await (window as any).electronAPI.projects.listProjects();
        if (res && res.success) {
          return { success: true, projects: res.projects || [], projectsDir: res.projectsDir };
        }
        return { success: false, projects: [], error: res?.error };
      } catch (err: any) {
        console.error('Error listing projects via Electron:', err);
        return { success: false, projects: [], error: err.message };
      }
    }

    return { success: true, projects: getFallbackProjects(), projectsDir: 'C:/AlbaqrosVault/projects' };
  },

  async selectProjectFolder(): Promise<{
    success: boolean;
    folderPath?: string;
    canceled?: boolean;
    error?: string;
  }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.selectProjectFolder) {
      try {
        return await (window as any).electronAPI.projects.selectProjectFolder();
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Folder selection is only available in the desktop application' };
  },

  async importProject(params: {
    sourcePath: string;
    name?: string;
    category?: string;
    tags?: string[];
    notes?: string;
    copyToVault?: boolean;
  }): Promise<{ success: boolean; project?: ProjectWorkspace; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.importProject) {
      try {
        return await (window as any).electronAPI.projects.importProject(params);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const projects = getFallbackProjects();
    const newProj: ProjectWorkspace = {
      id: 'demo-proj-' + Date.now(),
      name: params.name || 'Imported Project',
      slug: (params.name || 'imported-project').toLowerCase().replace(/\s+/g, '-'),
      type: 'custom',
      path: params.sourcePath,
      relativePath: (params.name || 'imported-project').toLowerCase().replace(/\s+/g, '-'),
      isInsideVault: params.copyToVault !== false,
      totalSizeBytes: 1024 * 1024 * 25,
      fileCount: 15,
      folderCount: 3,
      category: params.category || 'Tools & Software',
      tags: params.tags || ['#project'],
      status: 'active',
      dependencies: [],
      notes: params.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.unshift(newProj);
    saveFallbackProjects(projects);
    return { success: true, project: newProj };
  },

  async createProject(params: {
    name: string;
    type: ProjectType;
    category?: string;
    tags?: string[];
    notes?: string;
  }): Promise<{ success: boolean; project?: ProjectWorkspace; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.createProject) {
      try {
        return await (window as any).electronAPI.projects.createProject(params);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const projects = getFallbackProjects();
    const slug = params.name.toLowerCase().replace(/\s+/g, '-');
    const newProj: ProjectWorkspace = {
      id: 'demo-proj-' + Date.now(),
      name: params.name,
      slug,
      type: params.type,
      path: `C:/AlbaqrosVault/projects/${slug}`,
      relativePath: slug,
      isInsideVault: true,
      primaryFile: params.type === 'godot' ? 'project.godot' : (params.type === 'blender' ? 'scenes/main.blend' : (params.type === 'web' ? 'package.json' : 'README.md')),
      totalSizeBytes: 1024 * 24,
      fileCount: 4,
      folderCount: 2,
      category: params.category || (params.type === 'godot' ? 'Game Dev' : (params.type === 'blender' ? '3D Art & Animation' : 'Tools & Software')),
      tags: params.tags || [`#${params.type}`],
      status: 'active',
      dependencies: [],
      notes: params.notes || `# ${params.name}\n\nProject initialized in Albaqros.`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.unshift(newProj);
    saveFallbackProjects(projects);
    return { success: true, project: newProj };
  },

  async updateProject(
    project: ProjectWorkspace
  ): Promise<{ success: boolean; project?: ProjectWorkspace; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.updateProject) {
      try {
        return await (window as any).electronAPI.projects.updateProject(project);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const projects = getFallbackProjects();
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...project, updatedAt: new Date().toISOString() };
      saveFallbackProjects(projects);
      return { success: true, project: projects[idx] };
    }
    return { success: false, error: 'Project not found' };
  },

  async deleteProject(
    projectId: string,
    deleteFiles: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.deleteProject) {
      try {
        return await (window as any).electronAPI.projects.deleteProject(projectId, deleteFiles);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const projects = getFallbackProjects();
    const filtered = projects.filter((p) => p.id !== projectId);
    saveFallbackProjects(filtered);
    return { success: true };
  },

  async openProject(
    projectId: string,
    openMethod: 'default' | 'godot' | 'blender' | 'code' | 'explorer' | 'terminal' = 'default'
  ): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.openProject) {
      try {
        return await (window as any).electronAPI.projects.openProject(projectId, openMethod);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  },

  async openFolder(projectId: string): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.openFolder) {
      try {
        return await (window as any).electronAPI.projects.openFolder(projectId);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  },

  async openTerminal(projectId: string): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.openTerminal) {
      try {
        return await (window as any).electronAPI.projects.openTerminal(projectId);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  },

  async exportZip(projectId: string): Promise<{ success: boolean; zipPath?: string; canceled?: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.exportZip) {
      try {
        return await (window as any).electronAPI.projects.exportZip(projectId);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Exporting zip archives is only available in the desktop application' };
  },

  async importZip(): Promise<{ success: boolean; project?: ProjectWorkspace; canceled?: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.importZip) {
      try {
        return await (window as any).electronAPI.projects.importZip();
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Importing zip archives is only available in the desktop application' };
  },

  async listFiles(
    projectId: string,
    subpath: string = ''
  ): Promise<{ success: boolean; files: ProjectFileEntry[]; currentSubpath?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.listFiles) {
      try {
        return await (window as any).electronAPI.projects.listFiles(projectId, subpath);
      } catch (err: any) {
        return { success: false, files: [], error: err.message };
      }
    }
    return {
      success: true,
      files: [
        { name: 'project.godot', relativePath: 'project.godot', isDirectory: false, sizeBytes: 1024, extension: '.godot' },
        { name: 'scenes', relativePath: 'scenes', isDirectory: true },
        { name: 'scripts', relativePath: 'scripts', isDirectory: true },
        { name: 'README.md', relativePath: 'README.md', isDirectory: false, sizeBytes: 512, extension: '.md' },
      ],
      currentSubpath: subpath,
    };
  },

  async readFile(
    projectId: string,
    relativeFilePath: string
  ): Promise<{ success: boolean; content?: string; size?: number; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.readFile) {
      try {
        return await (window as any).electronAPI.projects.readFile(projectId, relativeFilePath);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: true, content: `# Project Document\n\nPreviewing ${relativeFilePath}` };
  },

  async saveFile(
    projectId: string,
    relativeFilePath: string,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.saveFile) {
      try {
        return await (window as any).electronAPI.projects.saveFile(projectId, relativeFilePath, content);
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  },

  async openVaultProjectsFolder(): Promise<{ success: boolean; path?: string; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.projects?.openVaultProjectsFolder) {
      try {
        return await (window as any).electronAPI.projects.openVaultProjectsFolder();
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: true };
  },
};
