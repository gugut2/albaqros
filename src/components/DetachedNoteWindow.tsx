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
  const lastRangeRef = useRef<Range | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const isDirtyRef = useRef<boolean>(false);
  const contentRef = useRef<string>('');

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
          updateStatsFromText(editorRef.current.innerText || '');
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

    if (!isDirtyRef.current || !editorRef.current) return;

    const rawMd = htmlToMarkdown(editorRef.current.innerHTML, activeTags);
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

  const handleContentMutated = useCallback(() => {
    if (editorRef.current) {
      updateStatsFromText(editorRef.current.innerText || '');
    }
    scheduleSave();
  }, [scheduleSave, updateStatsFromText]);

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

  // Selection saver
  const saveCurrentSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      lastRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

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
    handleContentMutated();
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
    handleContentMutated();
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

  const indentListItem = (currentLi: HTMLElement, sel: Selection) => {
    const prevLi = currentLi.previousElementSibling as HTMLElement | null;
    if (!prevLi || prevLi.tagName.toUpperCase() !== 'LI') return;

    const parentList = currentLi.closest('ul, ol') as HTMLElement | null;
    const isOl = parentList?.tagName.toUpperCase() === 'OL';

    let subList = prevLi.querySelector(':scope > ul, :scope > ol') as HTMLElement | null;
    if (!subList) {
      subList = document.createElement(isOl ? 'ol' : 'ul');
      subList.style.margin = isOl ? '4px 0 4px 20px' : '4px 0 4px 18px';
      subList.style.padding = '0';
      subList.style.fontSize = '0.92rem';
      subList.style.color = '#f8fafc';
      subList.style.lineHeight = '1.6';
      if (!isOl) {
        const depth = getListNestingDepth(prevLi);
        subList.style.listStyleType = depth === 1 ? 'circle' : depth >= 2 ? 'square' : 'circle';
      } else {
        const depth = getListNestingDepth(prevLi);
        subList.style.listStyleType = depth === 1 ? 'lower-alpha' : 'lower-roman';
      }
      prevLi.appendChild(subList);
    }

    const startNode = sel.anchorNode;
    const startOffset = sel.anchorOffset;

    subList.appendChild(currentLi);

    if (!currentLi.childNodes.length || currentLi.innerHTML.trim() === '') {
      currentLi.innerHTML = '<br>';
    }

    let cursorSet = false;
    if (startNode && currentLi.contains(startNode)) {
      try {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        lastRangeRef.current = range.cloneRange();
        cursorSet = true;
      } catch {
        cursorSet = false;
      }
    }

    if (!cursorSet) {
      const range = document.createRange();
      const subListEl = currentLi.querySelector(':scope > ul, :scope > ol');
      if (subListEl) {
        range.setStartBefore(subListEl);
      } else {
        range.selectNodeContents(currentLi);
      }
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      lastRangeRef.current = range.cloneRange();
    }

    handleContentMutated();
  };

  const outdentListItem = (currentLi: HTMLElement, sel: Selection) => {
    const parentSubList = currentLi.closest('ul, ol') as HTMLElement | null;
    if (!parentSubList) return;

    const parentLi = parentSubList.parentElement?.closest('li') as HTMLElement | null;

    if (parentLi && parentLi.parentElement) {
      const startNode = sel.anchorNode;
      const startOffset = sel.anchorOffset;

      const followingLis: Element[] = [];
      let nextSib = currentLi.nextElementSibling;
      while (nextSib) {
        followingLis.push(nextSib);
        nextSib = nextSib.nextElementSibling;
      }

      parentLi.parentElement.insertBefore(currentLi, parentLi.nextSibling);

      if (followingLis.length > 0) {
        const isOl = parentSubList.tagName.toUpperCase() === 'OL';
        let newSubList = currentLi.querySelector(':scope > ul, :scope > ol') as HTMLElement | null;
        if (!newSubList) {
          newSubList = document.createElement(isOl ? 'ol' : 'ul');
          newSubList.style.margin = isOl ? '4px 0 4px 20px' : '4px 0 4px 18px';
          newSubList.style.padding = '0';
          newSubList.style.fontSize = '0.92rem';
          newSubList.style.color = '#f8fafc';
          newSubList.style.lineHeight = '1.6';
          currentLi.appendChild(newSubList);
        }
        followingLis.forEach((sib) => newSubList!.appendChild(sib));
      }

      if (parentSubList.children.length === 0) {
        parentSubList.remove();
      }

      let cursorSet = false;
      if (startNode && currentLi.contains(startNode)) {
        try {
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          lastRangeRef.current = range.cloneRange();
          cursorSet = true;
        } catch {
          cursorSet = false;
        }
      }

      if (!cursorSet) {
        const range = document.createRange();
        const subListEl = currentLi.querySelector(':scope > ul, :scope > ol');
        if (subListEl) {
          range.setStartBefore(subListEl);
        } else {
          range.selectNodeContents(currentLi);
        }
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        lastRangeRef.current = range.cloneRange();
      }

      handleContentMutated();
    } else {
      if (isListItemEmpty(currentLi)) {
        exitListToNormalParagraph(currentLi, sel);
      }
    }
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
    lastRangeRef.current = range.cloneRange();

    handleContentMutated();
  };

  // Keyboard handler for rich writing and shortcuts
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
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

    // Tab & Shift+Tab: Sub-bullet list indentation
    if (e.key === 'Tab') {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const currentLi = (
          sel.anchorNode.nodeType === Node.ELEMENT_NODE
            ? (sel.anchorNode as HTMLElement).closest('li')
            : sel.anchorNode.parentElement?.closest('li')
        ) as HTMLElement | null;

        if (currentLi && editorRef.current?.contains(currentLi)) {
          e.preventDefault();
          if (e.shiftKey) {
            outdentListItem(currentLi, sel);
          } else {
            indentListItem(currentLi, sel);
          }
          return;
        }

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

          if (trimmed === '#') {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('formatBlock', false, '<h1>');
            handleContentMutated();
            return;
          }
          if (trimmed === '##') {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('formatBlock', false, '<h2>');
            handleContentMutated();
            return;
          }
          if (trimmed === '###') {
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('formatBlock', false, '<h3>');
            handleContentMutated();
            return;
          }
          if (trimmed === '-' || trimmed === '*') {
            const inUl = node.parentElement?.closest('ul');
            if (inUl) return;
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('insertUnorderedList');
            handleContentMutated();
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
            const inOl = node.parentElement?.closest('ol');
            if (inOl) return;
            const numVal = parseInt(numMatch[1], 10);
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('insertOrderedList');
            if (numVal > 1) {
              const ol = sel?.anchorNode?.nodeType === Node.ELEMENT_NODE
                ? (sel?.anchorNode as HTMLElement).closest('ol')
                : sel?.anchorNode?.parentElement?.closest('ol');
              if (ol) ol.setAttribute('start', String(numVal));
            }
            handleContentMutated();
            return;
          }
        }
      }
    }

    // Enter key: Outdent empty sub-bullets before exiting
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const currentLi = (
          sel.anchorNode.nodeType === Node.ELEMENT_NODE
            ? (sel.anchorNode as HTMLElement).closest('li')
            : sel.anchorNode.parentElement?.closest('li')
        ) as HTMLElement | null;

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
      }
    }

    // Backspace key: Outdent empty sub-bullets before exiting
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const currentLi = (
          sel.anchorNode.nodeType === Node.ELEMENT_NODE
            ? (sel.anchorNode as HTMLElement).closest('li')
            : sel.anchorNode.parentElement?.closest('li')
        ) as HTMLElement | null;

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
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              saveCurrentSelection();
            }}
            onClick={() => {
              document.execCommand('insertOrderedList');
              handleContentMutated();
              editorRef.current?.focus();
            }}
            title="Numbered List (1. + Space)"
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
              document.execCommand('insertUnorderedList');
              handleContentMutated();
              editorRef.current?.focus();
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
              handleContentMutated();
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
              handleContentMutated();
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
              handleContentMutated();
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
          onInput={handleContentMutated}
          onBlur={flushSave}
          onKeyDown={handleEditorKeyDown}
          onKeyUp={(e) => {
            saveCurrentSelection();
            handleEditorKeyUp(e);
          }}
          onMouseUp={saveCurrentSelection}
          onSelect={saveCurrentSelection}
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
