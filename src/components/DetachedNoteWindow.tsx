import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  Pin,
  PanelLeftClose,
  Save,
  Tag,
  Plus,
  Check,
  List,
  ListOrdered,
  CheckSquare,
  Bold,
  Italic,
  Link2,
  BookOpen,
  Folder,
  FileText,
  Clock,
  Sparkles,
  Undo,
  Redo,
} from 'lucide-react';
import albaqrosLogo from '../../assets/icon.png';
import { Note, NoteMetadata } from '../types';
import { NotesService, extractTags, extractTitle } from '../services/notesService';
import {
  markdownToHtml,
  htmlToMarkdown,
  removeTagFromContent,
  renameTagInContent,
  isListItemEmpty,
  cleanAllEmptyListItems,
} from '../services/markdownConverter';

interface HistorySnapshot {
  html: string;
  selection: {
    startPath: number[];
    startOffset: number;
    endPath: number[];
    endOffset: number;
  } | null;
  timestamp: number;
}

interface DetachedNoteWindowProps {
  notePath: string;
}

export const DetachedNoteWindow: React.FC<DetachedNoteWindowProps> = ({ notePath: initialNotePath }) => {
  const [currentNotePath, setCurrentNotePath] = useState<string>(initialNotePath);
  const [note, setNote] = useState<Note | null>(null);
  const [allNotes, setAllNotes] = useState<NoteMetadata[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Tags
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const activeTagsRef = useRef<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [editTagInput, setEditTagInput] = useState<string>('');

  // Inline [[ autocomplete popup
  const [wikiPopup, setWikiPopup] = useState<{
    open: boolean;
    query: string;
    top: number;
    left: number;
    selectedIndex: number;
  }>({ open: false, query: '', top: 0, left: 0, selectedIndex: 0 });

  // Web link modal
  const [isWebLinkModalOpen, setIsWebLinkModalOpen] = useState<boolean>(false);
  const [webLinkUrl, setWebLinkUrl] = useState<string>('');
  const [webLinkLabel, setWebLinkLabel] = useState<string>('');

  // Editor refs & auto-save timer
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEditorHtmlRef = useRef<string>('');
  const lastRangeRef = useRef<Range | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const isDirtyRef = useRef<boolean>(false);
  const contentRef = useRef<string>('');

  // Deep Undo / Redo history management (up to 150 snapshots)
  const MAX_HISTORY_LENGTH = 150;
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const isApplyingHistoryRef = useRef<boolean>(false);
  const lastSnapshotTimeRef = useRef<number>(0);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Statistics
  const [stats, setStats] = useState<{ words: number; chars: number; readMinutes: number }>({
    words: 0,
    chars: 0,
    readMinutes: 1,
  });

  const updateStatsFromText = useCallback((rawText: string) => {
    const clean = rawText.trim();
    const chars = clean.length;
    const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
    const readMinutes = Math.max(1, Math.ceil(words / 200));
    setStats({ words, chars, readMinutes });
  }, []);

  // Sync ref
  useEffect(() => {
    activeTagsRef.current = activeTags;
  }, [activeTags]);

  // Load note and metadata
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const [noteData, notesListRes] = await Promise.all([
        NotesService.readNote(currentNotePath),
        NotesService.listNotes(),
      ]);

      if (!isMounted) return;

      if (notesListRes.success) {
        setAllNotes(notesListRes.notes);
      }

      if (noteData) {
        setNote(noteData);
        contentRef.current = noteData.content;
        const tags = noteData.tags || extractTags(noteData.content);
        setActiveTags(tags);
        activeTagsRef.current = tags;

        if (editorRef.current) {
          editorRef.current.innerHTML = markdownToHtml(noteData.content);
          lastEditorHtmlRef.current = editorRef.current.innerHTML;
          updateStatsFromText(editorRef.current.innerText || '');

          undoStackRef.current = [{
            html: editorRef.current.innerHTML,
            selection: null,
            timestamp: Date.now(),
          }];
          redoStackRef.current = [];
          lastSnapshotTimeRef.current = Date.now();
          setCanUndo(false);
          setCanRedo(false);
        }
        setLastSavedTime(new Date(noteData.updatedAt));
      }
    }

    loadData();

    // Listen for external updates to this note
    const unsubContent = NotesService.onNoteContentChanged((data) => {
      if (data.relativePath === currentNotePath) {
        // If not actively typing dirty content, reload
        if (!isDirtyRef.current && editorRef.current) {
          contentRef.current = data.content;
          editorRef.current.innerHTML = markdownToHtml(data.content);
          lastEditorHtmlRef.current = editorRef.current.innerHTML;
          updateStatsFromText(editorRef.current.innerText || '');
          setActiveTags(extractTags(data.content));
        }
      }
    });

    // Listen for renames
    const unsubRename = NotesService.onNoteRenamed((data) => {
      if (data.oldRelativePath === currentNotePath) {
        setCurrentNotePath(data.newRelativePath);
        setNote((prev) => (prev ? { ...prev, relativePath: data.newRelativePath, title: data.newTitle } : prev));
      }
    });

    return () => {
      isMounted = false;
      unsubContent();
      unsubRename();
    };
  }, [currentNotePath, updateStatsFromText]);

  // Flush any pending save immediately
  const flushSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const htmlToSave = editorRef.current?.innerHTML || lastEditorHtmlRef.current;
    if (!isDirtyRef.current || !htmlToSave) return;

    const rawMd = htmlToMarkdown(htmlToSave, activeTags);
    contentRef.current = rawMd;
    setIsSaving(true);

    try {
      await NotesService.writeNote(currentNotePath, rawMd);
      isDirtyRef.current = false;
      setLastSavedTime(new Date());
    } catch (err) {
      console.error('Failed to flush note save:', err);
    } finally {
      setIsSaving(false);
    }
  }, [currentNotePath]);

  // Schedule auto-save on typing (750ms debounce)
  const scheduleSave = useCallback(() => {
    isDirtyRef.current = true;
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(async () => {
      await flushSave();
    }, 750);
  }, [flushSave]);

  // Caret and selection path restoration helpers
  const getNodePath = (root: Node, target: Node): number[] => {
    const path: number[] = [];
    let current: Node | null = target;
    while (current && current !== root) {
      const parent: Node | null = current.parentNode;
      if (!parent) break;
      const index = Array.from(parent.childNodes).indexOf(current as ChildNode);
      if (index === -1) break;
      path.unshift(index);
      current = parent;
    }
    return path;
  };

  const resolveNodePath = (root: Node, path: number[]): Node | null => {
    let current: Node = root;
    for (const index of path) {
      if (!current.childNodes || index >= current.childNodes.length) {
        return null;
      }
      current = current.childNodes[index];
    }
    return current;
  };

  const captureSelection = (): HistorySnapshot['selection'] => {
    if (!editorRef.current) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.startContainer) || !editorRef.current.contains(range.endContainer)) {
      return null;
    }
    return {
      startPath: getNodePath(editorRef.current, range.startContainer),
      startOffset: range.startOffset,
      endPath: getNodePath(editorRef.current, range.endContainer),
      endOffset: range.endOffset,
    };
  };

  const restoreSelection = (selData: HistorySnapshot['selection']) => {
    if (!editorRef.current || !selData) return;
    const startNode = resolveNodePath(editorRef.current, selData.startPath);
    const endNode = resolveNodePath(editorRef.current, selData.endPath);
    if (!startNode || !endNode) return;

    try {
      const range = document.createRange();
      const maxStartOffset = startNode.nodeType === Node.TEXT_NODE
        ? (startNode.textContent?.length || 0)
        : startNode.childNodes.length;
      const maxEndOffset = endNode.nodeType === Node.TEXT_NODE
        ? (endNode.textContent?.length || 0)
        : endNode.childNodes.length;

      range.setStart(startNode, Math.min(selData.startOffset, maxStartOffset));
      range.setEnd(endNode, Math.min(selData.endOffset, maxEndOffset));

      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      lastRangeRef.current = range.cloneRange();
    } catch {}
  };

  // Push history snapshot with 650ms debounce for typing, or immediate on structural changes
  const pushHistorySnapshot = (force = false) => {
    if (!editorRef.current || isApplyingHistoryRef.current) return;

    const currentHtml = editorRef.current.innerHTML;
    const now = Date.now();
    const currentSelection = captureSelection();

    if (undoStackRef.current.length === 0) {
      undoStackRef.current.push({
        html: currentHtml,
        selection: currentSelection,
        timestamp: now,
      });
      lastSnapshotTimeRef.current = now;
      setCanUndo(false);
      return;
    }

    const lastSnapshot = undoStackRef.current[undoStackRef.current.length - 1];

    if (lastSnapshot.html === currentHtml) {
      lastSnapshot.selection = currentSelection;
      return;
    }

    const timeSinceLast = now - lastSnapshotTimeRef.current;
    const sessionDuration = now - lastSnapshot.timestamp;

    if (force || timeSinceLast > 650 || sessionDuration > 2000) {
      undoStackRef.current.push({
        html: currentHtml,
        selection: currentSelection,
        timestamp: now,
      });

      if (undoStackRef.current.length > MAX_HISTORY_LENGTH) {
        undoStackRef.current.shift();
      }

      redoStackRef.current = [];
      lastSnapshotTimeRef.current = now;
      setCanUndo(undoStackRef.current.length > 1);
      setCanRedo(false);
    } else {
      lastSnapshot.html = currentHtml;
      lastSnapshot.selection = currentSelection;
      lastSnapshotTimeRef.current = now;
    }
  };

  const handleContentMutated = (skipHistory = false, forceHistory = false) => {
    if (editorRef.current) {
      lastEditorHtmlRef.current = editorRef.current.innerHTML;
      if (!skipHistory && !isApplyingHistoryRef.current) {
        pushHistorySnapshot(forceHistory);
      }
      updateStatsFromText(editorRef.current.innerText || '');
    }
    scheduleSave();
  };

  const handleUndo = useCallback(() => {
    if (!editorRef.current || undoStackRef.current.length <= 1) return;

    const currentHtml = editorRef.current.innerHTML;
    const currentSelection = captureSelection();
    const currentTop = undoStackRef.current[undoStackRef.current.length - 1];

    if (currentTop && currentTop.html !== currentHtml) {
      currentTop.html = currentHtml;
      currentTop.selection = currentSelection;
    }

    const popped = undoStackRef.current.pop();
    if (popped) {
      redoStackRef.current.push(popped);
    }

    const targetSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
    if (targetSnapshot) {
      isApplyingHistoryRef.current = true;
      editorRef.current.innerHTML = targetSnapshot.html;
      lastEditorHtmlRef.current = targetSnapshot.html;
      editorRef.current.focus();
      restoreSelection(targetSnapshot.selection);
      handleContentMutated(true);
      isApplyingHistoryRef.current = false;
    }

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const handleRedo = useCallback(() => {
    if (!editorRef.current || redoStackRef.current.length === 0) return;

    const popped = redoStackRef.current.pop();
    if (!popped) return;

    undoStackRef.current.push(popped);

    isApplyingHistoryRef.current = true;
    editorRef.current.innerHTML = popped.html;
    lastEditorHtmlRef.current = popped.html;
    editorRef.current.focus();
    restoreSelection(popped.selection);
    handleContentMutated(true);
    isApplyingHistoryRef.current = false;

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  // Global Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y shortcuts for detached note
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If event happened inside editor, handleEditorKeyDown handles it
      if (editorRef.current && editorRef.current.contains(e.target as Node)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        const tag = (document.activeElement?.tagName || '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          handleUndo();
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y'))
      ) {
        const tag = (document.activeElement?.tagName || '').toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleUndo, handleRedo]);

  // Auto-save on window blur or beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushSave();
    };
  }, [flushSave]);

  const activeHeadingRef = useRef<HTMLElement | null>(null);

  // Update visual # indicators on the active heading where caret is located
  const updateActiveHeading = useCallback(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    let headingEl: HTMLElement | null = null;

    if (sel && sel.anchorNode) {
      const node = sel.anchorNode;
      const parentEl = node.nodeType === Node.ELEMENT_NODE
        ? (node as HTMLElement)
        : node.parentElement;

      const closestH = parentEl?.closest('h1, h2, h3, h4, h5, h6') as HTMLElement | null;
      if (closestH && editorRef.current.contains(closestH)) {
        headingEl = closestH;
      }
    }

    if (activeHeadingRef.current !== headingEl) {
      if (activeHeadingRef.current && activeHeadingRef.current.isConnected) {
        activeHeadingRef.current.classList.remove('albaqros-active-heading');
      }
      editorRef.current.querySelectorAll('.albaqros-active-heading').forEach((el) => {
        if (el !== headingEl) el.classList.remove('albaqros-active-heading');
      });
      if (headingEl) {
        headingEl.classList.add('albaqros-active-heading');
      }
      activeHeadingRef.current = headingEl;
    }
  }, []);

  const clearActiveHeading = useCallback(() => {
    if (activeHeadingRef.current && activeHeadingRef.current.isConnected) {
      activeHeadingRef.current.classList.remove('albaqros-active-heading');
    }
    if (editorRef.current) {
      editorRef.current.querySelectorAll('.albaqros-active-heading').forEach((el) => {
        el.classList.remove('albaqros-active-heading');
      });
    }
    activeHeadingRef.current = null;
  }, []);

  // Selection saver
  const saveCurrentSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        lastRangeRef.current = range.cloneRange();
      }
    }
    updateActiveHeading();
  }, [updateActiveHeading]);

  // Continuously track caret and selection inside the editor across all user clicks/keys
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editorRef.current) {
        const range = sel.getRangeAt(0);
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          lastRangeRef.current = range.cloneRange();
        }
      }
      updateActiveHeading();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [updateActiveHeading]);

  // Dock note back into main window
  const handleDockBack = async () => {
    await flushSave();
    await NotesService.dockNoteBack(currentNotePath);
  };

  // Window control helpers
  const handleMinimize = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    }
  };

  const handleToggleMaximize = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.maximize) {
      await (window as any).electronAPI.maximize();
      if ((window as any).electronAPI?.isMaximized) {
        const max = await (window as any).electronAPI.isMaximized();
        setIsMaximized(Boolean(max));
      }
    }
  };

  const handleClose = async () => {
    await flushSave();
    if (typeof window !== 'undefined' && (window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    } else {
      window.close();
    }
  };

  const handleToggleAlwaysOnTop = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setAlwaysOnTop) {
      const next = !isAlwaysOnTop;
      const res = await (window as any).electronAPI.setAlwaysOnTop(next);
      setIsAlwaysOnTop(Boolean(res));
    }
  };

  // Filter wiki suggestions
  const wikiSuggestions = useMemo(() => {
    if (!wikiPopup.open) return [];
    const q = wikiPopup.query.toLowerCase().trim();
    return allNotes
      .filter((n) => n.relativePath !== currentNotePath && (!q || n.title.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [wikiPopup.open, wikiPopup.query, allNotes, currentNotePath]);

  const insertWikilink = (targetTitle: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    const linkSpan = document.createElement('span');
    linkSpan.className = 'albaqros-note-link';
    linkSpan.setAttribute('data-note-target', targetTitle);
    linkSpan.title = `Open note: ${targetTitle}`;
    linkSpan.textContent = targetTitle;

    const spaceNode = document.createTextNode('\u00A0');

    range.deleteContents();
    range.insertNode(spaceNode);
    range.insertNode(linkSpan);

    const newRange = document.createRange();
    newRange.setStartAfter(spaceNode);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    lastRangeRef.current = newRange.cloneRange();

    setWikiPopup({ open: false, query: '', top: 0, left: 0, selectedIndex: 0 });
    handleContentMutated(false, true);
    editorRef.current?.focus();
  };

  // Tag management
  const handleAddTag = () => {
    const clean = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!clean) {
      setIsAddingTag(false);
      return;
    }
    if (!activeTags.includes(clean)) {
      const next = [...activeTags, clean].sort();
      setActiveTags(next);
      if (editorRef.current) {
        let md = htmlToMarkdown(editorRef.current.innerHTML, activeTags);
        const tagLine = `\n#${clean}`;
        md = md.trimEnd() + tagLine + '\n';
        editorRef.current.innerHTML = markdownToHtml(md);
        handleContentMutated();
      }
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const next = activeTags.filter((t) => t !== tagToRemove);
    setActiveTags(next);
    if (editorRef.current) {
      const md = htmlToMarkdown(editorRef.current.innerHTML, activeTags);
      const cleaned = removeTagFromContent(md, tagToRemove);
      editorRef.current.innerHTML = markdownToHtml(cleaned);
      handleContentMutated();
    }
  };

  const handleStartEditTag = (index: number, currentTag: string) => {
    setEditingTagIndex(index);
    setEditTagInput(currentTag);
  };

  const handleSaveEditTag = (oldTag: string) => {
    const clean = editTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!clean || clean === oldTag) {
      setEditingTagIndex(null);
      return;
    }
    const next = activeTags.map((t) => (t === oldTag ? clean : t));
    setActiveTags(next);
    setEditingTagIndex(null);
    if (editorRef.current) {
      const md = htmlToMarkdown(editorRef.current.innerHTML, activeTags);
      const renamed = renameTagInContent(md, oldTag, clean);
      editorRef.current.innerHTML = markdownToHtml(renamed);
      handleContentMutated();
    }
  };

  // Web link insertion
  const openWebLinkModal = () => {
    saveCurrentSelection();
    let initialLabel = '';
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      initialLabel = sel.toString().trim();
    }
    setWebLinkLabel(initialLabel);
    setWebLinkUrl('');
    setIsWebLinkModalOpen(true);
  };

  const confirmInsertWebLink = () => {
    const rawUrl = webLinkUrl.trim();
    if (!rawUrl) {
      setIsWebLinkModalOpen(false);
      return;
    }
    const fullUrl = /^(?:https?:\/\/|mailto:)/i.test(rawUrl)
      ? rawUrl
      : (rawUrl.startsWith('www.') ? `https://${rawUrl}` : `https://${rawUrl}`);
    const display = (webLinkLabel.trim() || fullUrl).trim();

    if (lastRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(lastRangeRef.current);
    }

    const link = document.createElement('a');
    link.className = 'albaqros-external-link';
    link.href = fullUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = fullUrl;
    link.textContent = display;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(link);

      const space = document.createTextNode('\u00A0');
      range.setStartAfter(link);
      range.insertNode(space);
      range.setStartAfter(space);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    setIsWebLinkModalOpen(false);
    handleContentMutated(false, true);
    editorRef.current?.focus();
  };

  // Indentation helpers for nested sub-bullets
  const getListNestingDepth = (li: HTMLElement): number => {
    let depth = 0;
    let curr: HTMLElement | null = li.parentElement;
    while (curr && editorRef.current?.contains(curr)) {
      if (curr.tagName.toUpperCase() === 'UL' || curr.tagName.toUpperCase() === 'OL') {
        depth++;
      }
      curr = curr.parentElement;
    }
    return Math.max(1, depth);
  };

  // Helper to get all top-level selected <li> elements across the current selection range
  const getSelectedListItems = (sel: Selection | null): HTMLElement[] => {
    if (!sel || !sel.rangeCount || !editorRef.current) return [];
    const range = sel.getRangeAt(0);

    if (range.collapsed) {
      const singleLi = getActiveListItem(sel);
      return singleLi && editorRef.current.contains(singleLi) ? [singleLi] : [];
    }

    const allLis = Array.from(editorRef.current.querySelectorAll('li')) as HTMLElement[];
    const selected: HTMLElement[] = [];

    for (const li of allLis) {
      if (!editorRef.current.contains(li)) continue;

      const startInLi = li.contains(range.startContainer);
      const endInLi = li.contains(range.endContainer);

      if (startInLi) {
        const closestLi = (
          range.startContainer.nodeType === Node.ELEMENT_NODE
            ? (range.startContainer as HTMLElement).closest('li')
            : range.startContainer.parentElement?.closest('li')
        );
        if (closestLi === li) {
          selected.push(li);
          continue;
        }
      }

      if (endInLi) {
        const closestLi = (
          range.endContainer.nodeType === Node.ELEMENT_NODE
            ? (range.endContainer as HTMLElement).closest('li')
            : range.endContainer.parentElement?.closest('li')
        );
        if (closestLi === li) {
          selected.push(li);
          continue;
        }
      }

      try {
        if (range.comparePoint(li, 0) <= 0 && range.comparePoint(li, li.childNodes.length) >= 0) {
          const containsStart = li.contains(range.startContainer);
          const containsEnd = li.contains(range.endContainer);
          if (!containsStart && !containsEnd) {
            selected.push(li);
          }
        }
      } catch {
        // Fallback for detached or cross-tree comparisons
      }
    }

    return selected.filter((li) => !selected.some((other) => other !== li && other.contains(li)));
  };

  // Helper to get top-level block elements intersecting the range when outside lists
  const getSelectedBlocks = (sel: Selection | null): HTMLElement[] => {
    if (!sel || !sel.rangeCount || !editorRef.current) return [];
    const range = sel.getRangeAt(0);
    const children = Array.from(editorRef.current.children) as HTMLElement[];
    const selected: HTMLElement[] = [];

    for (const child of children) {
      if (child.tagName === 'UL' || child.tagName === 'OL') continue;
      try {
        if (range.intersectsNode(child)) {
          selected.push(child);
        }
      } catch {}
    }
    return selected;
  };

  // Indent one or multiple list items: creates a nested sub-bullet list under the upper topic (previous sibling LI)
  const indentListItems = (items: HTMLElement[], sel: Selection) => {
    if (items.length === 0) return;
    pushHistorySnapshot(true);

    for (const li of items) {
      const prevLi = li.previousElementSibling as HTMLElement | null;
      if (!prevLi || prevLi.tagName.toUpperCase() !== 'LI') {
        continue;
      }

      let subList = prevLi.querySelector(':scope > ul, :scope > ol') as HTMLElement | null;
      if (!subList) {
        subList = document.createElement('ul');
        subList.style.margin = '4px 0 4px 18px';
        subList.style.padding = '0';
        subList.style.fontSize = '0.92rem';
        subList.style.color = '#f8fafc';
        subList.style.lineHeight = '1.6';
        const depth = getListNestingDepth(prevLi);
        subList.style.listStyleType = depth === 1 ? 'circle' : depth >= 2 ? 'square' : 'disc';
        prevLi.appendChild(subList);
      }

      subList.appendChild(li);

      if (!li.childNodes.length || li.innerHTML.trim() === '') {
        li.innerHTML = '<br>';
      }
    }

    if (sel.isCollapsed && items.length === 1) {
      const singleLi = items[0];
      const range = document.createRange();
      const subListEl = singleLi.querySelector(':scope > ul, :scope > ol');
      if (subListEl) {
        range.setStartBefore(subListEl);
      } else {
        range.selectNodeContents(singleLi);
      }
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      lastRangeRef.current = range.cloneRange();
    } else if (items.length > 0) {
      try {
        const range = document.createRange();
        range.setStart(items[0], 0);
        const lastItem = items[items.length - 1];
        range.setEnd(lastItem, lastItem.childNodes.length);
        sel.removeAllRanges();
        sel.addRange(range);
        lastRangeRef.current = range.cloneRange();
      } catch {}
    }

    handleContentMutated(false, true);
  };

  const indentListItem = (currentLi: HTMLElement, sel: Selection) => {
    indentListItems([currentLi], sel);
  };

  // Convert a list item into a regular paragraph (removing bullet or number), preserving content, following list continuation, and cursor position
  const convertListItemToParagraph = (currentLi: HTMLElement, sel: Selection) => {
    outdentListItems([currentLi], sel);
  };

  // Outdent one or multiple list items: moves up towards parent list, or converts to paragraphs if already at root
  const outdentListItems = (items: HTMLElement[], sel: Selection) => {
    if (items.length === 0) return;
    pushHistorySnapshot(true);

    const resultingElements: HTMLElement[] = [];
    const lastInsertedMap = new Map<HTMLElement, HTMLElement>();

    for (const li of items) {
      const parentSubList = li.closest('ul, ol') as HTMLElement | null;
      if (!parentSubList) continue;

      const parentLi = parentSubList.parentElement?.closest('li') as HTMLElement | null;

      if (parentLi && parentLi.parentElement) {
        const upperList = parentLi.parentElement;
        const prevInsert = lastInsertedMap.get(parentLi) || parentLi;
        upperList.insertBefore(li, prevInsert.nextSibling);
        lastInsertedMap.set(parentLi, li);
        resultingElements.push(li);

        if (items.length === 1) {
          const followingLis: Element[] = [];
          let nextSib = li.nextElementSibling;
          while (nextSib) {
            followingLis.push(nextSib);
            nextSib = nextSib.nextElementSibling;
          }
          if (followingLis.length > 0) {
            const isOl = parentSubList.tagName.toUpperCase() === 'OL';
            let newSubList = li.querySelector(':scope > ul, :scope > ol') as HTMLElement | null;
            if (!newSubList) {
              newSubList = document.createElement(isOl ? 'ol' : 'ul');
              const isUpperOl = parentLi.parentElement?.tagName.toUpperCase() === 'OL';
              newSubList.style.margin = (isUpperOl && !isOl) ? '3px 0 3px 0' : (isOl ? '4px 0 4px 20px' : '4px 0 4px 18px');
              newSubList.style.padding = '0';
              newSubList.style.fontSize = '0.92rem';
              newSubList.style.color = '#f8fafc';
              newSubList.style.lineHeight = '1.6';
              li.appendChild(newSubList);
            }
            followingLis.forEach((sib) => newSubList!.appendChild(sib));
          }
        }

        if (parentSubList.children.length === 0) {
          parentSubList.remove();
        }
      } else {
        // Root list level: convert to normal paragraph
        const isOl = parentSubList.tagName.toUpperCase() === 'OL';
        let olIndex = 1;
        if (isOl) {
          const startAttr = parentSubList.getAttribute('start');
          const baseStart = startAttr ? parseInt(startAttr, 10) || 1 : 1;
          let count = 0;
          for (let j = 0; j < parentSubList.children.length; j++) {
            if (parentSubList.children[j] === li) {
              olIndex = baseStart + count + 1;
              break;
            }
            if (parentSubList.children[j].tagName.toUpperCase() === 'LI') count++;
          }
        }

        const nestedLists = Array.from(li.querySelectorAll(':scope > ul, :scope > ol')) as HTMLElement[];
        nestedLists.forEach((nl) => nl.remove());

        const normalP = document.createElement('p');
        normalP.style.margin = '6px 0';
        normalP.style.fontSize = '0.94rem';
        normalP.style.lineHeight = '1.65';
        normalP.style.color = '#f8fafc';
        normalP.innerHTML = li.innerHTML.trim() || '<br>';

        const followingLis: HTMLElement[] = [];
        let nextSib = li.nextElementSibling;
        while (nextSib) {
          if (nextSib.tagName.toUpperCase() === 'LI' && !items.includes(nextSib as HTMLElement)) {
            followingLis.push(nextSib as HTMLElement);
          }
          nextSib = nextSib.nextElementSibling;
        }

        li.remove();

        let secondList: HTMLElement | null = null;
        if (followingLis.length > 0) {
          secondList = document.createElement(parentSubList.tagName.toLowerCase()) as HTMLElement;
          secondList.style.margin = isOl ? '6px 0 6px 24px' : '6px 0 6px 20px';
          secondList.style.padding = '0';
          secondList.style.fontSize = '0.92rem';
          secondList.style.color = '#f8fafc';
          secondList.style.lineHeight = '1.6';
          if (isOl) {
            secondList.style.listStyleType = 'decimal';
            secondList.setAttribute('start', String(olIndex));
          }
          followingLis.forEach((sib) => secondList!.appendChild(sib));
        }

        if (parentSubList.children.length > 0) {
          parentSubList.insertAdjacentElement('afterend', normalP);
          let lastInsert: HTMLElement = normalP;
          nestedLists.forEach((nl) => {
            lastInsert.insertAdjacentElement('afterend', nl);
            lastInsert = nl;
          });
          if (secondList) {
            lastInsert.insertAdjacentElement('afterend', secondList);
          }
        } else {
          parentSubList.replaceWith(normalP);
          let lastInsert: HTMLElement = normalP;
          nestedLists.forEach((nl) => {
            lastInsert.insertAdjacentElement('afterend', nl);
            lastInsert = nl;
          });
          if (secondList) {
            lastInsert.insertAdjacentElement('afterend', secondList);
          }
        }

        resultingElements.push(normalP);
      }
    }

    if (editorRef.current) {
      cleanAllEmptyListItems(editorRef.current);
    }

    if (sel.isCollapsed && resultingElements.length === 1) {
      const singleEl = resultingElements[0];
      const range = document.createRange();
      range.selectNodeContents(singleEl);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      lastRangeRef.current = range.cloneRange();
    } else if (resultingElements.length > 0) {
      try {
        const range = document.createRange();
        range.setStart(resultingElements[0], 0);
        const lastEl = resultingElements[resultingElements.length - 1];
        range.setEnd(lastEl, lastEl.childNodes.length);
        sel.removeAllRanges();
        sel.addRange(range);
        lastRangeRef.current = range.cloneRange();
      } catch {}
    }

    editorRef.current?.focus();
    handleContentMutated(false, true);
  };

  const outdentListItem = (currentLi: HTMLElement, sel: Selection) => {
    outdentListItems([currentLi], sel);
  };

  // Indent non-list block elements
  const indentBlocks = (blocks: HTMLElement[], sel: Selection) => {
    if (blocks.length === 0) return;
    pushHistorySnapshot(true);

    for (const block of blocks) {
      if (block.tagName === 'PRE') {
        const code = block.querySelector('code') || block;
        code.textContent = (code.textContent || '')
          .split('\n')
          .map((line) => '  ' + line)
          .join('\n');
      } else {
        const firstChild = block.firstChild;
        if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
          firstChild.textContent = '\u00a0\u00a0' + (firstChild.textContent || '');
        } else {
          block.insertBefore(document.createTextNode('\u00a0\u00a0'), block.firstChild);
        }
      }
    }

    try {
      const range = document.createRange();
      range.setStart(blocks[0], 0);
      const lastBlock = blocks[blocks.length - 1];
      range.setEnd(lastBlock, lastBlock.childNodes.length);
      sel.removeAllRanges();
      sel.addRange(range);
      lastRangeRef.current = range.cloneRange();
    } catch {}

    handleContentMutated(false, true);
  };

  // Outdent non-list block elements
  const outdentBlocks = (blocks: HTMLElement[], sel: Selection) => {
    if (blocks.length === 0) return;
    pushHistorySnapshot(true);

    for (const block of blocks) {
      if (block.tagName === 'PRE') {
        const code = block.querySelector('code') || block;
        code.textContent = (code.textContent || '')
          .split('\n')
          .map((line) => line.replace(/^ {1,2}/, ''))
          .join('\n');
      } else {
        const firstChild = block.firstChild;
        if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
          const text = firstChild.textContent || '';
          if (text.startsWith('\u00a0\u00a0') || text.startsWith('  ')) {
            firstChild.textContent = text.slice(2);
          } else if (text.startsWith('\u00a0') || text.startsWith(' ')) {
            firstChild.textContent = text.slice(1);
          }
        }
      }
    }

    try {
      const range = document.createRange();
      range.setStart(blocks[0], 0);
      const lastBlock = blocks[blocks.length - 1];
      range.setEnd(lastBlock, lastBlock.childNodes.length);
      sel.removeAllRanges();
      sel.addRange(range);
      lastRangeRef.current = range.cloneRange();
    } catch {}

    handleContentMutated(false, true);
  };

  const exitListToNormalParagraph = (currentLi: HTMLElement, sel: Selection) => {
    const parentList = currentLi.closest('ul, ol') as HTMLElement | null;
    const normalP = document.createElement('p');
    normalP.style.margin = '6px 0';
    normalP.style.fontSize = '0.94rem';
    normalP.style.lineHeight = '1.65';
    normalP.style.color = '#f8fafc';
    normalP.appendChild(document.createElement('br'));

    if (parentList) {
      const followingLis: Element[] = [];
      let sibling = currentLi.nextElementSibling;
      while (sibling) {
        followingLis.push(sibling);
        sibling = sibling.nextElementSibling;
      }

      currentLi.remove();

      Array.from(parentList.querySelectorAll('li')).forEach((li) => {
        if (isListItemEmpty(li as HTMLElement)) {
          li.remove();
        }
      });

      if (followingLis.length > 0) {
        const isOl = parentList.tagName.toUpperCase() === 'OL';
        const secondList = document.createElement(parentList.tagName.toLowerCase()) as HTMLElement;
        secondList.style.margin = isOl ? '6px 0 6px 24px' : '6px 0 6px 20px';
        secondList.style.padding = '0';
        secondList.style.fontSize = '0.92rem';
        secondList.style.color = '#f8fafc';
        secondList.style.lineHeight = '1.6';
        if (isOl) secondList.style.listStyleType = 'decimal';

        followingLis.forEach((sib) => {
          if (!isListItemEmpty(sib as HTMLElement)) {
            secondList.appendChild(sib);
          } else {
            sib.remove();
          }
        });

        if (secondList.children.length > 0) {
          parentList.insertAdjacentElement('afterend', secondList);
        }
        parentList.insertAdjacentElement('afterend', normalP);
      } else if (parentList.querySelectorAll('li').length > 0) {
        parentList.insertAdjacentElement('afterend', normalP);
      } else {
        parentList.replaceWith(normalP);
      }
    } else {
      currentLi.replaceWith(normalP);
    }

    if (editorRef.current) {
      cleanAllEmptyListItems(editorRef.current);
    }

    const range = document.createRange();
    range.setStart(normalP, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    editorRef.current?.focus();
    handleContentMutated();
  };

  // Helper to reliably find the active <li> from current selection, handling cases where anchorNode is <ul> or <ol>
  const getActiveListItem = (sel: Selection | null): HTMLElement | null => {
    if (!sel || !sel.anchorNode) return null;

    let node: Node | null = sel.anchorNode;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const li = el.closest('li');
      if (li && editorRef.current?.contains(li)) return li;

      // When caret is inside UL/OL, anchorNode is often the UL/OL element itself with anchorOffset pointing to the LI child
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        const child = el.childNodes[sel.anchorOffset] || el.childNodes[Math.max(0, sel.anchorOffset - 1)];
        if (child) {
          if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName === 'LI') {
            return child as HTMLElement;
          }
          if (child.nodeType === Node.ELEMENT_NODE) {
            const liChild = (child as HTMLElement).closest('li');
            if (liChild && editorRef.current?.contains(liChild)) return liChild;
          }
        }
      }
    } else if (node.parentElement) {
      const li = node.parentElement.closest('li');
      if (li && editorRef.current?.contains(li)) return li;
    }

    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const startNode = range.startContainer;
      if (startNode.nodeType === Node.ELEMENT_NODE) {
        const el = startNode as HTMLElement;
        const li = el.closest('li');
        if (li && editorRef.current?.contains(li)) return li;

        if (el.tagName === 'UL' || el.tagName === 'OL') {
          const child = el.childNodes[range.startOffset] || el.childNodes[Math.max(0, range.startOffset - 1)];
          if (child && child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName === 'LI') {
            return child as HTMLElement;
          }
          if (child && child.nodeType === Node.ELEMENT_NODE) {
            const liChild = (child as HTMLElement).closest('li');
            if (liChild && editorRef.current?.contains(liChild)) return liChild;
          }
        }
      } else if (startNode.parentElement) {
        const li = startNode.parentElement.closest('li');
        if (li && editorRef.current?.contains(li)) return li;
      }
    }

    return null;
  };

  // Convert or toggle list format between bulleted (ul) and numbered (ol), with smart nesting support
  const toggleListFormat = (targetType: 'ul' | 'ol', initialStartVal?: number) => {
    pushHistorySnapshot(true);
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      document.execCommand(targetType === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
      handleContentMutated();
      editorRef.current?.focus();
      return;
    }

    const selectedLis = getSelectedListItems(sel);
    if (selectedLis.length > 1) {
      const lists = Array.from(new Set(selectedLis.map((li) => li.closest('ul, ol') as HTMLElement).filter(Boolean)));
      for (const list of lists) {
        if (list.tagName.toLowerCase() !== targetType) {
          const newList = document.createElement(targetType);
          newList.style.margin = targetType === 'ol' ? '6px 0 6px 24px' : '6px 0 6px 20px';
          newList.style.padding = '0';
          newList.style.fontSize = '0.92rem';
          newList.style.color = '#f8fafc';
          newList.style.lineHeight = '1.6';
          if (targetType === 'ol') {
            newList.style.listStyleType = 'decimal';
          } else {
            newList.style.listStyleType = 'disc';
          }
          while (list.firstChild) {
            newList.appendChild(list.firstChild);
          }
          Array.from(newList.querySelectorAll('li')).forEach((li) => {
            const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
            const firstText = walker.nextNode();
            if (firstText && firstText.nodeValue) {
              if (targetType === 'ul') {
                firstText.nodeValue = firstText.nodeValue.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '');
              } else {
                firstText.nodeValue = firstText.nodeValue.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '');
              }
            }
          });
          list.replaceWith(newList);
        }
      }
      try {
        const range = document.createRange();
        range.setStart(selectedLis[0], 0);
        const last = selectedLis[selectedLis.length - 1];
        range.setEnd(last, last.childNodes.length);
        sel.removeAllRanges();
        sel.addRange(range);
        lastRangeRef.current = range.cloneRange();
      } catch {}
      handleContentMutated();
      editorRef.current?.focus();
      return;
    }

    const currentLi = getActiveListItem(sel);
    if (!currentLi || !editorRef.current?.contains(currentLi)) {
      if (targetType === 'ol' && initialStartVal && initialStartVal > 0) {
        const startNode = sel.anchorNode;
        const currentBlock = (
          startNode?.nodeType === Node.ELEMENT_NODE
            ? (startNode as HTMLElement).closest('p, div, h1, h2, h3, h4, h5, h6')
            : startNode?.parentElement?.closest('p, div, h1, h2, h3, h4, h5, h6')
        ) as HTMLElement | null;

        if (currentBlock && editorRef.current?.contains(currentBlock)) {
          const ol = document.createElement('ol');
          ol.style.margin = '6px 0 6px 24px';
          ol.style.padding = '0';
          ol.style.fontSize = '0.92rem';
          ol.style.color = '#f8fafc';
          ol.style.lineHeight = '1.6';
          ol.style.listStyleType = 'decimal';
          ol.setAttribute('start', String(initialStartVal));

          const li = document.createElement('li');
          li.style.margin = '3px 0';
          li.innerHTML = currentBlock.innerHTML.trim() || '<br>';
          ol.appendChild(li);

          currentBlock.replaceWith(ol);

          const range = document.createRange();
          range.selectNodeContents(li);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          lastRangeRef.current = range.cloneRange();

          handleContentMutated();
          editorRef.current?.focus();
          return;
        }
      }

      document.execCommand(targetType === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
      if (targetType === 'ol' && initialStartVal && initialStartVal > 1) {
        const curSel = window.getSelection();
        const ol = (curSel?.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? (curSel?.anchorNode as HTMLElement).closest('ol')
          : curSel?.anchorNode?.parentElement?.closest('ol'));
        if (ol) ol.setAttribute('start', String(initialStartVal));
      }
      handleContentMutated();
      editorRef.current?.focus();
      return;
    }

    const parentList = currentLi.closest('ul, ol') as HTMLElement | null;
    if (!parentList) {
      document.execCommand(targetType === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
      handleContentMutated();
      editorRef.current?.focus();
      return;
    }

    const currentTag = parentList.tagName.toLowerCase();
    const isSublist = parentList.parentElement?.tagName.toUpperCase() === 'LI';

    // If already the target type at root level
    if (currentTag === targetType && !isSublist) {
      if (targetType === 'ol') {
        // If initialStartVal was provided (e.g. from typing "10." + Space), set the start value!
        if (initialStartVal && initialStartVal > 0) {
          const isFirstLi = !currentLi.previousElementSibling || currentLi.previousElementSibling.tagName.toUpperCase() !== 'LI';
          if (isFirstLi) {
            parentList.setAttribute('start', String(initialStartVal));
          } else {
            // Split OL
            const followingLis: HTMLElement[] = [currentLi];
            let nextSib = currentLi.nextElementSibling;
            while (nextSib) {
              if (nextSib.tagName.toUpperCase() === 'LI') followingLis.push(nextSib as HTMLElement);
              nextSib = nextSib.nextElementSibling;
            }
            const newOl = document.createElement('ol');
            newOl.style.margin = parentList.style.margin || '6px 0 6px 24px';
            newOl.style.padding = '0';
            newOl.style.fontSize = parentList.style.fontSize || '0.92rem';
            newOl.style.color = parentList.style.color || '#f8fafc';
            newOl.style.lineHeight = parentList.style.lineHeight || '1.6';
            newOl.style.listStyleType = 'decimal';
            newOl.setAttribute('start', String(initialStartVal));
            followingLis.forEach((li) => newOl.appendChild(li));
            parentList.insertAdjacentElement('afterend', newOl);
          }
          handleContentMutated();
          editorRef.current?.focus();
          return;
        }

        // Toolbar button clicked on an existing OL without initialStartVal:
        // Ask the user what number to start at, or empty to turn off!
        const curStart = parentList.getAttribute('start') || '1';
        const userVal = window.prompt('Número inicial da lista (ou deixe em branco para desativar lista):', curStart);
        if (userVal === null) {
          editorRef.current?.focus();
          return;
        }
        const parsed = parseInt(userVal.trim(), 10);
        if (!isNaN(parsed) && parsed > 0) {
          parentList.setAttribute('start', String(parsed));
          handleContentMutated();
          editorRef.current?.focus();
          return;
        }
      }

      document.execCommand(targetType === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
      handleContentMutated();
      editorRef.current?.focus();
      return;
    }

    // Inside a nested sublist: switch sublist tag between ul and ol
    if (isSublist) {
      if (currentTag === targetType && targetType === 'ol') {
        if (initialStartVal && initialStartVal > 0) {
          parentList.setAttribute('start', String(initialStartVal));
          handleContentMutated();
          editorRef.current?.focus();
          return;
        }
        const curStart = parentList.getAttribute('start') || '1';
        const userVal = window.prompt('Número inicial da sub-lista (ou deixe em branco para desativar lista):', curStart);
        if (userVal === null) {
          editorRef.current?.focus();
          return;
        }
        const parsed = parseInt(userVal.trim(), 10);
        if (!isNaN(parsed) && parsed > 0) {
          parentList.setAttribute('start', String(parsed));
          handleContentMutated();
          editorRef.current?.focus();
          return;
        }
      }
      const newList = document.createElement(targetType);
      newList.style.margin = targetType === 'ol' ? '4px 0 4px 20px' : '4px 0 4px 18px';
      newList.style.padding = '0';
      newList.style.fontSize = '0.92rem';
      newList.style.color = '#f8fafc';
      newList.style.lineHeight = '1.6';
      if (targetType === 'ul') {
        newList.style.listStyleType = 'disc';
      } else {
        newList.style.listStyleType = 'lower-alpha';
        if (initialStartVal && initialStartVal > 1) {
          newList.setAttribute('start', String(initialStartVal));
        }
      }
      while (parentList.firstChild) {
        newList.appendChild(parentList.firstChild);
      }
      parentList.replaceWith(newList);
      handleContentMutated();
      editorRef.current?.focus();
      return;
    }

    // In a root list: if changing list type and there is an upper topic (prevLi)
    const prevLi = currentLi.previousElementSibling as HTMLElement | null;
    if (prevLi && prevLi.tagName.toUpperCase() === 'LI') {
      const isParentOl = parentList.tagName.toUpperCase() === 'OL';
      let subList = prevLi.querySelector(':scope > ul, :scope > ol') as HTMLElement | null;
      if (!subList) {
        subList = document.createElement(targetType);
        subList.style.margin = (isParentOl && targetType === 'ul')
          ? '3px 0 3px 0'
          : (targetType === 'ol' ? '4px 0 4px 20px' : '4px 0 4px 18px');
        subList.style.padding = '0';
        subList.style.fontSize = '0.92rem';
        subList.style.color = '#f8fafc';
        subList.style.lineHeight = '1.6';
        if (targetType === 'ul') {
          subList.style.listStyleType = 'disc';
        } else {
          subList.style.listStyleType = 'lower-alpha';
          if (initialStartVal && initialStartVal > 1) {
            subList.setAttribute('start', String(initialStartVal));
          }
        }
        prevLi.appendChild(subList);
      } else if (subList.tagName.toUpperCase() !== targetType.toUpperCase()) {
        const newSub = document.createElement(targetType);
        newSub.style.margin = (isParentOl && targetType === 'ul')
          ? '3px 0 3px 0'
          : (targetType === 'ol' ? '4px 0 4px 20px' : '4px 0 4px 18px');
        newSub.style.padding = '0';
        newSub.style.fontSize = '0.92rem';
        newSub.style.color = '#f8fafc';
        newSub.style.lineHeight = '1.6';
        if (targetType === 'ul') {
          newSub.style.listStyleType = 'disc';
        } else {
          newSub.style.listStyleType = 'lower-alpha';
          if (initialStartVal && initialStartVal > 1) {
            newSub.setAttribute('start', String(initialStartVal));
          }
        }
        while (subList.firstChild) {
          newSub.appendChild(subList.firstChild);
        }
        subList.replaceWith(newSub);
        subList = newSub;
      }

      // Collect currentLi and all subsequent sibling LIs in this list
      const lisToMove: HTMLElement[] = [currentLi];
      let next = currentLi.nextElementSibling;
      while (next) {
        if (next.tagName.toUpperCase() === 'LI') {
          lisToMove.push(next as HTMLElement);
        }
        next = next.nextElementSibling;
      }

      lisToMove.forEach((li) => subList!.appendChild(li));

      // Restore caret inside currentLi
      const range = document.createRange();
      range.selectNodeContents(currentLi);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      lastRangeRef.current = range.cloneRange();

      handleContentMutated();
      editorRef.current?.focus();
      return;
    }

    // First item of root list: convert the whole root list to targetType
    const newList = document.createElement(targetType);
    newList.style.margin = targetType === 'ol' ? '6px 0 6px 24px' : '6px 0 6px 20px';
    newList.style.padding = '0';
    newList.style.fontSize = '0.92rem';
    newList.style.color = '#f8fafc';
    newList.style.lineHeight = '1.6';
    if (targetType === 'ol') {
      newList.style.listStyleType = 'decimal';
      if (initialStartVal && initialStartVal > 1) {
        newList.setAttribute('start', String(initialStartVal));
      }
    }
    while (parentList.firstChild) {
      newList.appendChild(parentList.firstChild);
    }
    Array.from(newList.querySelectorAll('li')).forEach((li) => {
      const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
      const firstText = walker.nextNode();
      if (firstText && firstText.nodeValue) {
        if (targetType === 'ul') {
          firstText.nodeValue = firstText.nodeValue.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '');
        } else {
          firstText.nodeValue = firstText.nodeValue.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '');
        }
      }
    });
    parentList.replaceWith(newList);
    handleContentMutated();
    editorRef.current?.focus();
  };

  // Keyboard handler for rich writing and shortcuts
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Undo shortcut: Ctrl+Z or Cmd+Z (without Shift)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    // Redo shortcut: Ctrl+Shift+Z, Cmd+Shift+Z, Ctrl+Y, or Cmd+Y
    if (
      ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) ||
      ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y'))
    ) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Dock back shortcut: Ctrl+Shift+D or Cmd+Shift+D
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      handleDockBack();
      return;
    }

    // Quick save shortcut: Ctrl+S
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      flushSave();
      return;
    }

    // Web link modal: Ctrl+K
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openWebLinkModal();
      return;
    }

    // Wiki autocomplete popup navigation
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

    // Tab & Shift+Tab: Sub-bullet list indentation or block indentation
    if (e.key === 'Tab') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const selectedLis = getSelectedListItems(sel);

        if (selectedLis.length > 0) {
          e.preventDefault();
          if (e.shiftKey) {
            outdentListItems(selectedLis, sel);
          } else {
            indentListItems(selectedLis, sel);
          }
          return;
        }

        // Multi-line selection outside of lists: indent/outdent all selected blocks
        if (!sel.isCollapsed) {
          const selectedBlocks = getSelectedBlocks(sel);
          if (selectedBlocks.length > 0) {
            e.preventDefault();
            if (e.shiftKey) {
              outdentBlocks(selectedBlocks, sel);
            } else {
              indentBlocks(selectedBlocks, sel);
            }
            return;
          }
        }

        // Single cursor outside list:
        if (e.shiftKey) {
          e.preventDefault();
          const range = sel.getRangeAt(0);
          const node = range.startContainer;
          if (node && node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            const offset = range.startOffset;
            if (offset >= 2 && text.slice(offset - 2, offset) === '  ') {
              node.textContent = text.slice(0, offset - 2) + text.slice(offset);
              range.setStart(node, offset - 2);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              handleContentMutated();
            } else if (offset >= 1 && (text[offset - 1] === ' ' || text[offset - 1] === '\u00a0')) {
              node.textContent = text.slice(0, offset - 1) + text.slice(offset);
              range.setStart(node, offset - 1);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              handleContentMutated();
            }
          }
          return;
        }

        // Outside list: insert 2 spaces instead of losing editor focus
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
        handleContentMutated();
        return;
      }
    }

    // Space key: markdown block triggers (#, ##, ###, -, *)
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

          // # -> Heading 1-6
          const headingMatch = trimmed.match(/^(#{1,6})$/);
          if (headingMatch) {
            e.preventDefault();
            const level = headingMatch[1].length;
            node.textContent = text.slice(offset);
            document.execCommand('formatBlock', false, `<h${level}>`);
            handleContentMutated();
            updateActiveHeading();
            return;
          }
          if (trimmed === '-' || trimmed === '*') {
            const inUl = node.parentElement?.closest('ul');
            if (inUl) return;
            e.preventDefault();
            node.textContent = text.slice(offset);
            toggleListFormat('ul');
            return;
          }
          if (trimmed === '- [ ]' || trimmed === '- [x]') {
            e.preventDefault();
            node.textContent = text.slice(offset);
            const isChecked = trimmed === '- [x]';
            const taskItem = document.createElement('div');
            taskItem.className = 'albaqros-task-item';
            taskItem.style.display = 'flex';
            taskItem.style.alignItems = 'center';
            taskItem.style.gap = '8px';
            taskItem.style.margin = '4px 0';
            taskItem.innerHTML = `<input type="checkbox" ${isChecked ? 'checked' : ''} style="cursor: pointer; accent-color: #10b981; width: 16px; height: 16px; margin: 0;"><span class="albaqros-task-text" style="font-size: 0.92rem; color: ${isChecked ? '#64748b' : '#f8fafc'}; ${isChecked ? 'text-decoration: line-through;' : ''}"><br></span>`;
            const currentBlock = node.parentElement?.closest('p, div') as HTMLElement | null;
            if (currentBlock && editorRef.current?.contains(currentBlock)) {
              currentBlock.replaceWith(taskItem);
            }
            const span = taskItem.querySelector('.albaqros-task-text');
            if (span) {
              const newRange = document.createRange();
              newRange.setStart(span, 0);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
              lastRangeRef.current = newRange.cloneRange();
            }
            handleContentMutated();
            return;
          }
          const numMatch = trimmed.match(/^(\d+)[.)]$/);
          if (numMatch) {
            const numVal = parseInt(numMatch[1], 10);
            const inOl = node.parentElement?.closest('ol') as HTMLElement | null;

            if (inOl && editorRef.current?.contains(inOl)) {
              e.preventDefault();
              node.textContent = text.slice(offset);

              const currentLi = node.parentElement?.closest('li') as HTMLElement | null;

              if (currentLi && inOl.contains(currentLi)) {
                const isFirstLi = !currentLi.previousElementSibling || currentLi.previousElementSibling.tagName.toUpperCase() !== 'LI';
                if (isFirstLi) {
                  inOl.setAttribute('start', String(numVal));
                } else {
                  // Split OL from currentLi onwards
                  const followingLis: HTMLElement[] = [currentLi];
                  let nextSib = currentLi.nextElementSibling;
                  while (nextSib) {
                    if (nextSib.tagName.toUpperCase() === 'LI') followingLis.push(nextSib as HTMLElement);
                    nextSib = nextSib.nextElementSibling;
                  }
                  const newOl = document.createElement('ol');
                  newOl.style.margin = inOl.style.margin || '6px 0 6px 24px';
                  newOl.style.padding = '0';
                  newOl.style.fontSize = inOl.style.fontSize || '0.92rem';
                  newOl.style.color = inOl.style.color || '#f8fafc';
                  newOl.style.lineHeight = inOl.style.lineHeight || '1.6';
                  newOl.style.listStyleType = 'decimal';
                  newOl.setAttribute('start', String(numVal));
                  followingLis.forEach((li) => newOl.appendChild(li));
                  inOl.insertAdjacentElement('afterend', newOl);
                }

                if (!node.textContent?.trim()) {
                  currentLi.innerHTML = '<br>';
                  const range = document.createRange();
                  range.setStart(currentLi, 0);
                  range.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  lastRangeRef.current = range.cloneRange();
                } else {
                  const range = document.createRange();
                  range.setStart(node, 0);
                  range.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  lastRangeRef.current = range.cloneRange();
                }

                handleContentMutated();
                return;
              }
            }

            e.preventDefault();
            node.textContent = text.slice(offset);
            toggleListFormat('ol', numVal);
            return;
          }
        }
      }
    }

    // Enter key: Outdent empty sub-bullets before exiting, or convert "10. Text" into <ol start="10">
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const currentLi = getActiveListItem(sel);

        if (currentLi && isListItemEmpty(currentLi)) {
          e.preventDefault();
          const parentSubList = currentLi.closest('ul, ol') as HTMLElement | null;
          const parentLi = parentSubList?.parentElement?.closest('li') as HTMLElement | null;
          if (parentLi) {
            outdentListItem(currentLi, sel);
          } else {
            exitListToNormalParagraph(currentLi, sel);
          }
          return;
        }

        if (!currentLi && !e.shiftKey) {
          const currentBlock = (
            sel.anchorNode.nodeType === Node.ELEMENT_NODE
              ? (sel.anchorNode as HTMLElement).closest('p, div')
              : sel.anchorNode.parentElement?.closest('p, div')
          ) as HTMLElement | null;

          if (currentBlock && editorRef.current?.contains(currentBlock)) {
            const blockText = (currentBlock.textContent || '').replace(/[\u00a0\u200b\r\n\t]/g, ' ').trim();
            const numMatch = blockText.match(/^(\d+)[.)]\s*(.*)$/);

            if (numMatch) {
              const numVal = parseInt(numMatch[1], 10);
              const textAfter = numMatch[2].trim();

              if (!textAfter) {
                e.preventDefault();
                currentBlock.innerHTML = '<br>';
                const range = document.createRange();
                range.setStart(currentBlock, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                lastRangeRef.current = range.cloneRange();
                handleContentMutated();
                return;
              }

              const range = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
              const isAtEnd =
                !range || (sel.anchorNode.textContent && range.startOffset >= sel.anchorNode.textContent.trimEnd().length);

              if (isAtEnd) {
                e.preventDefault();
                const ol = document.createElement('ol');
                ol.style.margin = '6px 0 6px 24px';
                ol.style.padding = '0';
                ol.style.fontSize = '0.92rem';
                ol.style.color = '#f8fafc';
                ol.style.lineHeight = '1.6';
                ol.style.listStyleType = 'decimal';
                if (numVal > 1) {
                  ol.setAttribute('start', String(numVal));
                }

                const firstLi = document.createElement('li');
                firstLi.style.margin = '3px 0';
                firstLi.innerHTML = currentBlock.innerHTML.replace(/^\s*\d+[.)][\s\u00a0]*/, '');
                if (!firstLi.textContent?.trim()) {
                  firstLi.textContent = textAfter;
                }

                const secondLi = document.createElement('li');
                secondLi.style.margin = '3px 0';
                secondLi.appendChild(document.createElement('br'));

                ol.appendChild(firstLi);
                ol.appendChild(secondLi);

                currentBlock.replaceWith(ol);

                const newRange = document.createRange();
                newRange.setStart(secondLi, 0);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
                lastRangeRef.current = newRange.cloneRange();
                handleContentMutated();
                return;
              }
            }
          }
        }
      }
    }

    // Backspace key: Outdent empty sub-bullets before exiting, or un-list root item to normal paragraph
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const currentLi = getActiveListItem(sel);

        if (currentLi && isListItemEmpty(currentLi)) {
          e.preventDefault();
          const parentSubList = currentLi.closest('ul, ol') as HTMLElement | null;
          const parentLi = parentSubList?.parentElement?.closest('li') as HTMLElement | null;
          if (parentLi) {
            outdentListItem(currentLi, sel);
          } else {
            exitListToNormalParagraph(currentLi, sel);
          }
          return;
        }

        if (currentLi && sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          try {
            const preRange = document.createRange();
            preRange.setStart(currentLi, 0);
            preRange.setEnd(range.startContainer, range.startOffset);
            if (preRange.toString().length === 0) {
              const parentSubList = currentLi.closest('ul, ol') as HTMLElement | null;
              const parentLi = parentSubList?.parentElement?.closest('li') as HTMLElement | null;
              if (parentLi) {
                e.preventDefault();
                outdentListItem(currentLi, sel);
                return;
              } else {
                e.preventDefault();
                convertListItemToParagraph(currentLi, sel);
                return;
              }
            }
          } catch {}
        }
      }
    }
  };

  // Autocomplete typing trigger for [[
  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key) && wikiPopup.open) {
      return;
    }

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const offset = range.startOffset;
      const textBefore = text.slice(0, offset);

      const match = textBefore.match(/\[\[([^\]]*)$/);
      if (match) {
        const query = match[1];
        const rect = range.getBoundingClientRect();
        setWikiPopup({
          open: true,
          query,
          top: rect.bottom + 6,
          left: Math.max(20, rect.left),
          selectedIndex: 0,
        });
        return;
      }
    }

    if (wikiPopup.open) {
      setWikiPopup((prev) => ({ ...prev, open: false }));
    }
  };

  // Clicking on links or checkboxes inside the detached editor
  const handleEditorClick = (e: React.MouseEvent) => {
    // 1. External Web Link clicked -> open in OS default browser
    const externalLink = (e.target as HTMLElement).closest('.albaqros-external-link, a[href]');
    if (externalLink) {
      const href = externalLink.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternalUrl) {
          (window as any).electronAPI.openExternalUrl(href);
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
        return;
      }
    }

    // 2. Task item checkbox clicked
    const checkbox = (e.target as HTMLElement).closest('input[type="checkbox"]');
    if (checkbox) {
      pushHistorySnapshot(true);
      const taskContainer = checkbox.closest('.albaqros-task-item');
      const textSpan = taskContainer?.querySelector('.albaqros-task-text') as HTMLElement | null;
      const isChecked = (checkbox as HTMLInputElement).checked;
      if (textSpan) {
        textSpan.style.color = isChecked ? '#64748b' : '#f8fafc';
        textSpan.style.textDecoration = isChecked ? 'line-through' : 'none';
      }
      handleContentMutated(false, true);
      return;
    }
  };

  // Double-clicking on a list item's marker allows directly changing the start number
  const handleEditorDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const li = target?.closest('li');
    if (li && editorRef.current?.contains(li)) {
      const ol = li.closest('ol');
      if (ol) {
        const liRect = li.getBoundingClientRect();
        if (e.clientX <= liRect.left + 24) {
          e.preventDefault();
          const curStart = ol.getAttribute('start') || '1';
          const userVal = window.prompt('Número inicial da lista:', curStart);
          if (userVal !== null) {
            const parsed = parseInt(userVal.trim(), 10);
            if (!isNaN(parsed) && parsed > 0) {
              ol.setAttribute('start', String(parsed));
              handleContentMutated();
            }
          }
        }
      }
    }
  };

  const title = note?.title || extractTitle(contentRef.current, currentNotePath);
  const folder = note?.folder || (currentNotePath.includes('/') ? currentNotePath.substring(0, currentNotePath.lastIndexOf('/')) : '');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0b0d11',
        color: '#f8fafc',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ─── FRAMELESS CUSTOM TITLEBAR ─── */}
      <header
        className="titlebar-draggable"
        style={{
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          backgroundColor: 'rgba(15, 18, 24, 0.95)',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        {/* Left: Branding & Note Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <img
            src={albaqrosLogo}
            alt="Albaqros"
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '4px',
              objectFit: 'cover',
              boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
              flexShrink: 0,
            }}
          />

          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-display)',
              color: '#818cf8',
              flexShrink: 0,
            }}
          >
            NOTE
          </span>

          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>/</span>

          {folder && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#a5b4fc',
                fontWeight: 600,
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                flexShrink: 0,
              }}
            >
              <Folder size={10} />
              <span>{folder}</span>
            </span>
          )}

          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#f8fafc',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '260px',
            }}
            title={title}
          >
            {title}
          </span>

          {/* Save Status Badge */}
          <span
            style={{
              fontSize: '0.65rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '1px 7px',
              borderRadius: '999px',
              backgroundColor: isSaving
                ? 'rgba(245, 158, 11, 0.15)'
                : 'rgba(16, 185, 129, 0.12)',
              color: isSaving ? '#fbbf24' : '#34d399',
              border: `1px solid ${isSaving ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: isSaving ? '#fbbf24' : '#34d399',
              }}
            />
            <span>{isSaving ? 'Saving...' : 'Saved'}</span>
          </span>
        </div>

        {/* Right: Actions & Window Controls (Non-Draggable) */}
        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Always on Top Pin Button */}
          <button
            type="button"
            onClick={handleToggleAlwaysOnTop}
            title={isAlwaysOnTop ? 'Unpin (currently always on top)' : 'Keep note floating on top of all windows'}
            className="btn-icon"
            style={{
              width: '28px',
              height: '28px',
              color: isAlwaysOnTop ? '#38bdf8' : 'var(--text-secondary)',
              backgroundColor: isAlwaysOnTop ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
              border: `1px solid ${isAlwaysOnTop ? 'rgba(56, 189, 248, 0.4)' : 'transparent'}`,
            }}
          >
            <Pin size={13} style={{ transform: isAlwaysOnTop ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>

          {/* DOCK BACK TO ALBAQROS BUTTON */}
          <button
            type="button"
            onClick={handleDockBack}
            title="Dock this note back into the main Albaqros window (Ctrl+Shift+D)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 11px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(56, 189, 248, 0.22))',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: '#c7d2fe',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(56, 189, 248, 0.35))';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.6)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.22), rgba(56, 189, 248, 0.22))';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
              e.currentTarget.style.color = '#c7d2fe';
            }}
          >
            <PanelLeftClose size={13} color="#818cf8" />
            <span>Dock to Albaqros</span>
          </button>

          <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

          {/* Standard Window Controls */}
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimize"
            className="btn-icon"
            style={{ width: '28px', height: '28px' }}
          >
            <Minus size={13} />
          </button>

          <button
            type="button"
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Restore Window' : 'Maximize Window'}
            className="btn-icon"
            style={{ width: '28px', height: '28px' }}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Close Note Window (auto-saves)"
            className="btn-icon"
            style={{ width: '28px', height: '28px', color: '#f87171' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#f87171';
            }}
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* ─── FORMATTING TOOLBAR & TAGS BAR ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundColor: '#0f1218',
          flexWrap: 'wrap',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {/* Left: Tags */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
          <Tag size={13} style={{ color: '#38bdf8', opacity: 0.8, marginRight: '2px' }} />
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
                      if (e.key === 'Escape') setEditingTagIndex(null);
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
                    }}
                  />
                  <button type="button" onClick={() => handleSaveEditTag(tag)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}>
                    <Check size={12} />
                  </button>
                  <button type="button" onClick={() => setEditingTagIndex(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
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
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                }}
              >
                <span onClick={() => handleStartEditTag(idx, tag)} style={{ cursor: 'pointer' }}>
                  #{tag}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  title={`Remove tag #${tag}`}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(244, 63, 94, 0.8)', cursor: 'pointer', padding: '0 1px' }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

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
                  if (e.key === 'Escape') setIsAddingTag(false);
                }}
                autoFocus
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  width: '80px',
                  outline: 'none',
                }}
              />
              <button type="button" onClick={handleAddTag} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}>
                <Check size={12} />
              </button>
              <button type="button" onClick={() => setIsAddingTag(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
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
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <Plus size={11} />
              <span>Tag</span>
            </button>
          )}
        </div>

        {/* Right: Rich Formatting Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {/* Undo Button */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={handleUndo}
            disabled={!canUndo}
            title="Desfazer (Ctrl+Z) - até 150 passos"
            className="btn-icon"
            style={{
              width: '28px',
              height: '28px',
              color: canUndo ? '#f8fafc' : 'rgba(255, 255, 255, 0.25)',
              borderRadius: '5px',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              opacity: canUndo ? 1 : 0.45,
            }}
          >
            <Undo size={14} />
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={handleRedo}
            disabled={!canRedo}
            title="Refazer (Ctrl+Shift+Z ou Ctrl+Y)"
            className="btn-icon"
            style={{
              width: '28px',
              height: '28px',
              color: canRedo ? '#f8fafc' : 'rgba(255, 255, 255, 0.25)',
              borderRadius: '5px',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              opacity: canRedo ? 1 : 0.45,
            }}
          >
            <Redo size={14} />
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.1)', margin: '0 2px' }} />

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveCurrentSelection();
            }}
            onClick={() => {
              toggleListFormat('ol');
            }}
            title="Lista Numerada (digite ex: 10. + Espaço, ou clique aqui para definir número inicial)"
            className="btn-icon"
            style={{ width: '28px', height: '28px', color: '#38bdf8', borderRadius: '5px' }}
          >
            <ListOrdered size={14} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveCurrentSelection();
            }}
            onClick={() => {
              toggleListFormat('ul');
            }}
            title="Bullet List (- + Space, Tab to indent sub-bullet)"
            className="btn-icon"
            style={{ width: '28px', height: '28px', color: '#cbd5e1', borderRadius: '5px' }}
          >
            <List size={14} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveCurrentSelection();
            }}
            onClick={() => {
              const taskItem = document.createElement('div');
              taskItem.className = 'albaqros-task-item';
              taskItem.style.display = 'flex';
              taskItem.style.alignItems = 'center';
              taskItem.style.gap = '8px';
              taskItem.style.margin = '4px 0';
              taskItem.innerHTML = `<input type="checkbox" style="cursor: pointer; accent-color: #10b981; width: 16px; height: 16px; margin: 0;"><span class="albaqros-task-text" style="font-size: 0.92rem; color: #f8fafc;"><br></span>`;
              const sel = window.getSelection();
              if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                range.insertNode(taskItem);
                const span = taskItem.querySelector('.albaqros-task-text');
                if (span) {
                  const newRange = document.createRange();
                  newRange.setStart(span, 0);
                  newRange.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(newRange);
                }
              } else if (editorRef.current) {
                editorRef.current.appendChild(taskItem);
              }
              editorRef.current?.focus();
              handleContentMutated(false, true);
            }}
            title="Task Checklist (- [ ] + Space)"
            className="btn-icon"
            style={{ width: '28px', height: '28px', color: '#10b981', borderRadius: '5px' }}
          >
            <CheckSquare size={13} />
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveCurrentSelection();
            }}
            onClick={() => {
              document.execCommand('bold');
              handleContentMutated(false, true);
              editorRef.current?.focus();
            }}
            title="Bold (Ctrl+B)"
            className="btn-icon"
            style={{ width: '28px', height: '28px', color: '#cbd5e1', borderRadius: '5px' }}
          >
            <Bold size={13} />
          </button>

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveCurrentSelection();
            }}
            onClick={() => {
              document.execCommand('italic');
              handleContentMutated(false, true);
              editorRef.current?.focus();
            }}
            title="Italic (Ctrl+I)"
            className="btn-icon"
            style={{ width: '28px', height: '28px', color: '#cbd5e1', borderRadius: '5px' }}
          >
            <Italic size={13} />
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveCurrentSelection();
            }}
            onClick={openWebLinkModal}
            title="Insert Link with custom text (Ctrl+K)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#38bdf8',
              cursor: 'pointer',
            }}
          >
            <Link2 size={12} />
            <span>Link</span>
          </button>
        </div>
      </div>

      {/* ─── LIVE-PREVIEW WRITING SURFACE ─── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 48px 60px',
          position: 'relative',
        }}
      >
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            updateActiveHeading();
            handleContentMutated();
          }}
          onBlur={() => {
            clearActiveHeading();
            flushSave();
          }}
          onFocus={updateActiveHeading}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={(e) => {
            saveCurrentSelection();
            handleEditorKeyUp(e);
            updateActiveHeading();
          }}
          onMouseUp={() => {
            saveCurrentSelection();
            updateActiveHeading();
          }}
          onSelect={() => {
            saveCurrentSelection();
            updateActiveHeading();
          }}
          onClick={(e) => {
            saveCurrentSelection();
            handleEditorClick(e);
            updateActiveHeading();
          }}
          onDoubleClick={handleEditorDoubleClick}
          className="albaqros-live-editor"
          data-placeholder="Start typing... Use # for H1, ## for H2, - for bullets (Tab to indent sub-bullets), [[ to link notes"
          style={{
            minHeight: '100%',
            outline: 'none',
            fontSize: '0.94rem',
            lineHeight: 1.65,
          }}
        />

        {/* Floating [[ Wikilink Suggestions Popup */}
        {wikiPopup.open && wikiSuggestions.length > 0 && (
          <div
            style={{
              position: 'fixed',
              top: `${wikiPopup.top}px`,
              left: `${wikiPopup.left}px`,
              zIndex: 200,
              backgroundColor: '#161b26',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
              width: '260px',
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            <div style={{ padding: '4px 8px', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              Link to Note:
            </div>
            {wikiSuggestions.map((s, idx) => (
              <div
                key={s.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertWikilink(s.title);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: idx === wikiPopup.selectedIndex ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                  color: idx === wikiPopup.selectedIndex ? '#818cf8' : 'var(--text-primary)',
                  fontSize: '0.78rem',
                }}
              >
                <BookOpen size={12} color="#818cf8" />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── BOTTOM STATUS & STATS STRIP ─── */}
      <footer
        style={{
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          backgroundColor: '#0a0c10',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>{stats.words.toLocaleString()} words</span>
          <span>·</span>
          <span>{stats.chars.toLocaleString()} chars</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={10} />
            <span>~{stats.readMinutes} min read</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>
            <kbd style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '1px 4px', borderRadius: '3px', fontSize: '0.62rem' }}>Tab</kbd> Sub-bullet
          </span>
          <span>·</span>
          <span>
            <kbd style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '1px 4px', borderRadius: '3px', fontSize: '0.62rem' }}>Ctrl+Shift+D</kbd> Dock to Albaqros
          </span>
          {lastSavedTime && (
            <>
              <span>·</span>
              <span>Saved {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </>
          )}
        </div>
      </footer>

      {/* ─── INSERT WEB LINK MODAL ─── */}
      {isWebLinkModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: '#161b26',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8)',
              width: '380px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Link2 size={14} color="#38bdf8" />
                <span>Insert Web Link</span>
              </div>
              <button
                type="button"
                onClick={() => setIsWebLinkModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                URL:
              </label>
              <input
                type="text"
                placeholder="https://..."
                value={webLinkUrl}
                onChange={(e) => setWebLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmInsertWebLink();
                  if (e.key === 'Escape') setIsWebLinkModalOpen(false);
                }}
                autoFocus
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  backgroundColor: '#0b0d11',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Display Label (optional):
              </label>
              <input
                type="text"
                placeholder="Custom anchor text..."
                value={webLinkLabel}
                onChange={(e) => setWebLinkLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmInsertWebLink();
                  if (e.key === 'Escape') setIsWebLinkModalOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  backgroundColor: '#0b0d11',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setIsWebLinkModalOpen(false)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmInsertWebLink}
                disabled={!webLinkUrl.trim()}
                style={{
                  padding: '5px 14px',
                  borderRadius: '4px',
                  backgroundColor: webLinkUrl.trim() ? '#38bdf8' : 'rgba(56, 189, 248, 0.2)',
                  border: 'none',
                  color: '#0b0d11',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: webLinkUrl.trim() ? 'pointer' : 'default',
                }}
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
