import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  BookOpen,
  FileText,
  Folder,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  Edit2,
  FolderOpen,
  Hash,
  Sparkles,
  Link2,
  List,
  Bold,
  Italic,
  X,
  Check,
  Save,
  Cloud,
  Tag,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { NoteMetadata } from '../types';
import { NotesService, extractTags, extractTitle, extractPlainTextPreview } from '../services/notesService';
import {
  markdownToHtml,
  htmlToMarkdown,
  extractAllNoteTags,
  removeTagFromContent,
  renameTagInContent,
} from '../services/markdownConverter';

interface NotesStudioViewProps {
  onOpenTask?: (taskId: string) => void;
  isStudioSidebarCollapsed?: boolean;
  onToggleStudioSidebar?: () => void;
}

export const NotesStudioView: React.FC<NotesStudioViewProps> = ({
  onOpenTask,
  isStudioSidebarCollapsed = false,
  onToggleStudioSidebar,
}) => {
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
  const [activeContent, setActiveContent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [notesDir, setNotesDir] = useState<string>('');

  // Collapsible Knowledge & Notes sidebar state
  const [isNotesSidebarCollapsed, setIsNotesSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('albaqros_notes_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleNotesSidebar = () => {
    setIsNotesSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('albaqros_notes_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Active note tags state
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const activeTagsRef = useRef<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editTagInput, setEditTagInput] = useState<string>('');

  // Inline [[ autocomplete popup state
  const [wikiPopup, setWikiPopup] = useState<{
    open: boolean;
    query: string;
    top: number;
    left: number;
    selectedIndex: number;
  }>({ open: false, query: '', top: 0, left: 0, selectedIndex: 0 });

  // Dialogs
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [linkModalQuery, setLinkModalQuery] = useState<string>('');
  const [isNewNoteOpen, setIsNewNoteOpen] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteFolder, setNewNoteFolder] = useState<string>('');
  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [renameTarget, setRenameTarget] = useState<NoteMetadata | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastRangeRef = useRef<Range | null>(null);

  // Load notes on mount
  const loadNotesList = useCallback(async (selectPath?: string) => {
    const res = await NotesService.listNotes();
    if (res.success) {
      setNotes(res.notes);
      if (res.notesDir) setNotesDir(res.notesDir);

      const currentPath = activeNotePathRef.current;
      const targetPath =
        selectPath ||
        (currentPath && res.notes.some((n) => n.relativePath === currentPath)
          ? currentPath
          : res.notes[0]?.relativePath);

      if (targetPath) {
        selectNote(targetPath);
      } else {
        // No notes exist
        activeNotePathRef.current = null;
        setActiveNotePath(null);
        setActiveContent('');
        setActiveTags([]);
        activeTagsRef.current = [];
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
        }
      }
    }
  }, []);

  useEffect(() => {
    loadNotesList();
  }, [loadNotesList]);

  const activeNotePathRef = useRef<string | null>(null);
  activeNotePathRef.current = activeNotePath;

  // Immediate synchronous save to drive (flushes debounce and persists immediately)
  const flushSave = useCallback(async (overridePath?: string) => {
    const targetPath = overridePath || activeNotePathRef.current;
    if (!editorRef.current || !targetPath) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const currentTags = activeTagsRef.current;
    const md = htmlToMarkdown(editorRef.current.innerHTML, currentTags);
    setActiveContent(md);
    setIsSaving(true);

    try {
      await NotesService.writeNote(targetPath, md);
      setLastSavedTime(new Date());

      const updatedTitle = extractTitle(md, targetPath);
      const updatedTags = currentTags;
      const updatedPreview = extractPlainTextPreview(md);

      setNotes((prev) =>
        prev.map((n) =>
          n.relativePath === targetPath
            ? {
                ...n,
                title: updatedTitle,
                tags: updatedTags,
                preview: updatedPreview,
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      );
    } catch (err) {
      console.error('Failed to flush save note to drive:', err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Global Ctrl+S keyboard shortcut and unmount save hook
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flushSave();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      // Flush save on unmount when leaving notes view
      if (activeNotePathRef.current) {
        flushSave(activeNotePathRef.current);
      }
    };
  }, [flushSave]);

  // Select and load note into live editor
  const selectNote = async (relativePath: string) => {
    if (activeNotePathRef.current === relativePath) return;

    // Flush current note edits to drive before switching to another note
    if (activeNotePathRef.current && editorRef.current) {
      await flushSave(activeNotePathRef.current);
    }

    setActiveNotePath(relativePath);
    activeNotePathRef.current = relativePath;
    setIsAddingTag(false);
    setNewTagInput('');
    setEditingTagIndex(null);
    setEditTagInput('');

    const loaded = await NotesService.readNote(relativePath);
    if (loaded) {
      const initialTags = extractAllNoteTags(loaded.content);
      setActiveTags(initialTags);
      activeTagsRef.current = initialTags;
      setActiveContent(loaded.content);
      setLastSavedTime(new Date(loaded.updatedAt));
      if (editorRef.current) {
        editorRef.current.innerHTML = markdownToHtml(loaded.content);
      }
    }
  };

  // Debounced auto-save reading HTML from contentEditable
  const handleContentMutated = () => {
    if (!editorRef.current || !activeNotePathRef.current) return;
    const noteToSave = activeNotePathRef.current;

    // Check if any inline #tag was typed in the body and merge with frontmatter tags
    const tempMd = htmlToMarkdown(editorRef.current.innerHTML, activeTagsRef.current);
    const discoveredTags = extractAllNoteTags(tempMd);
    const mergedTags = Array.from(new Set([...activeTagsRef.current, ...discoveredTags])).sort();
    if (
      mergedTags.length !== activeTagsRef.current.length ||
      !mergedTags.every((t, i) => t === activeTagsRef.current[i])
    ) {
      activeTagsRef.current = mergedTags;
      setActiveTags(mergedTags);
    }

    const md = htmlToMarkdown(editorRef.current.innerHTML, activeTagsRef.current);
    setActiveContent(md);
    setIsSaving(true);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      // Guard against saving after deletion or note switch
      if (!activeNotePathRef.current || activeNotePathRef.current !== noteToSave) {
        setIsSaving(false);
        return;
      }

      await NotesService.writeNote(noteToSave, md);
      setIsSaving(false);
      setLastSavedTime(new Date());

      const updatedTitle = extractTitle(md, noteToSave);
      const updatedTags = activeTagsRef.current;
      const updatedPreview = extractPlainTextPreview(md);

      setNotes((prev) =>
        prev.map((n) =>
          n.relativePath === noteToSave
            ? {
                ...n,
                title: updatedTitle,
                tags: updatedTags,
                preview: updatedPreview,
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      );
    }, 400);
  };

  // Click on a blue note link [[...]]
  const handleWikilinkClick = async (targetTitle: string) => {
    const cleanTarget = targetTitle.trim();
    if (!cleanTarget) return;

    // Flush current note edits before navigating
    await flushSave();

    const existing = notes.find(
      (n) =>
        n.title.toLowerCase() === cleanTarget.toLowerCase() ||
        n.fileName.replace(/\.md$/i, '').toLowerCase() === cleanTarget.toLowerCase()
    );

    if (existing) {
      selectNote(existing.relativePath);
    } else {
      const created = await NotesService.createNote(cleanTarget);
      if (created) {
        await loadNotesList(created.relativePath);
      }
    }
  };

  // Filtered popup suggestions
  const wikiSuggestions = useMemo(() => {
    if (!wikiPopup.open) return [];
    const q = wikiPopup.query.toLowerCase();
    return notes.filter((n) => n.title.toLowerCase().includes(q)).slice(0, 6);
  }, [wikiPopup.open, wikiPopup.query, notes]);

  // Insert wikilink at caret and preserve position without broken inline styles
  const insertWikilink = (targetTitle: string) => {
    const sel = window.getSelection();
    let range: Range | null = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : lastRangeRef.current;
    if (!range && lastRangeRef.current) {
      range = lastRangeRef.current;
    }

    const cleanTitle = targetTitle.trim();
    if (!cleanTitle) return;

    const linkSpan = document.createElement('span');
    linkSpan.className = 'albaqros-note-link';
    linkSpan.setAttribute('data-note-target', cleanTitle);
    linkSpan.setAttribute('title', `Open note: ${cleanTitle}`);
    linkSpan.textContent = cleanTitle;

    const space = document.createTextNode('\u00A0'); // nbsp

    if (range) {
      const node = range.startContainer;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const offset = range.startOffset;
        const bracketIdx = text.lastIndexOf('[[', offset);

        if (bracketIdx !== -1) {
          const before = text.substring(0, bracketIdx);
          const after = text.substring(offset);

          node.textContent = before;

          const parent = node.parentNode;
          if (parent) {
            parent.insertBefore(linkSpan, node.nextSibling);
            parent.insertBefore(space, linkSpan.nextSibling);
            if (after) {
              const afterNode = document.createTextNode(after);
              parent.insertBefore(afterNode, space.nextSibling);
            }
          }
        } else {
          range.deleteContents();
          range.insertNode(space);
          range.insertNode(linkSpan);
        }
      } else {
        range.deleteContents();
        range.insertNode(space);
        range.insertNode(linkSpan);
      }

      // Restore caret immediately after inserted link
      const newRange = document.createRange();
      newRange.setStartAfter(space);
      newRange.collapse(true);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      lastRangeRef.current = newRange.cloneRange();
    } else if (editorRef.current) {
      editorRef.current.appendChild(linkSpan);
      editorRef.current.appendChild(space);
    }

    if (editorRef.current) {
      editorRef.current.focus();
    }

    setWikiPopup({ open: false, query: '', top: 0, left: 0, selectedIndex: 0 });
    handleContentMutated();
  };

  // Keyboard events inside the Live ContentEditable Editor
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 1. If inline [[ popup is open, handle navigation keys
    if (wikiPopup.open && wikiSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setWikiPopup((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex + 1) % wikiSuggestions.length,
        }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setWikiPopup((prev) => ({
          ...prev,
          selectedIndex: (prev.selectedIndex - 1 + wikiSuggestions.length) % wikiSuggestions.length,
        }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = wikiSuggestions[wikiPopup.selectedIndex] || wikiSuggestions[0];
        if (selected) {
          insertWikilink(selected.title);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setWikiPopup((prev) => ({ ...prev, open: false }));
        return;
      }
    }

    // Quick Save shortcut: Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      flushSave();
      return;
    }

    // 2. Space key: Transform Markdown shortcuts (#, ##, ###, -, *) live into styled blocks
    if (e.key === ' ' || e.code === 'Space') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        lastRangeRef.current = range.cloneRange();
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          const offset = range.startOffset;
          const textBefore = text.slice(0, offset);
          const trimmed = textBefore.trim().replace(/\u00a0/g, ' ');

          // # -> Heading 1
          if (trimmed === '#') {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('formatBlock', false, '<h1>');
            handleContentMutated();
            return;
          }

          // ## -> Heading 2
          if (trimmed === '##') {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('formatBlock', false, '<h2>');
            handleContentMutated();
            return;
          }

          // ### -> Heading 3
          if (trimmed === '###') {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('formatBlock', false, '<h3>');
            handleContentMutated();
            return;
          }

          // - or * -> Bullet List
          if (trimmed === '-' || trimmed === '*') {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('insertUnorderedList');
            handleContentMutated();
            return;
          }
        }
      }
    }

    // 3. Enter key in Headings: ensure next line returns to standard paragraph size
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const parent = sel.anchorNode.parentElement;
        const heading = parent?.closest('h1, h2, h3, h4, h5, h6');
        if (heading) {
          setTimeout(() => {
            document.execCommand('formatBlock', false, '<p>');
            handleContentMutated();
          }, 0);
        }
      }
    }
  };

  // Detect typing [[ to trigger floating note autocomplete
  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key) && wikiPopup.open) {
      return;
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    lastRangeRef.current = range.cloneRange();
    const node = range.startContainer;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const offset = range.startOffset;
      const textBefore = text.slice(0, offset);
      const bracketIdx = textBefore.lastIndexOf('[[');

      if (bracketIdx !== -1 && !textBefore.slice(bracketIdx).includes(']]') && offset - bracketIdx <= 30) {
        const query = textBefore.slice(bracketIdx + 2);
        const rect = range.getBoundingClientRect();
        const editorRect = editorRef.current?.getBoundingClientRect();

        setWikiPopup({
          open: true,
          query,
          top: editorRect ? rect.bottom - editorRect.top + 8 : 100,
          left: editorRect ? Math.max(16, rect.left - editorRect.left) : 50,
          selectedIndex: 0,
        });
        return;
      }
    }

    if (wikiPopup.open) {
      setWikiPopup((prev) => ({ ...prev, open: false }));
    }
  };

  // Clicking on blue note links inside the live editor
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('.albaqros-note-link');
    if (target) {
      const noteTarget = target.getAttribute('data-note-target');
      if (noteTarget) {
        handleWikilinkClick(noteTarget);
      }
    }
  };

  // Tags with counts
  const allTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const note of notes) {
      for (const tag of note.tags) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [notes]);

  // Folders list
  const allFolders = useMemo(() => {
    const flds = new Set<string>();
    for (const note of notes) {
      if (note.folder) flds.add(note.folder);
    }
    return Array.from(flds).sort();
  }, [notes]);

  // Filtered notes list
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedTag && !n.tags.includes(selectedTag)) return false;
      if (selectedFolder && n.folder !== selectedFolder) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchPreview = n.preview.toLowerCase().includes(q);
        const matchTags = n.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchPreview && !matchTags) return false;
      }
      return true;
    });
  }, [notes, selectedTag, selectedFolder, searchQuery]);

  // Active note metadata
  const activeNote = useMemo(() => {
    return notes.find((n) => n.relativePath === activeNotePath);
  }, [notes, activeNotePath]);

  // Backlinks
  const backlinks = useMemo(() => {
    if (!activeNote) return [];
    return NotesService.findBacklinks(activeNote.title, notes);
  }, [activeNote, notes]);

  // Metrics
  const wordCount = useMemo(() => {
    if (!activeContent) return 0;
    return activeContent.trim().split(/\s+/).filter(Boolean).length;
  }, [activeContent]);

  const charCount = activeContent.length;

  // New Note
  const handleCreateNewNote = async () => {
    const title = newNoteTitle.trim() || 'Untitled Note';
    const folder = newNoteFolder.trim() || undefined;
    const res = await NotesService.createNote(title, folder);
    if (res) {
      setIsNewNoteOpen(false);
      setNewNoteTitle('');
      setNewNoteFolder('');
      await loadNotesList(res.relativePath);
    }
  };

  // New Folder
  const handleCreateFolder = async () => {
    const folderName = newFolderName.trim();
    if (!folderName) return;
    await NotesService.createFolder(folderName);
    setIsNewFolderOpen(false);
    setNewFolderName('');
    await loadNotesList();
  };

  // Tag management handlers (Add / Remove / Rename)
  const handleAddTag = async (tagText?: string) => {
    const val = (tagText !== undefined ? tagText : newTagInput).trim().toLowerCase().replace(/^#/, '');
    if (!val) {
      setIsAddingTag(false);
      setNewTagInput('');
      return;
    }
    if (!activeTagsRef.current.includes(val)) {
      const updated = [...activeTagsRef.current, val].sort();
      setActiveTags(updated);
      activeTagsRef.current = updated;

      if (activeNotePathRef.current && editorRef.current) {
        const md = htmlToMarkdown(editorRef.current.innerHTML, updated);
        setActiveContent(md);
        await NotesService.writeNote(activeNotePathRef.current, md);
        setLastSavedTime(new Date());
        setNotes((prev) =>
          prev.map((n) =>
            n.relativePath === activeNotePathRef.current ? { ...n, tags: updated } : n
          )
        );
      }
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const clean = tagToRemove.trim().toLowerCase().replace(/^#/, '');
    const updated = activeTagsRef.current.filter((t) => t !== clean);
    setActiveTags(updated);
    activeTagsRef.current = updated;

    if (activeNotePathRef.current && editorRef.current) {
      const currentMd = htmlToMarkdown(editorRef.current.innerHTML, activeTagsRef.current);
      const cleanedMd = removeTagFromContent(currentMd, clean);
      editorRef.current.innerHTML = markdownToHtml(cleanedMd);
      setActiveContent(cleanedMd);
      await NotesService.writeNote(activeNotePathRef.current, cleanedMd);
      setLastSavedTime(new Date());
      setNotes((prev) =>
        prev.map((n) =>
          n.relativePath === activeNotePathRef.current ? { ...n, tags: updated } : n
        )
      );
    }
  };

  const handleStartEditTag = (index: number, currentVal: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTagIndex(index);
    setEditTagInput(currentVal);
  };

  const handleSaveEditTag = async (oldTag: string) => {
    const newTag = editTagInput.trim().toLowerCase().replace(/^#/, '');
    const oldT = oldTag.trim().toLowerCase().replace(/^#/, '');

    if (!newTag || newTag === oldT) {
      setEditingTagIndex(null);
      setEditTagInput('');
      return;
    }

    const updated = activeTagsRef.current.map((t) => (t === oldT ? newTag : t));
    const unique = Array.from(new Set(updated)).sort();
    setActiveTags(unique);
    activeTagsRef.current = unique;
    setEditingTagIndex(null);
    setEditTagInput('');

    if (activeNotePathRef.current && editorRef.current) {
      const currentMd = htmlToMarkdown(editorRef.current.innerHTML, activeTagsRef.current);
      const renamedMd = renameTagInContent(currentMd, oldT, newTag);
      editorRef.current.innerHTML = markdownToHtml(renamedMd);
      setActiveContent(renamedMd);
      await NotesService.writeNote(activeNotePathRef.current, renamedMd);
      setLastSavedTime(new Date());
      setNotes((prev) =>
        prev.map((n) =>
          n.relativePath === activeNotePathRef.current ? { ...n, tags: unique } : n
        )
      );
    }
  };

  // Delete note without resurrection bug
  const handleDeleteNote = async (relativePath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const displayName = relativePath.split('/').pop()?.replace(/\.md$/i, '') || relativePath;
    if (!window.confirm(`Are you sure you want to delete "${displayName}"?`)) {
      return;
    }

    const isCurrentActive = activeNotePathRef.current === relativePath;

    // 1. If deleting current active note, clear auto-save timer and null out refs immediately
    // to prevent any race condition from re-writing the deleted note!
    if (isCurrentActive) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      activeNotePathRef.current = null;
      setActiveNotePath(null);
      setActiveContent('');
      setActiveTags([]);
      activeTagsRef.current = [];
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
    }

    // 2. Perform deletion on drive & local storage
    await NotesService.deleteNote(relativePath);

    // 3. Reload notes list and safely select next note if active note was deleted
    const res = await NotesService.listNotes();
    if (res.success) {
      setNotes(res.notes);
      if (res.notesDir) setNotesDir(res.notesDir);

      if (isCurrentActive) {
        if (res.notes.length > 0) {
          await selectNote(res.notes[0].relativePath);
        }
      }
    }
  };

  // Rename note
  const handleRenameNote = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const res = await NotesService.renameNote(renameTarget.relativePath, renameValue.trim());
    if (res) {
      if (activeNotePathRef.current === renameTarget.relativePath) {
        activeNotePathRef.current = res.relativePath;
        setActiveNotePath(res.relativePath);
      }
      setRenameTarget(null);
      setRenameValue('');
      await loadNotesList(res.relativePath);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-app)' }}>
      {/* ─── LEFT SIDEBAR: EXPLORER & TAGS (COLLAPSIBLE) ─── */}
      <aside
        style={{
          width: isNotesSidebarCollapsed ? '0px' : '280px',
          backgroundColor: '#0d1017',
          borderRight: isNotesSidebarCollapsed ? 'none' : '1px solid var(--border-subtle)',
          display: isNotesSidebarCollapsed ? 'none' : 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.2s ease',
        }}
      >
        {/* Explorer Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                }}
              >
                <BookOpen size={15} />
              </div>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                Knowledge & Notes
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsNewFolderOpen(true)}
                title="New Folder"
                style={{ width: '28px', height: '28px' }}
              >
                <FolderPlus size={15} />
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setNewNoteTitle('');
                  setIsNewNoteOpen(true);
                }}
                title="New Note"
                style={{ width: '28px', height: '28px', color: '#818cf8' }}
              >
                <Plus size={16} />
              </button>
              {notesDir && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => NotesService.openNotesFolder()}
                  title="Open Notes directory in Explorer"
                  style={{ width: '28px', height: '28px' }}
                >
                  <FolderOpen size={14} />
                </button>
              )}
              <button
                type="button"
                className="btn-icon"
                onClick={toggleNotesSidebar}
                title="Collapse Notes Explorer"
                style={{ width: '28px', height: '28px', color: 'var(--text-muted)' }}
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              padding: '6px 10px',
              gap: '8px',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search notes or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                width: '100%',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Folders & Tags Filters */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Folders */}
          {allFolders.length > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Folders
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedFolder(null)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: selectedFolder === null ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                    color: selectedFolder === null ? '#818cf8' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: selectedFolder === null ? 600 : 400,
                  }}
                >
                  All
                </button>
                {allFolders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => setSelectedFolder(selectedFolder === folder ? null : folder)}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: selectedFolder === folder ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: selectedFolder === folder ? '#818cf8' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Folder size={11} />
                    <span>{folder}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {allTagCounts.length > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Tags
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {allTagCounts.slice(0, 8).map(({ name, count }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === name ? null : name)}
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 7px',
                      borderRadius: '999px',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      backgroundColor: selectedTag === name ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.08)',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontWeight: 500,
                    }}
                  >
                    <span>#{name}</span>
                    <span style={{ fontSize: '0.62rem', opacity: 0.7 }}>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Note List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {filteredNotes.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              No notes found.
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isActive = note.relativePath === activeNotePath;
              return (
                <div
                  key={note.id}
                  onClick={() => selectNote(note.relativePath)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                    border: isActive ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <FileText size={13} color={isActive ? '#818cf8' : 'var(--text-muted)'} />
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: isActive ? 700 : 600,
                          color: isActive ? '#ffffff' : 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {note.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget(note);
                          setRenameValue(note.title);
                        }}
                        title="Rename Note"
                        style={{ padding: '2px', width: '20px', height: '20px' }}
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={(e) => handleDeleteNote(note.relativePath, e)}
                        title="Delete Note"
                        style={{ padding: '2px', width: '20px', height: '20px', color: 'var(--accent-rose)' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>

                  {note.folder && (
                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📁 {note.folder}
                    </div>
                  )}

                  {note.preview && (
                    <p
                      style={{
                        fontSize: '0.73rem',
                        color: 'var(--text-secondary)',
                        margin: '4px 0 6px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.4,
                      }}
                    >
                      {note.preview}
                    </p>
                  )}

                  {note.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                      {note.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.65rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            fontWeight: 500,
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                      {note.tags.length > 3 && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          +{note.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Stats */}
        <div
          style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{notes.length} notes</span>
          <span>{allTagCounts.length} tags</span>
        </div>
      </aside>

      {/* ─── RIGHT PANE: LIVE PREVIEW WRITING SURFACE ─── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Floating Notes Explorer Toggle when collapsed */}
        {isNotesSidebarCollapsed && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: isStudioSidebarCollapsed ? '94px' : '14px',
              zIndex: 90,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <button
              type="button"
              onClick={toggleNotesSidebar}
              title="Open Notes Explorer (Files & Folders)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#161b26',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-secondary)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-medium)';
                e.currentTarget.style.backgroundColor = '#161b26';
              }}
            >
              <PanelLeftOpen size={14} color="#818cf8" />
              <span>Notes</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewNoteTitle('');
                setIsNewNoteOpen(true);
              }}
              title="Create New Note"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: '#161b26',
                border: '1px dashed var(--border-medium)',
                color: 'var(--text-muted)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                e.currentTarget.style.color = '#818cf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-medium)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>
        )}

        {activeNote ? (
          <>
            {/* Live-Preview Writing Surface (Everything scrolls together!) */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: isNotesSidebarCollapsed ? '48px 56px 80px' : '36px 56px 80px',
                position: 'relative',
              }}
            >
              {/* ─── SIDE-BY-SIDE TAGS (Scrolls smoothly with the note!) ─── */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginBottom: '24px',
                  userSelect: 'none',
                }}
              >
                <Tag size={13} style={{ color: '#38bdf8', opacity: 0.75, marginRight: '2px', flexShrink: 0 }} />

                {activeTags.map((tag, idx) => {
                  const isEditing = editingTagIndex === idx;
                  if (isEditing) {
                    return (
                      <div
                        key={`edit-${tag}-${idx}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          backgroundColor: 'rgba(56, 189, 248, 0.18)',
                          border: '1px solid #38bdf8',
                          borderRadius: '999px',
                          padding: '1px 6px 1px 10px',
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>#</span>
                        <input
                          type="text"
                          value={editTagInput}
                          onChange={(e) => setEditTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEditTag(tag);
                            if (e.key === 'Escape') {
                              setEditingTagIndex(null);
                              setEditTagInput('');
                            }
                          }}
                          autoFocus
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            width: `${Math.max(60, editTagInput.length * 8 + 12)}px`,
                            outline: 'none',
                            padding: '0 2px',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditTag(tag)}
                          title="Confirm rename"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#38bdf8',
                            cursor: 'pointer',
                            padding: '1px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTagIndex(null);
                            setEditTagInput('');
                          }}
                          title="Cancel"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '1px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={tag}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 9px',
                        borderRadius: '999px',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        onClick={(e) => handleStartEditTag(idx, tag, e)}
                        title="Click to edit/rename tag"
                        style={{ cursor: 'pointer' }}
                      >
                        #{tag}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleStartEditTag(idx, tag, e)}
                        title="Edit / Rename Tag"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(56, 189, 248, 0.65)',
                          cursor: 'pointer',
                          padding: '0 1px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveTag(tag, e)}
                        title={`Remove tag #${tag}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(244, 63, 94, 0.8)',
                          cursor: 'pointer',
                          padding: '0 1px',
                          display: 'flex',
                          alignItems: 'center',
                          marginLeft: '1px',
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}

                {/* Add Tag Button / Input */}
                {isAddingTag ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '999px',
                      padding: '1px 6px 1px 10px',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>#</span>
                    <input
                      type="text"
                      placeholder="new-tag..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTag();
                        if (e.key === 'Escape') {
                          setIsAddingTag(false);
                          setNewTagInput('');
                        }
                      }}
                      autoFocus
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        width: '90px',
                        outline: 'none',
                        padding: '0 2px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag()}
                      title="Add Tag"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#10b981',
                        cursor: 'pointer',
                        padding: '1px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTag(false);
                        setNewTagInput('');
                      }}
                      title="Cancel"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '1px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    title="Add a tag to this note"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      padding: '2px 9px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px dashed var(--border-subtle)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#38bdf8';
                      e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                  >
                    <Plus size={11} />
                    <span>Tag</span>
                  </button>
                )}
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleContentMutated}
                onBlur={() => flushSave()}
                onKeyDown={handleEditorKeyDown}
                onKeyUp={handleEditorKeyUp}
                onClick={handleEditorClick}
                className="albaqros-live-editor"
                data-placeholder="Start typing... Use # for H1, ## for H2, ### for H3, - for bullets, and [[ to link notes"
              />

              {/* Floating Inline [[ Autocomplete Popup */}
              {wikiPopup.open && wikiSuggestions.length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    position: 'absolute',
                    top: `${wikiPopup.top}px`,
                    left: `${wikiPopup.left}px`,
                    width: '260px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    backgroundColor: '#161b26',
                    border: '1px solid rgba(96, 165, 250, 0.4)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
                    zIndex: 100,
                    padding: '4px',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#60a5fa', padding: '4px 8px' }}>
                    LINK NOTE:
                  </div>
                  {wikiSuggestions.map((note, idx) => {
                    const isSelected = idx === wikiPopup.selectedIndex;
                    return (
                      <div
                        key={note.id}
                        onClick={() => insertWikilink(note.title)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          color: '#60a5fa',
                          cursor: 'pointer',
                          fontWeight: 600,
                          backgroundColor: isSelected ? 'rgba(96, 165, 250, 0.18)' : 'transparent',
                        }}
                        onMouseEnter={() => setWikiPopup((prev) => ({ ...prev, selectedIndex: idx }))}
                      >
                        {note.title}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Backlinks Section at bottom of note */}
              {backlinks.length > 0 && (
                <div
                  style={{
                    marginTop: '48px',
                    paddingTop: '20px',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '12px',
                    }}
                  >
                    Linked to this note ({backlinks.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {backlinks.map((bl) => (
                      <button
                        key={bl.id}
                        type="button"
                        onClick={() => selectNote(bl.relativePath)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#60a5fa' }}>
                          {bl.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            marginTop: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {bl.preview}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div
              style={{
                padding: '6px 20px',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(10, 13, 20, 0.95)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', gap: '16px' }}>
                <span>{wordCount} words</span>
                <span>{charCount} characters</span>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                Type <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>#</kbd>, <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>##</kbd>, <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>-</kbd>, or <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>[[</kbd>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
                marginBottom: '16px',
              }}
            >
              <Sparkles size={32} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Your Learning & Knowledge Hub
            </h2>
            <p style={{ maxWidth: '440px', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Write cheatsheets, break down skills, link topics in <span style={{ color: '#60a5fa', fontWeight: 600 }}>blue</span>, and organize ideas using tags.
            </p>

            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setNewNoteTitle('');
                setIsNewNoteOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Create New Note
            </button>
          </div>
        )}
      </main>

      {/* ─── MODAL: LINK NOTE PICKER (FROM TOOLBAR) ─── */}
      {isLinkModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsLinkModalOpen(false)}
        >
          <div
            style={{
              width: '380px',
              backgroundColor: 'var(--bg-panel)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-card)',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <Link2 size={16} color="#60a5fa" />
                <span>Insert Note Link</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search note to link..."
              value={linkModalQuery}
              onChange={(e) => setLinkModalQuery(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                marginBottom: '12px',
                outline: 'none',
              }}
              autoFocus
            />

            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {notes
                .filter((n) => n.title.toLowerCase().includes(linkModalQuery.toLowerCase()))
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      insertWikilink(n.title);
                      setIsLinkModalOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      textAlign: 'left',
                      color: '#60a5fa',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {n.title}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE NEW NOTE ─── */}
      {isNewNoteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsNewNoteOpen(false)}
        >
          <div
            style={{
              width: '400px',
              backgroundColor: 'var(--bg-panel)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-card)',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Create New Note
              </h3>
              <button
                type="button"
                onClick={() => setIsNewNoteOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Note Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. System Design Interview Cheatsheet"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNewNote();
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Folder (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Career, Architecture, Languages"
                  value={newNoteFolder}
                  onChange={(e) => setNewNoteFolder(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNewNote();
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsNewNoteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateNewNote}
                >
                  Create Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE NEW FOLDER ─── */}
      {isNewFolderOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsNewFolderOpen(false)}
        >
          <div
            style={{
              width: '360px',
              backgroundColor: 'var(--bg-panel)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-card)',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                New Folder
              </h3>
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Folder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Design, Backend, Health"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsNewFolderOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateFolder}
                >
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: RENAME NOTE ─── */}
      {renameTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setRenameTarget(null)}
        >
          <div
            style={{
              width: '380px',
              backgroundColor: 'var(--bg-panel)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-card)',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Rename Note
              </h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  New Title
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameNote();
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRenameTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleRenameNote}
                >
                  Rename
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
