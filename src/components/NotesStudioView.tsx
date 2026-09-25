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
  ListOrdered,
  CheckSquare,
  Code,
  Bold,
  Italic,
  X,
  Check,
  Save,
  Cloud,
  Tag,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { NoteMetadata } from '../types';
import { NotesService, extractTags, extractTitle, extractPlainTextPreview } from '../services/notesService';
import {
  markdownToHtml,
  htmlToMarkdown,
  extractAllNoteTags,
  removeTagFromContent,
  renameTagInContent,
  isListItemEmpty,
  cleanAllEmptyListItems,
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
  const [isWebLinkModalOpen, setIsWebLinkModalOpen] = useState<boolean>(false);
  const [linkDisplayText, setLinkDisplayText] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState<string>('');
  const [editingLinkNode, setEditingLinkNode] = useState<HTMLAnchorElement | null>(null);

  // Hover Link Tooltip/Popover state
  const [hoverLinkInfo, setHoverLinkInfo] = useState<{
    url: string;
    text: string;
    targetEl: HTMLAnchorElement | null;
    top: number;
    left: number;
  } | null>(null);
  const hoverLinkTimeoutRef = useRef<number | null>(null);

  const [isNewNoteOpen, setIsNewNoteOpen] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteFolder, setNewNoteFolder] = useState<string>('');
  const [newNoteCustomFolder, setNewNoteCustomFolder] = useState<string>('');
  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [renameTarget, setRenameTarget] = useState<NoteMetadata | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [renameFolder, setRenameFolder] = useState<string>('');
  const [renameCustomFolder, setRenameCustomFolder] = useState<string>('');
  const [discoveredFolders, setDiscoveredFolders] = useState<string[]>([]);
  const [isNoteFolderDropdownOpen, setIsNoteFolderDropdownOpen] = useState<boolean>(false);
  const [draggedNotePath, setDraggedNotePath] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const lastRangeRef = useRef<Range | null>(null);

  // Load notes on mount
  const loadNotesList = useCallback(async (selectPath?: string) => {
    const res = await NotesService.listNotes();
    if (res.success) {
      setNotes(res.notes);
      if (res.folders) setDiscoveredFolders(res.folders);
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

  // Open the Web Link modal (Ctrl+K or toolbar button)
  const openWebLinkModal = (existingEl?: HTMLAnchorElement) => {
    if (existingEl) {
      setEditingLinkNode(existingEl);
      setLinkDisplayText(existingEl.textContent || '');
      setLinkUrl(existingEl.getAttribute('href') || '');
      setIsWebLinkModalOpen(true);
      return;
    }

    setEditingLinkNode(null);

    const sel = window.getSelection();
    let selectedText = '';
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      lastRangeRef.current = range.cloneRange();
      selectedText = range.toString().trim();

      // Check if selected range is inside an existing link
      const anchor = (range.startContainer.parentElement?.closest('a.albaqros-external-link') ||
        (sel.anchorNode as HTMLElement)?.closest?.('a.albaqros-external-link')) as HTMLAnchorElement | null;
      if (anchor) {
        setEditingLinkNode(anchor);
        setLinkDisplayText(anchor.textContent || '');
        setLinkUrl(anchor.getAttribute('href') || '');
        setIsWebLinkModalOpen(true);
        return;
      }
    }

    if (selectedText) {
      if (/^https?:\/\/[^\s]+$/i.test(selectedText)) {
        setLinkUrl(selectedText);
        setLinkDisplayText('');
      } else {
        setLinkDisplayText(selectedText);
        setLinkUrl('');
      }
    } else {
      setLinkDisplayText('');
      setLinkUrl('');
    }

    // Attempt to prefill URL from clipboard if user hasn't selected a URL
    if (navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((clip) => {
          const trimmed = (clip || '').trim();
          if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
            setLinkUrl((prev) => (prev ? prev : trimmed));
          }
        })
        .catch(() => {});
    }

    setIsWebLinkModalOpen(true);
  };

  // Insert new web link or update existing link
  const insertOrUpdateWebLink = (displayText: string, url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    const fullUrl = /^(?:https?:\/\/|mailto:)/i.test(cleanUrl)
      ? cleanUrl
      : (cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : `https://${cleanUrl}`);

    const label = displayText.trim() || fullUrl;

    if (editingLinkNode && editorRef.current?.contains(editingLinkNode)) {
      editingLinkNode.href = fullUrl;
      editingLinkNode.title = fullUrl;
      editingLinkNode.textContent = label;
      setEditingLinkNode(null);
      setIsWebLinkModalOpen(false);
      handleContentMutated();
      return;
    }

    const sel = window.getSelection();
    let range: Range | null = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : lastRangeRef.current;
    if (!range && lastRangeRef.current) {
      range = lastRangeRef.current;
    }

    const linkEl = document.createElement('a');
    linkEl.className = 'albaqros-external-link';
    linkEl.href = fullUrl;
    linkEl.target = '_blank';
    linkEl.rel = 'noopener noreferrer';
    linkEl.title = fullUrl;
    linkEl.textContent = label;

    const space = document.createTextNode('\u00A0');

    if (range && editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(space);
      range.insertNode(linkEl);

      const newRange = document.createRange();
      newRange.setStartAfter(space);
      newRange.collapse(true);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
      lastRangeRef.current = newRange.cloneRange();
    } else if (editorRef.current) {
      editorRef.current.appendChild(linkEl);
      editorRef.current.appendChild(space);
    }

    if (editorRef.current) {
      editorRef.current.focus();
    }

    setIsWebLinkModalOpen(false);
    handleContentMutated();
  };

  // Unlink an anchor node (replaces <a>text</a> with text)
  const handleUnlinkNode = (anchor: HTMLAnchorElement) => {
    if (!anchor || !editorRef.current?.contains(anchor)) return;
    const textNode = document.createTextNode(anchor.textContent || '');
    anchor.parentNode?.replaceChild(textNode, anchor);
    setHoverLinkInfo(null);
    handleContentMutated();
  };

  // When pressing Enter on an empty bullet point (or 2 enters between bullets):
  // 1. Stop creating bullet points and automatically switch back to normal mode (paragraph)
  // 2. Delete all bullet points that were created that have no words after them
  const exitListToNormalParagraph = (currentLi: HTMLElement, sel: Selection) => {
    const parentList = currentLi.closest('ul, ol') as HTMLElement | null;

    const normalP = document.createElement('p');
    normalP.style.margin = '6px 0';
    normalP.style.fontSize = '0.94rem';
    normalP.style.lineHeight = '1.65';
    normalP.style.color = '#f8fafc';
    const br = document.createElement('br');
    normalP.appendChild(br);

    if (parentList) {
      // Collect any subsequent sibling lis if currentLi was in the middle of a list
      const followingLis: Element[] = [];
      let sibling = currentLi.nextElementSibling;
      while (sibling) {
        followingLis.push(sibling);
        sibling = sibling.nextElementSibling;
      }

      currentLi.remove();

      // Delete any other bullet points in this list that have no words after them
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
        if (isOl) {
          secondList.style.listStyleType = 'decimal';
        }
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

    // Clean any other empty bullet points in the editor with no words after them
    if (editorRef.current) {
      cleanAllEmptyListItems(editorRef.current);
    }

    // Set cursor cleanly inside the normal paragraph
    const range = document.createRange();
    range.setStart(normalP, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    lastRangeRef.current = range.cloneRange();

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

    // Web Link shortcut: Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openWebLinkModal();
      return;
    }

    // Markdown link completion on typing ')' or Space: [text](url)
    if (e.key === ')' || e.key === ' ' || e.code === 'Space') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          const offset = range.startOffset;
          const typedChar = e.key === ')' ? ')' : '';
          const candidate = (text.slice(0, offset) + typedChar).trim();
          const match = candidate.match(/(?<!!)\[(.*?)\]\(([^\s)]+)\)$/);
          if (match) {
            e.preventDefault();
            const matchLen = match[0].length;
            const beforeText = candidate.slice(0, candidate.length - matchLen);
            const afterText = text.slice(offset);

            const rawUrl = match[2].trim();
            const fullUrl = /^(?:https?:\/\/|mailto:)/i.test(rawUrl)
              ? rawUrl
              : (rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl);
            const label = match[1].trim() || fullUrl;

            node.textContent = beforeText;

            const linkEl = document.createElement('a');
            linkEl.className = 'albaqros-external-link';
            linkEl.href = fullUrl;
            linkEl.target = '_blank';
            linkEl.rel = 'noopener noreferrer';
            linkEl.title = fullUrl;
            linkEl.textContent = label;

            const spaceNode = document.createTextNode('\u00A0');
            const parent = node.parentNode;
            if (parent) {
              parent.insertBefore(linkEl, node.nextSibling);
              parent.insertBefore(spaceNode, linkEl.nextSibling);
              if (afterText) {
                const afterNode = document.createTextNode(afterText);
                parent.insertBefore(afterNode, spaceNode.nextSibling);
              }

              const newRange = document.createRange();
              newRange.setStartAfter(spaceNode);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
              lastRangeRef.current = newRange.cloneRange();
            }
            handleContentMutated();
            return;
          }
        }
      }
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
            const inUl = node.parentElement?.closest('ul');
            if (inUl) {
              return;
            }
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('insertUnorderedList');
            handleContentMutated();
            return;
          }

          // - [ ] or - [x] -> Task Checkbox
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
            const currentBlock = (node.parentElement?.closest('p, div')) as HTMLElement | null;
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

          // 1. or 1) -> Numbered / Ordered List (preserves start number)
          const numMatch = trimmed.match(/^(\d+)[.)]$/);
          if (numMatch) {
            const inOl = node.parentElement?.closest('ol');
            if (inOl) {
              return;
            }
            const numVal = parseInt(numMatch[1], 10);
            e.preventDefault();
            node.textContent = text.slice(offset);
            document.execCommand('insertOrderedList');
            if (numVal > 1) {
              const sel = window.getSelection();
              const ol = (sel?.anchorNode?.nodeType === Node.ELEMENT_NODE
                ? (sel?.anchorNode as HTMLElement).closest('ol')
                : sel?.anchorNode?.parentElement?.closest('ol'));
              if (ol) {
                ol.setAttribute('start', String(numVal));
              }
            }
            handleContentMutated();
            return;
          }
        }
      }
    }

    // 3. Enter key: If on an empty bullet point or numbered item (two enters), stop list, delete empty items, and return to normal mode
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        // Check if inside a task checkbox item
        const taskItem = (
          sel.anchorNode.nodeType === Node.ELEMENT_NODE
            ? (sel.anchorNode as HTMLElement).closest('.albaqros-task-item')
            : sel.anchorNode.parentElement?.closest('.albaqros-task-item')
        ) as HTMLElement | null;
        if (taskItem) {
          const textSpan = taskItem.querySelector('.albaqros-task-text');
          const spanText = (textSpan?.textContent || '').replace(/[\u00a0\u200b\r\n\t]/g, ' ').trim();
          if (!spanText) {
            // Empty task item: convert back to normal paragraph
            e.preventDefault();
            const p = document.createElement('p');
            p.style.margin = '6px 0';
            p.style.fontSize = '0.94rem';
            p.style.lineHeight = '1.65';
            p.style.color = '#f8fafc';
            p.appendChild(document.createElement('br'));
            taskItem.replaceWith(p);
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            lastRangeRef.current = range.cloneRange();
            handleContentMutated();
            return;
          }

          e.preventDefault();
          const newTaskItem = document.createElement('div');
          newTaskItem.className = 'albaqros-task-item';
          newTaskItem.style.display = 'flex';
          newTaskItem.style.alignItems = 'center';
          newTaskItem.style.gap = '8px';
          newTaskItem.style.margin = '4px 0';
          newTaskItem.innerHTML = `<input type="checkbox" style="cursor: pointer; accent-color: #10b981; width: 16px; height: 16px; margin: 0;"><span class="albaqros-task-text" style="font-size: 0.92rem; color: #f8fafc;"><br></span>`;
          taskItem.insertAdjacentElement('afterend', newTaskItem);
          const span = newTaskItem.querySelector('.albaqros-task-text');
          if (span) {
            const range = document.createRange();
            range.setStart(span, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            lastRangeRef.current = range.cloneRange();
          }
          handleContentMutated();
          return;
        }

        const currentLi = (
          sel.anchorNode.nodeType === Node.ELEMENT_NODE
            ? (sel.anchorNode as HTMLElement).closest('li')
            : sel.anchorNode.parentElement?.closest('li')
        ) as HTMLElement | null;

        if (currentLi && isListItemEmpty(currentLi)) {
          e.preventDefault();
          exitListToNormalParagraph(currentLi, sel);
          return;
        }

        // If not in a list item, check if current line/block starts with numbered list or bullet (e.g., "1. Potion")
        if (!currentLi && !e.shiftKey) {
          const currentBlock = (
            sel.anchorNode.nodeType === Node.ELEMENT_NODE
              ? (sel.anchorNode as HTMLElement).closest('p, div')
              : sel.anchorNode.parentElement?.closest('p, div')
          ) as HTMLElement | null;

          if (currentBlock && editorRef.current?.contains(currentBlock)) {
            const blockText = (currentBlock.textContent || '').replace(/[\u00a0\u200b\r\n\t]/g, ' ').trim();
            const numMatch = blockText.match(/^(\d+)[.)]\s*(.*)$/);
            const bulletMatch = !numMatch && blockText.match(/^([-*•])\s*(.*)$/);

            if (numMatch) {
              const numVal = parseInt(numMatch[1], 10);
              const textAfter = numMatch[2].trim();

              // If line was just "1." or "2." with NO words after it, pressing Enter clears the number and makes it a normal empty paragraph
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

              // If line has "1. Potion", convert currentBlock into an <ol> with the next <li> ready for typing!
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
            } else if (bulletMatch) {
              const textAfter = bulletMatch[2].trim();
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
                const ul = document.createElement('ul');
                ul.style.margin = '6px 0 6px 20px';
                ul.style.padding = '0';
                ul.style.fontSize = '0.92rem';
                ul.style.color = '#f8fafc';
                ul.style.lineHeight = '1.6';

                const firstLi = document.createElement('li');
                firstLi.style.margin = '3px 0';
                firstLi.innerHTML = currentBlock.innerHTML.replace(/^\s*[-*•]\s*/, '');
                if (!firstLi.innerHTML.trim()) {
                  firstLi.textContent = textAfter;
                }

                const secondLi = document.createElement('li');
                secondLi.style.margin = '3px 0';
                secondLi.appendChild(document.createElement('br'));

                ul.appendChild(firstLi);
                ul.appendChild(secondLi);

                currentBlock.replaceWith(ul);

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

        // Headings: ensure next line returns to standard paragraph size
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

    // 4. Backspace key: If on an empty bullet point or numbered item, cancel it, delete it, and return to normal mode
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
          exitListToNormalParagraph(currentLi, sel);
          return;
        }

        if (!currentLi) {
          const currentBlock = (
            sel.anchorNode.nodeType === Node.ELEMENT_NODE
              ? (sel.anchorNode as HTMLElement).closest('p, div')
              : sel.anchorNode.parentElement?.closest('p, div')
          ) as HTMLElement | null;

          if (currentBlock && editorRef.current?.contains(currentBlock)) {
            const blockText = (currentBlock.textContent || '').replace(/[\u00a0\u200b\r\n\t]/g, ' ').trim();
            // If block contains only a lone marker like "1.", "1)", "-", "*", "•"
            if (/^(\d+[.)]|[-*•])$/.test(blockText)) {
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
          }
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

  // Smart paste: if text is selected and clipboard contains a URL, convert selection into a link
  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedText = e.clipboardData.getData('text/plain')?.trim();
    if (!pastedText) return;

    const isUrl = /^https?:\/\/[^\s]+$/i.test(pastedText);
    const sel = window.getSelection();

    if (isUrl && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const selectedText = range.toString().trim();

      if (selectedText && !/^https?:\/\/[^\s]+$/i.test(selectedText)) {
        e.preventDefault();
        insertOrUpdateWebLink(selectedText, pastedText);
        return;
      }
    }
  };

  // Hover popover over links
  const handleEditorMouseOver = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a.albaqros-external-link') as HTMLAnchorElement | null;
    if (anchor && editorRef.current) {
      if (hoverLinkTimeoutRef.current) {
        clearTimeout(hoverLinkTimeoutRef.current);
        hoverLinkTimeoutRef.current = null;
      }
      const rect = anchor.getBoundingClientRect();
      const editorRect = editorRef.current.getBoundingClientRect();
      setHoverLinkInfo({
        url: anchor.getAttribute('href') || '',
        text: anchor.textContent || '',
        targetEl: anchor,
        top: rect.bottom - editorRect.top + editorRef.current.scrollTop + 6,
        left: Math.max(10, rect.left - editorRect.left),
      });
    }
  };

  const handleEditorMouseOut = (e: React.MouseEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (related?.closest?.('.albaqros-link-hover-card')) return;
    if (hoverLinkTimeoutRef.current) clearTimeout(hoverLinkTimeoutRef.current);
    hoverLinkTimeoutRef.current = window.setTimeout(() => {
      setHoverLinkInfo(null);
    }, 400);
  };

  // Clicking on links inside the live editor
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

    // 2. Blue internal note link clicked
    const target = (e.target as HTMLElement).closest('.albaqros-note-link');
    if (target) {
      const noteTarget = target.getAttribute('data-note-target');
      if (noteTarget) {
        handleWikilinkClick(noteTarget);
      }
      return;
    }

    // 3. Task item checkbox clicked
    const checkbox = (e.target as HTMLElement).closest('input[type="checkbox"]');
    if (checkbox) {
      const taskContainer = checkbox.closest('.albaqros-task-item');
      const textSpan = taskContainer?.querySelector('.albaqros-task-text') as HTMLElement | null;
      const isChecked = (checkbox as HTMLInputElement).checked;
      if (textSpan) {
        textSpan.style.color = isChecked ? '#64748b' : '#f8fafc';
        textSpan.style.textDecoration = isChecked ? 'line-through' : 'none';
      }
      handleContentMutated();
      return;
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

  // Folders list (discovered on disk + referenced by notes)
  const allFolders = useMemo(() => {
    const flds = new Set<string>();
    for (const f of discoveredFolders) {
      if (f) flds.add(f);
    }
    for (const note of notes) {
      if (note.folder) flds.add(note.folder);
    }
    return Array.from(flds).sort();
  }, [discoveredFolders, notes]);

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

  // Move an existing note into any existing folder (or root)
  const handleMoveNoteToFolder = async (noteRelativePath: string, targetFolder: string) => {
    if (!noteRelativePath) return;
    if (activeNotePathRef.current === noteRelativePath) {
      await flushSave();
    }
    const cleanTargetFolder = targetFolder.trim();
    const note = notes.find((n) => n.relativePath === noteRelativePath);
    const title = note?.title || noteRelativePath.split('/').pop()?.replace(/\.md$/i, '') || 'Note';

    const res = await NotesService.renameNote(noteRelativePath, title, cleanTargetFolder);
    if (res) {
      if (activeNotePathRef.current === noteRelativePath) {
        activeNotePathRef.current = res.relativePath;
        setActiveNotePath(res.relativePath);
      }
      await loadNotesList(res.relativePath);
    }
  };

  // New Note
  const handleCreateNewNote = async () => {
    const title = newNoteTitle.trim() || 'Untitled Note';
    const folder = (
      newNoteFolder === '__NEW_FOLDER__' ? newNoteCustomFolder.trim() : newNoteFolder.trim()
    ) || undefined;
    const res = await NotesService.createNote(title, folder);
    if (res) {
      setIsNewNoteOpen(false);
      setNewNoteTitle('');
      setNewNoteFolder('');
      setNewNoteCustomFolder('');
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

  // Rename & Move note
  const handleRenameNote = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const finalFolder =
      renameFolder === '__NEW_FOLDER__' ? renameCustomFolder.trim() : renameFolder.trim();
    const res = await NotesService.renameNote(
      renameTarget.relativePath,
      renameValue.trim(),
      finalFolder
    );
    if (res) {
      if (activeNotePathRef.current === renameTarget.relativePath) {
        activeNotePathRef.current = res.relativePath;
        setActiveNotePath(res.relativePath);
      }
      setRenameTarget(null);
      setRenameValue('');
      setRenameFolder('');
      setRenameCustomFolder('');
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
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverFolder('__ROOT__');
                  }}
                  onDragLeave={() => setDragOverFolder(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const notePath = draggedNotePath || e.dataTransfer.getData('text/plain');
                    if (notePath) {
                      handleMoveNoteToFolder(notePath, '');
                    }
                    setDragOverFolder(null);
                    setDraggedNotePath(null);
                  }}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: dragOverFolder === '__ROOT__' ? '1px dashed #818cf8' : '1px solid transparent',
                    backgroundColor:
                      dragOverFolder === '__ROOT__'
                        ? 'rgba(99, 102, 241, 0.35)'
                        : selectedFolder === null
                        ? 'rgba(99, 102, 241, 0.25)'
                        : 'rgba(255, 255, 255, 0.04)',
                    color: selectedFolder === null || dragOverFolder === '__ROOT__' ? '#818cf8' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: selectedFolder === null ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                  title="Drop note here to move to Root (or click to view All)"
                >
                  All (Root)
                </button>
                {allFolders.map((folder) => {
                  const isDropHover = dragOverFolder === folder;
                  return (
                    <button
                      key={folder}
                      type="button"
                      onClick={() => setSelectedFolder(selectedFolder === folder ? null : folder)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverFolder(folder);
                      }}
                      onDragLeave={() => setDragOverFolder(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const notePath = draggedNotePath || e.dataTransfer.getData('text/plain');
                        if (notePath) {
                          handleMoveNoteToFolder(notePath, folder);
                        }
                        setDragOverFolder(null);
                        setDraggedNotePath(null);
                      }}
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: isDropHover ? '1px dashed #818cf8' : '1px solid transparent',
                        backgroundColor:
                          isDropHover
                            ? 'rgba(99, 102, 241, 0.35)'
                            : selectedFolder === folder
                            ? 'rgba(99, 102, 241, 0.25)'
                            : 'rgba(255, 255, 255, 0.04)',
                        color: selectedFolder === folder || isDropHover ? '#818cf8' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transform: isDropHover ? 'scale(1.05)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                      title={`Drop note here to move into "${folder}"`}
                    >
                      <Folder size={11} />
                      <span>{folder}</span>
                    </button>
                  );
                })}
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
              const isDragging = draggedNotePath === note.relativePath;
              return (
                <div
                  key={note.id}
                  onClick={() => selectNote(note.relativePath)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', note.relativePath);
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedNotePath(note.relativePath);
                  }}
                  onDragEnd={() => {
                    setDraggedNotePath(null);
                    setDragOverFolder(null);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '4px',
                    cursor: 'grab',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                    border: isActive ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                    opacity: isDragging ? 0.45 : 1,
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
                          setRenameFolder(note.folder || '');
                          setRenameCustomFolder('');
                        }}
                        title="Rename & Move Note"
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
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFolder(note.folder);
                      }}
                      title={`Filter by folder: ${note.folder}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.67rem',
                        color: '#818cf8',
                        backgroundColor: 'rgba(99, 102, 241, 0.12)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        marginTop: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      <Folder size={10} />
                      <span>{note.folder}</span>
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
                setNewNoteFolder(selectedFolder || '');
                setNewNoteCustomFolder('');
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
              {/* ─── SIDE-BY-SIDE TAGS & QUICK TOOLBAR ─── */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '20px',
                  userSelect: 'none',
                }}
              >
                {/* Left: Folder Location & Tags */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  {/* Folder Location & Quick Move Dropdown */}
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <button
                      type="button"
                      onClick={() => setIsNoteFolderDropdownOpen((prev) => !prev)}
                      title="Click to move note into another folder"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: activeNote.folder ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: activeNote.folder ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid var(--border-subtle)',
                        color: activeNote.folder ? '#a5b4fc' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Folder size={12} color={activeNote.folder ? '#818cf8' : 'var(--text-muted)'} />
                      <span>{activeNote.folder ? activeNote.folder : 'Root (No folder)'}</span>
                      <ChevronDown size={11} style={{ opacity: 0.7 }} />
                    </button>

                    {isNoteFolderDropdownOpen && (
                      <>
                        <div
                          style={{ position: 'fixed', inset: 0, zIndex: 120 }}
                          onClick={() => setIsNoteFolderDropdownOpen(false)}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            minWidth: '210px',
                            backgroundColor: '#161b26',
                            border: '1px solid var(--border-medium)',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                            zIndex: 130,
                            padding: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          <div style={{ padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Move Note To:
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsNoteFolderDropdownOpen(false);
                              if (activeNote.folder) {
                                handleMoveNoteToFolder(activeNote.relativePath, '');
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: !activeNote.folder ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                              color: !activeNote.folder ? '#818cf8' : 'var(--text-primary)',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Folder size={12} />
                              <span>Root (No folder)</span>
                            </div>
                            {!activeNote.folder && <Check size={12} />}
                          </button>

                          {allFolders.map((fld) => (
                            <button
                              key={fld}
                              type="button"
                              onClick={() => {
                                setIsNoteFolderDropdownOpen(false);
                                if (activeNote.folder !== fld) {
                                  handleMoveNoteToFolder(activeNote.relativePath, fld);
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: activeNote.folder === fld ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                color: activeNote.folder === fld ? '#818cf8' : 'var(--text-primary)',
                                fontSize: '0.75rem',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <Folder size={12} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fld}</span>
                              </div>
                              {activeNote.folder === fld && <Check size={12} />}
                            </button>
                          ))}

                          <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
                          <button
                            type="button"
                            onClick={() => {
                              setIsNoteFolderDropdownOpen(false);
                              setIsNewFolderOpen(true);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#38bdf8',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <FolderPlus size={12} />
                            <span>+ Create New Folder...</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

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

                {/* Right: Quick Action Buttons & Formatting Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      document.execCommand('insertOrderedList');
                      handleContentMutated();
                      editorRef.current?.focus();
                    }}
                    title="Numbered List (1. + Space)"
                    className="btn-icon"
                    style={{ width: '28px', height: '28px', color: '#38bdf8', borderRadius: '5px', backgroundColor: 'rgba(56, 189, 248, 0.08)' }}
                  >
                    <ListOrdered size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      document.execCommand('insertUnorderedList');
                      handleContentMutated();
                      editorRef.current?.focus();
                    }}
                    title="Bullet List (- + Space)"
                    className="btn-icon"
                    style={{ width: '28px', height: '28px', color: '#cbd5e1', borderRadius: '5px' }}
                  >
                    <List size={14} />
                  </button>

                  <button
                    type="button"
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
                    onClick={() => openWebLinkModal()}
                    title="Insert Link with custom text (Ctrl+K)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)';
                    }}
                  >
                    <Link2 size={12} />
                    <span>Add Link</span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        opacity: 0.75,
                        marginLeft: '2px',
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                      }}
                    >
                      Ctrl+K
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLinkModalQuery('');
                      setIsLinkModalOpen(true);
                    }}
                    title="Link another note in vault ([[)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      color: '#818cf8',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
                    }}
                  >
                    <BookOpen size={12} />
                    <span>Link Note</span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        opacity: 0.75,
                        marginLeft: '2px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                      }}
                    >
                      [[
                    </span>
                  </button>
                </div>
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
                onPaste={handleEditorPaste}
                onMouseOver={handleEditorMouseOver}
                onMouseOut={handleEditorMouseOut}
                className="albaqros-live-editor"
                data-placeholder="Start typing... Use # for H1, ## for H2, ### for H3, - for bullets, [[ to link notes, or Ctrl+K for links"
              />

              {/* Floating Link Hover Card */}
              {hoverLinkInfo && (
                <div
                  className="albaqros-link-hover-card"
                  onMouseEnter={() => {
                    if (hoverLinkTimeoutRef.current) {
                      clearTimeout(hoverLinkTimeoutRef.current);
                      hoverLinkTimeoutRef.current = null;
                    }
                  }}
                  onMouseLeave={() => {
                    hoverLinkTimeoutRef.current = window.setTimeout(() => {
                      setHoverLinkInfo(null);
                    }, 300);
                  }}
                  style={{
                    position: 'absolute',
                    top: `${hoverLinkInfo.top}px`,
                    left: `${hoverLinkInfo.left}px`,
                    zIndex: 100,
                    backgroundColor: '#161b26',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    maxWidth: '380px',
                  }}
                >
                  <a
                    href={hoverLinkInfo.url}
                    onClick={(e) => {
                      e.preventDefault();
                      if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternalUrl) {
                        (window as any).electronAPI.openExternalUrl(hoverLinkInfo.url);
                      } else {
                        window.open(hoverLinkInfo.url, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    title="Open link in default browser"
                    style={{
                      fontSize: '0.75rem',
                      color: '#38bdf8',
                      textDecoration: 'underline',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '220px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ExternalLink size={11} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{hoverLinkInfo.url}</span>
                  </a>

                  <div style={{ height: '14px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />

                  <button
                    type="button"
                    onClick={() => {
                      if (hoverLinkInfo.targetEl) {
                        openWebLinkModal(hoverLinkInfo.targetEl);
                        setHoverLinkInfo(null);
                      }
                    }}
                    title="Edit display text or URL"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                    }}
                  >
                    <Edit2 size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (hoverLinkInfo.targetEl) {
                        handleUnlinkNode(hoverLinkInfo.targetEl);
                      }
                    }}
                    title="Remove link (keep text)"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-rose)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}

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
                Type <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>#</kbd>, <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>##</kbd>, <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>-</kbd>, <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>[[</kbd>, or <kbd style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '3px' }}>Ctrl+K</kbd> for Links
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
                setNewNoteFolder(selectedFolder || '');
                setNewNoteCustomFolder('');
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

      {/* ─── MODAL: INSERT / EDIT WEB LINK (CTRL+K) ─── */}
      {isWebLinkModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setIsWebLinkModalOpen(false);
            setEditingLinkNode(null);
          }}
        >
          <div
            style={{
              width: '460px',
              maxWidth: '92vw',
              backgroundColor: '#13171f',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-medium)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                <ExternalLink size={18} color="#38bdf8" />
                <span>{editingLinkNode ? 'Edit Web Link' : 'Insert Web Link'}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWebLinkModalOpen(false);
                  setEditingLinkNode(null);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                insertOrUpdateWebLink(linkDisplayText, linkUrl);
              }}
            >
              {/* Display Text Input */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Text to display in note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Get Good At Blender: A Step-by-Step Guide..."
                  value={linkDisplayText}
                  onChange={(e) => setLinkDisplayText(e.target.value)}
                  autoFocus={!linkDisplayText}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  What you read in the note instead of the raw URL
                </span>
              </div>

              {/* URL Input */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Destination URL
                </label>
                <input
                  type="text"
                  placeholder="https://grantabbitt.substack.com/p/get-good-at-blender..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  autoFocus={Boolean(linkDisplayText)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  The webpage opened when you click the link
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setIsWebLinkModalOpen(false);
                    setEditingLinkNode(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!linkUrl.trim()}
                  className="btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    borderColor: '#38bdf8',
                    opacity: !linkUrl.trim() ? 0.5 : 1,
                    cursor: !linkUrl.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Check size={14} />
                  <span>{editingLinkNode ? 'Save Changes' : 'Insert Link'}</span>
                </button>
              </div>
            </form>
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
                  Folder
                </label>
                <select
                  value={newNoteFolder}
                  onChange={(e) => setNewNoteFolder(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">📁 Root (No folder)</option>
                  {allFolders.map((fld) => (
                    <option key={fld} value={fld}>
                      📁 {fld}
                    </option>
                  ))}
                  <option value="__NEW_FOLDER__">➕ Create New Folder...</option>
                </select>

                {newNoteFolder === '__NEW_FOLDER__' && (
                  <input
                    type="text"
                    placeholder="Enter new folder name..."
                    value={newNoteCustomFolder}
                    onChange={(e) => setNewNoteCustomFolder(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateNewNote();
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid #818cf8',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                )}
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
                Rename & Move Note
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
                  Note Title
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

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Folder
                </label>
                <select
                  value={renameFolder}
                  onChange={(e) => setRenameFolder(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">📁 Root (No folder)</option>
                  {allFolders.map((fld) => (
                    <option key={fld} value={fld}>
                      📁 {fld}
                    </option>
                  ))}
                  <option value="__NEW_FOLDER__">➕ Create New Folder...</option>
                </select>

                {renameFolder === '__NEW_FOLDER__' && (
                  <input
                    type="text"
                    placeholder="Enter new folder name..."
                    value={renameCustomFolder}
                    onChange={(e) => setRenameCustomFolder(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameNote();
                    }}
                    autoFocus
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid #818cf8',
                      borderRadius: 'var(--radius-sm)',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                )}
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
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
