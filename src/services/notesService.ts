import { Note, NoteMetadata } from '../types';
import { extractAllNoteTags } from './markdownConverter';

const FALLBACK_STORAGE_KEY = 'albaqros_notes_data_v1';

export function extractTags(content: string): string[] {
  return extractAllNoteTags(content);
}

export function extractWikilinks(content: string): { target: string; alias?: string }[] {
  const links: { target: string; alias?: string }[] = [];
  const regex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const target = match[1].trim();
    const alias = match[2]?.trim();
    if (target) {
      links.push({ target, alias });
    }
  }
  return links;
}

export function extractTitle(content: string, fallbackFileName: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fallbackFileName.replace(/\.md$/i, '');
}

export function extractPlainTextPreview(content: string, maxLength = 120): string {
  return content
    .replace(/^#+\s+/gm, '')
    .replace(/\[\[(.*?)\]\]/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[*_~`>]/g, '')
    .replace(/- \[[ xX]\]\s*/g, '')
    .replace(/- \s*/g, '')
    .trim()
    .slice(0, maxLength)
    .replace(/\s+/g, ' ');
}

// Browser / LocalStorage fallback helpers
function getFallbackNotes(): Record<string, Note> {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const starter: Note = {
    id: 'Welcome to Albaqros Notes.md',
    title: 'Welcome to Albaqros Notes',
    fileName: 'Welcome to Albaqros Notes.md',
    relativePath: 'Welcome to Albaqros Notes.md',
    folder: '',
    tags: ['learning', 'skills', 'roadmap'],
    preview: 'Welcome to your personal Notes & Knowledge Hub! Everything you write is saved as genuine .md Markdown files.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: `# Welcome to Albaqros Notes

Welcome to your personal **Notes & Knowledge Hub**! Everything you write is saved as genuine \`.md\` Markdown files directly inside your active Vault.

## Quick Tour
- [x] Full Markdown support (headers, bold, lists, and code blocks)
- [ ] Connect thoughts using **[[Wikilinks]]** (type \`[[\` in edit mode)
- [ ] Organize topics with tags like #learning #skills #gamedev #ideas
- [ ] Press \`Ctrl+E\` to toggle between **Edit Mode** and **Preview Mode**

## Obsidian & Cloud Storage Ready
Your notes reside directly in your vault. You can open them inside Obsidian, VS Code, or let Google Drive / OneDrive sync your knowledge base automatically.
`,
  };
  return { [starter.id]: starter };
}

function saveFallbackNotes(map: Record<string, Note>) {
  try {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {}
}

export const NotesService = {
  async listNotes(): Promise<{ success: boolean; notes: NoteMetadata[]; notesDir?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notes?.listNotes) {
      try {
        const res = await (window as any).electronAPI.notes.listNotes();
        if (res && res.success) {
          return { success: true, notes: res.notes || [], notesDir: res.notesDir };
        }
      } catch (err) {
        console.error('Error listing notes via Electron:', err);
      }
    }

    // Fallback
    const map = getFallbackNotes();
    const notes: NoteMetadata[] = Object.values(map).map(({ content, ...meta }) => meta);
    return { success: true, notes, notesDir: 'LocalStorage (Dev Mode)' };
  },

  async readNote(relativePath: string): Promise<Note | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notes?.readNote) {
      try {
        const res = await (window as any).electronAPI.notes.readNote(relativePath);
        if (res && res.success) {
          const title = extractTitle(res.content, res.fileName || relativePath);
          const tags = extractTags(res.content);
          const preview = extractPlainTextPreview(res.content);
          const folder = relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '';
          return {
            id: relativePath,
            title,
            fileName: res.fileName || relativePath.split('/').pop() || relativePath,
            relativePath,
            folder,
            tags,
            preview,
            content: res.content,
            updatedAt: res.updatedAt || new Date().toISOString(),
            createdAt: res.updatedAt || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.error('Error reading note via Electron:', err);
      }
    }

    // Fallback
    const map = getFallbackNotes();
    return map[relativePath] || null;
  },

  async writeNote(relativePath: string, content: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notes?.writeNote) {
      try {
        const res = await (window as any).electronAPI.notes.writeNote(relativePath, content);
        if (res && res.success) return true;
      } catch (err) {
        console.warn('Electron IPC notes-write unavailable, falling back to local cache:', err);
      }
    }

    // Fallback: Always save to local storage cache so no edits are ever lost!
    const map = getFallbackNotes();
    const existing = map[relativePath] || {
      id: relativePath,
      title: extractTitle(content, relativePath),
      fileName: relativePath.split('/').pop() || relativePath,
      relativePath,
      folder: relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '',
      createdAt: new Date().toISOString(),
    };

    map[relativePath] = {
      ...existing,
      title: extractTitle(content, relativePath),
      tags: extractTags(content),
      preview: extractPlainTextPreview(content),
      content,
      updatedAt: new Date().toISOString(),
    };
    saveFallbackNotes(map);
    return true;
  },

  async createNote(
    title: string,
    folder?: string,
    content?: string
  ): Promise<{ relativePath: string; fileName: string; content: string } | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notes?.createNote) {
      try {
        const res = await (window as any).electronAPI.notes.createNote(title, folder, content);
        if (res && res.success) {
          return {
            relativePath: res.relativePath,
            fileName: res.fileName,
            content: res.content,
          };
        }
      } catch (err) {
        console.error('Error creating note via Electron:', err);
      }
    }

    // Fallback
    const cleanTitle = (title || 'Untitled Note').replace(/[\\/:*?"<>|]/g, '').trim();
    const fileName = `${cleanTitle}.md`;
    const targetFolder = folder ? folder.trim().replace(/^[/\\]+|[/\\]+$/g, '') : '';
    const relPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
    const initialContent = content !== undefined ? content : `# ${cleanTitle}\n\n`;

    const map = getFallbackNotes();
    map[relPath] = {
      id: relPath,
      title: cleanTitle,
      fileName,
      relativePath: relPath,
      folder: targetFolder,
      tags: extractTags(initialContent),
      preview: extractPlainTextPreview(initialContent),
      content: initialContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveFallbackNotes(map);
    return { relativePath: relPath, fileName, content: initialContent };
  },

  async deleteNote(relativePath: string): Promise<boolean> {
    let electronSuccess = false;
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notes?.deleteNote) {
      try {
        const res = await (window as any).electronAPI.notes.deleteNote(relativePath);
        electronSuccess = Boolean(res && res.success);
      } catch (err) {
        console.error('Error deleting note via Electron:', err);
      }
    }

    // Always keep fallback cache clean so deleted notes never resurrect from localStorage
    const map = getFallbackNotes();
    if (map[relativePath]) {
      delete map[relativePath];
      saveFallbackNotes(map);
    }
    return electronSuccess || Boolean(map[relativePath] === undefined);
  },

  async renameNote(
    oldRelativePath: string,
    newTitle?: string,
    newFolder?: string
  ): Promise<{ relativePath: string; fileName?: string } | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notes?.renameNote) {
      try {
        const res = await (window as any).electronAPI.notes.renameNote(oldRelativePath, newTitle, newFolder);
        if (res && res.success) {
          return { relativePath: res.relativePath, fileName: res.fileName };
        }
      } catch (err) {
        console.error('Error renaming note via Electron:', err);
      }
    }

    // Fallback
    const map = getFallbackNotes();
    const existing = map[oldRelativePath];
    if (!existing) return null;

    const cleanTitle = (newTitle || existing.title).replace(/[\\/:*?"<>|]/g, '').trim();
    const fileName = `${cleanTitle}.md`;
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
    saveFallbackNotes(map);
    return { relativePath: newRelPath, fileName };
  },

  async createFolder(folderPath: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notes?.createFolder) {
      try {
        const res = await (window as any).electronAPI.notes.createFolder(folderPath);
        return Boolean(res && res.success);
      } catch (err) {
        console.error('Error creating folder via Electron:', err);
        return false;
      }
    }
    return true;
  },

  async openNotesFolder(relativePath?: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.notes?.openNotesFolder) {
      try {
        return await (window as any).electronAPI.notes.openNotesFolder(relativePath);
      } catch (err) {
        console.error('Error opening notes folder via Electron:', err);
      }
    }
    return false;
  },

  findBacklinks(
    currentTitle: string,
    allNotes: NoteMetadata[]
  ): { id: string; title: string; preview: string; relativePath: string }[] {
    if (!currentTitle) return [];
    const normalizedTarget = currentTitle.toLowerCase().trim();
    const results: { id: string; title: string; preview: string; relativePath: string }[] = [];

    for (const note of allNotes) {
      if (note.title.toLowerCase().trim() === normalizedTarget) continue;
      const text = (note as any).content || note.preview || '';
      const linkRegex = new RegExp(`\\[\\[${escapeRegex(currentTitle)}(?:\\|[^\\]]*)?\\]\\]`, 'i');
      if (linkRegex.test(text)) {
        results.push({
          id: note.id,
          title: note.title,
          preview: note.preview || 'Mentions this note via wikilink',
          relativePath: note.relativePath,
        });
      }
    }
    return results;
  },
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
