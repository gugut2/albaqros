import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  LayoutGrid,
  Plus,
  Search,
  Folder,
  FolderPlus,
  FolderOpen,
  Trash2,
  Edit2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Hand,
  MousePointer,
  Image as ImageIcon,
  Clipboard,
  FileText,
  BookOpen,
  X,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Layers,
  Sparkles,
  ExternalLink,
  Move,
  CornerDownRight,
  MoreVertical,
  Sliders,
} from 'lucide-react';
import {
  CanvasData,
  CanvasDocument,
  CanvasMetadata,
  CanvasNode,
  CanvasNodeType,
  CanvasColor,
  CanvasEdge,
  CanvasEdgeSide,
  CanvasViewport,
} from '../types';
import { CanvasService } from '../services/canvasService';
import { NotesService } from '../services/notesService';
import { NoteMetadata } from '../types';

interface CanvasStudioViewProps {
  isStudioSidebarCollapsed?: boolean;
  onToggleStudioSidebar?: () => void;
  onNavigateToNote?: (notePath: string) => void;
}

const COLOR_MAP: Record<CanvasColor, { bg: string; border: string; glow: string; text: string }> = {
  default: {
    bg: '#141824',
    border: 'rgba(255, 255, 255, 0.12)',
    glow: 'rgba(99, 102, 241, 0.15)',
    text: '#f8fafc',
  },
  red: {
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.5)',
    glow: 'rgba(239, 68, 68, 0.25)',
    text: '#fca5a5',
  },
  orange: {
    bg: 'rgba(249, 115, 22, 0.12)',
    border: 'rgba(249, 115, 22, 0.5)',
    glow: 'rgba(249, 115, 22, 0.25)',
    text: '#fdba74',
  },
  yellow: {
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.5)',
    glow: 'rgba(234, 179, 8, 0.25)',
    text: '#fde047',
  },
  green: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.5)',
    glow: 'rgba(16, 185, 129, 0.25)',
    text: '#6ee7b7',
  },
  blue: {
    bg: 'rgba(59, 130, 246, 0.12)',
    border: 'rgba(59, 130, 246, 0.5)',
    glow: 'rgba(59, 130, 246, 0.25)',
    text: '#93c5fd',
  },
  purple: {
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.5)',
    glow: 'rgba(168, 85, 247, 0.25)',
    text: '#d8b4fe',
  },
};

export const CanvasStudioView: React.FC<CanvasStudioViewProps> = ({
  isStudioSidebarCollapsed = false,
  onToggleStudioSidebar,
  onNavigateToNote,
}) => {
  // Canvases state
  const [canvases, setCanvases] = useState<CanvasMetadata[]>([]);
  const [activeCanvasPath, setActiveCanvasPath] = useState<string | null>(null);
  const activeCanvasPathRef = useRef<string | null>(null);
  activeCanvasPathRef.current = activeCanvasPath;

  const [canvasData, setCanvasData] = useState<CanvasData>({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  });

  const [discoveredFolders, setDiscoveredFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Sidebar collapse
  const [isCanvasSidebarCollapsed, setIsCanvasSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('albaqros_canvas_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCanvasSidebar = () => {
    setIsCanvasSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('albaqros_canvas_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Viewport navigation
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [activeTool, setActiveTool] = useState<'select' | 'hand'>('select');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Editing node state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Dragging & Resizing nodes
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    initialNodes: { id: string; x: number; y: number }[];
  } | null>(null);

  const [resizeState, setResizeState] = useState<{
    nodeId: string;
    handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    aspectRatio?: number;
  } | null>(null);

  // Canvas Panning state
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const isSpacePressedRef = useRef<boolean>(false);

  // Arrow connection drag
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    side: CanvasEdgeSide;
  } | null>(null);
  const [connectingMouse, setConnectingMouse] = useState<{ x: number; y: number } | null>(null);

  // Modals
  const [isNewCanvasModalOpen, setIsNewCanvasModalOpen] = useState<boolean>(false);
  const [newCanvasTitle, setNewCanvasTitle] = useState<string>('');
  const [newCanvasFolder, setNewCanvasFolder] = useState<string>('');
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');

  // Move / Rename Modal
  const [renameTarget, setRenameTarget] = useState<CanvasMetadata | null>(null);
  const [renameTitle, setRenameTitle] = useState<string>('');
  const [renameFolder, setRenameFolder] = useState<string>('');
  const [renameCustomFolder, setRenameCustomFolder] = useState<string>('');

  // Drag and drop canvas item to folder in sidebar
  const [draggedCanvasPath, setDraggedCanvasPath] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Embed Note Modal
  const [isEmbedNoteModalOpen, setIsEmbedNoteModalOpen] = useState<boolean>(false);
  const [allNotesList, setAllNotesList] = useState<NoteMetadata[]>([]);
  const [embedNoteQuery, setEmbedNoteQuery] = useState<string>('');

  // Image full preview modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const canvasStageRef = useRef<HTMLDivElement>(null);
  const lastMousePosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const lastPasteTimeRef = useRef<number>(0);
  const handlePasteRef = useRef<(() => void) | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warn' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'warn' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2800);
  }, []);

  // Load canvases list
  const loadCanvases = useCallback(async (selectPath?: string) => {
    const res = await CanvasService.listCanvases();
    if (res.success) {
      setCanvases(res.canvases);
      if (res.folders) setDiscoveredFolders(res.folders);

      const currentPath = activeCanvasPathRef.current;
      const targetPath =
        selectPath ||
        (currentPath && res.canvases.some((c) => c.relativePath === currentPath)
          ? currentPath
          : res.canvases[0]?.relativePath);

      if (targetPath) {
        selectCanvas(targetPath);
      } else {
        setActiveCanvasPath(null);
        setCanvasData({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
      }
    }
  }, []);

  useEffect(() => {
    loadCanvases();
  }, [loadCanvases]);

  // Select and load a canvas
  const selectCanvas = async (relativePath: string) => {
    setActiveCanvasPath(relativePath);
    activeCanvasPathRef.current = relativePath;
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEditingNodeId(null);

    const doc = await CanvasService.readCanvas(relativePath);
    if (doc) {
      const data = doc.data || { nodes: [], edges: [] };
      setCanvasData(data);
      if (data.viewport) {
        setPan({ x: data.viewport.x || 0, y: data.viewport.y || 0 });
        setZoom(data.viewport.zoom || 1);
      } else {
        // Center around content or origin
        setPan({ x: 300, y: 200 });
        setZoom(1);
      }
      setLastSavedTime(new Date(doc.updatedAt));
    }
  };

  // Debounced auto-save
  const triggerSave = useCallback(
    (updatedData: CanvasData) => {
      setCanvasData(updatedData);
      setIsSaving(true);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(async () => {
        const path = activeCanvasPathRef.current;
        if (!path) {
          setIsSaving(false);
          return;
        }

        const dataToSave: CanvasData = {
          ...updatedData,
          viewport: { x: pan.x, y: pan.y, zoom },
        };

        await CanvasService.writeCanvas(path, dataToSave);
        setIsSaving(false);
        setLastSavedTime(new Date());

        // Update nodeCount in list
        setCanvases((prev) =>
          prev.map((c) =>
            c.relativePath === path ? { ...c, nodeCount: updatedData.nodes.length, updatedAt: new Date().toISOString() } : c
          )
        );
      }, 500);
    },
    [pan, zoom]
  );

  // Key listeners (Space for pan, Delete/Backspace for delete, Esc to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressedRef.current && !(e.target as HTMLElement).matches('input, textarea, [contenteditable="true"]')) {
        isSpacePressedRef.current = true;
        if (canvasStageRef.current) canvasStageRef.current.style.cursor = 'grab';
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target as HTMLElement).matches('input, textarea, [contenteditable="true"]')) {
        if (selectedNodeIds.length > 0) {
          e.preventDefault();
          handleDeleteSelectedNodes();
        } else if (selectedEdgeId) {
          e.preventDefault();
          handleDeleteEdge(selectedEdgeId);
        }
      }

      if (e.key === 'Escape') {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setEditingNodeId(null);
        setConnectingFrom(null);
        setConnectingMouse(null);
      }

      // Ctrl+0 -> Reset zoom
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 300, y: 200 });
      }

      // Ctrl+S -> Force save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (activeCanvasPathRef.current) {
          CanvasService.writeCanvas(activeCanvasPathRef.current, {
            ...canvasData,
            viewport: { x: pan.x, y: pan.y, zoom },
          });
          setLastSavedTime(new Date());
        }
      }

      // Ctrl+V -> Paste image from clipboard when not typing in text input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        const target = e.target as HTMLElement | null;
        if (
          !target ||
          (!target.matches('input, textarea, [contenteditable="true"]') &&
            !target.closest('.canvas-card-editing'))
        ) {
          if (Date.now() - lastPasteTimeRef.current > 400) {
            lastPasteTimeRef.current = Date.now();
            handlePasteRef.current?.();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        if (canvasStageRef.current) {
          canvasStageRef.current.style.cursor = activeTool === 'hand' ? 'grab' : 'default';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeIds, selectedEdgeId, canvasData, pan, zoom, activeTool]);

  // Convert screen coordinates to canvas world coordinates
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasStageRef.current) return { x: 0, y: 0 };
      const rect = canvasStageRef.current.getBoundingClientRect();
      const x = (clientX - rect.left - pan.x) / zoom;
      const y = (clientY - rect.top - pan.y) / zoom;
      return { x, y };
    },
    [pan, zoom]
  );

  // Wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canvasStageRef.current) return;
    const rect = canvasStageRef.current.getBoundingClientRect();

    // Point in world coordinates under mouse
    const mouseX = clientXToStageX(e.clientX, rect.left);
    const mouseY = clientYToStageY(e.clientY, rect.top);

    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (mouseY - pan.y) / zoom;

    const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(3.0, Math.max(0.15, zoom * zoomDelta));

    // Keep point under cursor stationary
    const newPanX = mouseX - worldX * newZoom;
    const newPanY = mouseY - worldY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const clientXToStageX = (cx: number, stageLeft: number) => cx - stageLeft;
  const clientYToStageY = (cy: number, stageTop: number) => cy - stageTop;

  // Background mouse down (Pan or Box Select or Deselect)
  const handleStageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Middle click (button 1) or Space + Left click or Hand Tool -> Pan
    if (e.button === 1 || isSpacePressedRef.current || activeTool === 'hand' || (e.button === 0 && e.target === canvasStageRef.current)) {
      setIsPanning(true);
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      if (canvasStageRef.current) canvasStageRef.current.style.cursor = 'grabbing';
      if (e.target === canvasStageRef.current) {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setEditingNodeId(null);
      }
    }
  };

  // Global mouse move for Pan, Node Drag, Node Resize, Arrow Drawing
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };

    // 1. Panning canvas
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
      return;
    }

    // 2. Dragging nodes
    if (dragState && dragState.isDragging) {
      const dx = (e.clientX - dragState.startX) / zoom;
      const dy = (e.clientY - dragState.startY) / zoom;

      const updatedNodes = canvasData.nodes.map((node) => {
        const initial = dragState.initialNodes.find((init) => init.id === node.id);
        if (initial) {
          return {
            ...node,
            x: Math.round(initial.x + dx),
            y: Math.round(initial.y + dy),
          };
        }
        return node;
      });

      setCanvasData((prev) => ({ ...prev, nodes: updatedNodes }));
      return;
    }

    // 3. Resizing node
    if (resizeState) {
      const dx = (e.clientX - resizeState.startX) / zoom;
      const dy = (e.clientY - resizeState.startY) / zoom;

      const { handle, origX, origY, origW, origH, aspectRatio } = resizeState;
      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;

      if (handle.includes('e')) newW = Math.max(120, origW + dx);
      if (handle.includes('s')) newH = Math.max(80, origH + dy);
      if (handle.includes('w')) {
        const potentialW = origW - dx;
        if (potentialW >= 120) {
          newW = potentialW;
          newX = origX + dx;
        }
      }
      if (handle.includes('n')) {
        const potentialH = origH - dy;
        if (potentialH >= 80) {
          newH = potentialH;
          newY = origY + dy;
        }
      }

      // If aspect ratio locked (for image corner resize)
      if (aspectRatio && (handle === 'se' || handle === 'nw' || handle === 'ne' || handle === 'sw')) {
        newH = Math.round(newW / aspectRatio);
      }

      const updatedNodes = canvasData.nodes.map((node) =>
        node.id === resizeState.nodeId
          ? { ...node, x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) }
          : node
      );

      setCanvasData((prev) => ({ ...prev, nodes: updatedNodes }));
      return;
    }

    // 4. Connecting arrow line
    if (connectingFrom) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setConnectingMouse(worldPos);
    }
  };

  // Mouse up
  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      if (canvasStageRef.current) {
        canvasStageRef.current.style.cursor = activeTool === 'hand' ? 'grab' : 'default';
      }
    }

    if (dragState) {
      setDragState(null);
      triggerSave(canvasData);
    }

    if (resizeState) {
      setResizeState(null);
      triggerSave(canvasData);
    }

    if (connectingFrom) {
      setConnectingFrom(null);
      setConnectingMouse(null);
    }
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNode) => {
    if (isSpacePressedRef.current || activeTool === 'hand' || e.button !== 0) return;
    e.stopPropagation();

    const isAlreadySelected = selectedNodeIds.includes(node.id);
    const newSelected = e.shiftKey
      ? isAlreadySelected
        ? selectedNodeIds.filter((id) => id !== node.id)
        : [...selectedNodeIds, node.id]
      : isAlreadySelected
      ? selectedNodeIds
      : [node.id];

    setSelectedNodeIds(newSelected);
    setSelectedEdgeId(null);

    // Prepare drag state
    const nodesToMove = canvasData.nodes.filter((n) => newSelected.includes(n.id));
    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialNodes: nodesToMove.map((n) => ({ id: n.id, x: n.x, y: n.y })),
    });
  };

  // Node Resize Start
  const handleResizeStart = (
    e: React.MouseEvent,
    node: CanvasNode,
    handle: 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    setResizeState({
      nodeId: node.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: node.x,
      origY: node.y,
      origW: node.width,
      origH: node.height,
      aspectRatio: node.aspectRatio,
    });
  };

  // Start connector arrow from an anchor point
  const handleAnchorMouseDown = (e: React.MouseEvent, nodeId: string, side: CanvasEdgeSide) => {
    e.stopPropagation();
    e.preventDefault();
    setConnectingFrom({ nodeId, side });
    const worldPos = screenToWorld(e.clientX, e.clientY);
    setConnectingMouse(worldPos);
  };

  // Complete connector arrow onto target anchor point
  const handleAnchorMouseUp = (e: React.MouseEvent, targetNodeId: string, targetSide: CanvasEdgeSide) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom.nodeId !== targetNodeId) {
      const newEdge: CanvasEdge = {
        id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        fromNode: connectingFrom.nodeId,
        fromSide: connectingFrom.side,
        toNode: targetNodeId,
        toSide: targetSide,
      };

      const updatedEdges = [...canvasData.edges, newEdge];
      const updated = { ...canvasData, edges: updatedEdges };
      setCanvasData(updated);
      triggerSave(updated);
    }
    setConnectingFrom(null);
    setConnectingMouse(null);
  };

  // Add Card Actions
  const handleAddTextCard = () => {
    // Place near center of viewport
    const centerWorld = screenToWorld(
      canvasStageRef.current ? canvasStageRef.current.clientWidth / 2 : 400,
      canvasStageRef.current ? canvasStageRef.current.clientHeight / 2 : 300
    );

    const newNode: CanvasNode = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: Math.round(centerWorld.x - 150),
      y: Math.round(centerWorld.y - 100),
      width: 300,
      height: 200,
      color: 'default',
      text: 'Double click to edit note...',
    };

    const updated = { ...canvasData, nodes: [...canvasData.nodes, newNode] };
    setCanvasData(updated);
    setSelectedNodeIds([newNode.id]);
    triggerSave(updated);
  };

  // Core helper to insert an image node onto the canvas
  const insertImageNode = useCallback(
    (
      dataUrl: string,
      altName: string = 'Pasted Image',
      aspectRatio?: number,
      targetWorldPos?: { x: number; y: number },
      naturalWidth?: number,
      naturalHeight?: number
    ) => {
      let worldPos = targetWorldPos;
      if (!worldPos) {
        const stageEl = canvasStageRef.current;
        if (lastMousePosRef.current && stageEl) {
          const rect = stageEl.getBoundingClientRect();
          const isInside =
            lastMousePosRef.current.clientX >= rect.left &&
            lastMousePosRef.current.clientX <= rect.right &&
            lastMousePosRef.current.clientY >= rect.top &&
            lastMousePosRef.current.clientY <= rect.bottom;

          if (isInside) {
            worldPos = screenToWorld(lastMousePosRef.current.clientX, lastMousePosRef.current.clientY);
          } else {
            worldPos = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
          }
        } else if (stageEl) {
          const rect = stageEl.getBoundingClientRect();
          worldPos = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
        } else {
          worldPos = { x: 0, y: 0 };
        }
      }

      const ratio =
        aspectRatio && aspectRatio > 0
          ? aspectRatio
          : naturalWidth && naturalHeight
          ? naturalWidth / naturalHeight
          : 1.33;
      const initialW = Math.min(540, Math.max(260, naturalWidth || 340));
      const initialH = Math.round(initialW / ratio);

      const newNode: CanvasNode = {
        id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: 'image',
        x: Math.round(worldPos.x - initialW / 2),
        y: Math.round(worldPos.y - initialH / 2),
        width: initialW,
        height: initialH,
        src: dataUrl,
        alt: altName,
        aspectRatio: ratio,
        color: 'default',
      };

      setCanvasData((prev) => {
        const updated = { ...prev, nodes: [...prev.nodes, newNode] };
        triggerSave(updated);
        return updated;
      });
      setSelectedNodeIds([newNode.id]);
      setSelectedEdgeId(null);
      showToast('Image pasted onto canvas', 'success');
    },
    [screenToWorld, triggerSave, showToast]
  );

  // Helper to read and process any image File or Blob
  const handleProcessImageBlob = useCallback(
    (blob: Blob, targetWorldPos?: { x: number; y: number }, fileName?: string) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const ratio = img.naturalWidth / (img.naturalHeight || 1);
          insertImageNode(dataUrl, fileName || 'Pasted Image', ratio, targetWorldPos, img.naturalWidth, img.naturalHeight);
        };
        img.onerror = () => {
          insertImageNode(dataUrl, fileName || 'Pasted Image', 1.33, targetWorldPos);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(blob);
    },
    [insertImageNode]
  );

  // Paste image from clipboard
  const handlePasteImageFromClipboard = useCallback(async () => {
    if (!activeCanvasPathRef.current) return;
    const imgData = await CanvasService.readClipboardImage();
    if (imgData && imgData.dataUrl) {
      insertImageNode(
        imgData.dataUrl,
        imgData.fileName || 'Pasted Image',
        imgData.aspectRatio,
        undefined,
        imgData.width,
        imgData.height
      );
    } else {
      showToast('No image in clipboard. Copy an image or screenshot first (Win+Shift+S)', 'warn');
    }
  }, [insertImageNode, showToast]);

  handlePasteRef.current = handlePasteImageFromClipboard;

  // Window clipboard paste listener (handles Ctrl+V, image drag/paste from web, snipping tool, etc.)
  useEffect(() => {
    const handlePasteEvent = async (e: ClipboardEvent) => {
      if (!activeCanvasPathRef.current) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.matches('input, textarea, [contenteditable="true"]') ||
          target.closest('.canvas-card-editing'))
      ) {
        return;
      }

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // 1. Check clipboard items for image file/blob
      if (clipboardData.items && clipboardData.items.length > 0) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              e.preventDefault();
              e.stopPropagation();
              lastPasteTimeRef.current = Date.now();
              handleProcessImageBlob(blob);
              return;
            }
          }
        }
      }

      // 2. Check clipboard files
      if (clipboardData.files && clipboardData.files.length > 0) {
        for (let i = 0; i < clipboardData.files.length; i++) {
          const file = clipboardData.files[i];
          if (file.type.startsWith('image/')) {
            e.preventDefault();
            e.stopPropagation();
            lastPasteTimeRef.current = Date.now();
            handleProcessImageBlob(file, undefined, file.name);
            return;
          }
        }
      }

      // 3. Fallback to Electron native clipboard if items were not exposed in DOM
      if (Date.now() - lastPasteTimeRef.current > 400) {
        lastPasteTimeRef.current = Date.now();
        const electronImg = await CanvasService.readClipboardImage();
        if (electronImg && electronImg.dataUrl) {
          e.preventDefault();
          e.stopPropagation();
          insertImageNode(
            electronImg.dataUrl,
            electronImg.fileName || 'Pasted Image',
            electronImg.aspectRatio,
            undefined,
            electronImg.width,
            electronImg.height
          );
        }
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => {
      window.removeEventListener('paste', handlePasteEvent);
    };
  }, [handleProcessImageBlob, insertImageNode]);

  const handleAddImageCard = async () => {
    const picked = await CanvasService.pickImageFile();
    if (!picked) return;
    insertImageNode(picked.dataUrl, picked.fileName, picked.aspectRatio);
  };

  const handleAddGroupNode = () => {
    const centerWorld = screenToWorld(
      canvasStageRef.current ? canvasStageRef.current.clientWidth / 2 : 400,
      canvasStageRef.current ? canvasStageRef.current.clientHeight / 2 : 300
    );

    const newNode: CanvasNode = {
      id: `group-${Date.now()}`,
      type: 'group',
      x: Math.round(centerWorld.x - 250),
      y: Math.round(centerWorld.y - 180),
      width: 500,
      height: 360,
      label: 'Group Label',
      color: 'default',
      zIndex: -1,
    };

    const updated = { ...canvasData, nodes: [newNode, ...canvasData.nodes] };
    setCanvasData(updated);
    setSelectedNodeIds([newNode.id]);
    triggerSave(updated);
  };

  // Drag and drop image file directly from OS onto canvas
  const handleDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const file = e.dataTransfer.files[0];
    if (!file.type.startsWith('image/')) return;

    const dropWorld = screenToWorld(e.clientX, e.clientY);
    handleProcessImageBlob(file, dropWorld, file.name);
  };

  // Open note embed dialog
  const handleOpenEmbedNote = async () => {
    const res = await NotesService.listNotes();
    if (res.success) {
      setAllNotesList(res.notes);
    }
    setEmbedNoteQuery('');
    setIsEmbedNoteModalOpen(true);
  };

  // Embed selected note as card
  const handleEmbedNote = async (noteMeta: NoteMetadata) => {
    setIsEmbedNoteModalOpen(false);
    const fullNote = await NotesService.readNote(noteMeta.relativePath);

    const centerWorld = screenToWorld(
      canvasStageRef.current ? canvasStageRef.current.clientWidth / 2 : 400,
      canvasStageRef.current ? canvasStageRef.current.clientHeight / 2 : 300
    );

    const newNode: CanvasNode = {
      id: `note-${Date.now()}`,
      type: 'note',
      x: Math.round(centerWorld.x - 160),
      y: Math.round(centerWorld.y - 120),
      width: 320,
      height: 240,
      notePath: noteMeta.relativePath,
      noteTitle: noteMeta.title,
      notePreview: fullNote?.preview || noteMeta.preview,
      text: fullNote?.content || '',
      color: 'blue',
    };

    const updated = { ...canvasData, nodes: [...canvasData.nodes, newNode] };
    setCanvasData(updated);
    setSelectedNodeIds([newNode.id]);
    triggerSave(updated);
  };

  // Node Color change
  const handleChangeNodeColor = (nodeId: string, color: CanvasColor) => {
    const updatedNodes = canvasData.nodes.map((n) => (n.id === nodeId ? { ...n, color } : n));
    const updated = { ...canvasData, nodes: updatedNodes };
    setCanvasData(updated);
    triggerSave(updated);
  };

  // Delete selected nodes
  const handleDeleteSelectedNodes = () => {
    if (selectedNodeIds.length === 0) return;
    const remainingNodes = canvasData.nodes.filter((n) => !selectedNodeIds.includes(n.id));
    const remainingEdges = canvasData.edges.filter(
      (e) => !selectedNodeIds.includes(e.fromNode) && !selectedNodeIds.includes(e.toNode)
    );
    const updated = { nodes: remainingNodes, edges: remainingEdges };
    setCanvasData(updated);
    setSelectedNodeIds([]);
    triggerSave(updated);
  };

  // Delete edge
  const handleDeleteEdge = (edgeId: string) => {
    const remainingEdges = canvasData.edges.filter((e) => e.id !== edgeId);
    const updated = { ...canvasData, edges: remainingEdges };
    setCanvasData(updated);
    setSelectedEdgeId(null);
    triggerSave(updated);
  };

  // Fit to screen (frame all cards)
  const handleFitToView = () => {
    if (canvasData.nodes.length === 0 || !canvasStageRef.current) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    canvasData.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const stageWidth = canvasStageRef.current.clientWidth;
    const stageHeight = canvasStageRef.current.clientHeight;

    const padding = 80;
    const scaleX = (stageWidth - padding * 2) / contentWidth;
    const scaleY = (stageHeight - padding * 2) / contentHeight;
    const fitZoom = Math.min(1.5, Math.max(0.2, Math.min(scaleX, scaleY)));

    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    const newPanX = stageWidth / 2 - centerX * fitZoom;
    const newPanY = stageHeight / 2 - centerY * fitZoom;

    setZoom(fitZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Calculate anchor point coordinate in world space
  const getNodeAnchorPoint = useCallback(
    (nodeId: string, side: CanvasEdgeSide) => {
      const node = canvasData.nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };

      switch (side) {
        case 'top':
          return { x: node.x + node.width / 2, y: node.y };
        case 'bottom':
          return { x: node.x + node.width / 2, y: node.y + node.height };
        case 'left':
          return { x: node.x, y: node.y + node.height / 2 };
        case 'right':
          return { x: node.x + node.width, y: node.y + node.height / 2 };
      }
    },
    [canvasData.nodes]
  );

  // SVG Edge Path generator
  const getEdgePath = (fromX: number, fromY: number, fromSide: CanvasEdgeSide, toX: number, toY: number, toSide: CanvasEdgeSide) => {
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    const curve = Math.max(40, Math.min(180, (dx + dy) * 0.4));

    let cp1x = fromX;
    let cp1y = fromY;
    let cp2x = toX;
    let cp2y = toY;

    if (fromSide === 'right') cp1x += curve;
    else if (fromSide === 'left') cp1x -= curve;
    else if (fromSide === 'bottom') cp1y += curve;
    else if (fromSide === 'top') cp1y -= curve;

    if (toSide === 'right') cp2x += curve;
    else if (toSide === 'left') cp2x -= curve;
    else if (toSide === 'bottom') cp2y += curve;
    else if (toSide === 'top') cp2y -= curve;

    return `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;
  };

  // Folder filtering & search
  const filteredCanvases = useMemo(() => {
    return canvases.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.relativePath.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFolder =
        selectedFolder === null ||
        (selectedFolder === '' ? !c.folder : c.folder === selectedFolder || c.folder.startsWith(`${selectedFolder}/`));

      return matchesSearch && matchesFolder;
    });
  }, [canvases, searchQuery, selectedFolder]);

  // Handle new canvas creation
  const handleCreateCanvas = async () => {
    if (!newCanvasTitle.trim()) return;
    const res = await CanvasService.createCanvas(newCanvasTitle, newCanvasFolder || undefined);
    if (res) {
      setIsNewCanvasModalOpen(false);
      setNewCanvasTitle('');
      setNewCanvasFolder('');
      await loadCanvases(res.relativePath);
    }
  };

  // Handle new folder creation
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const success = await CanvasService.createFolder(newFolderName.trim());
    if (success) {
      setIsNewFolderModalOpen(false);
      setNewFolderName('');
      await loadCanvases();
    }
  };

  // Handle rename / move canvas
  const handleRenameCanvas = async () => {
    if (!renameTarget) return;
    const targetFolder = renameFolder === '__custom__' ? renameCustomFolder : renameFolder;
    const res = await CanvasService.renameCanvas(renameTarget.relativePath, renameTitle, targetFolder);
    if (res) {
      setRenameTarget(null);
      await loadCanvases(res.relativePath);
    }
  };

  // Handle move canvas directly to folder via drag & drop
  const handleDropOnFolder = async (targetFolder: string) => {
    if (!draggedCanvasPath) return;
    const canvasItem = canvases.find((c) => c.relativePath === draggedCanvasPath);
    if (!canvasItem) return;

    const res = await CanvasService.renameCanvas(draggedCanvasPath, canvasItem.title, targetFolder);
    if (res) {
      setDraggedCanvasPath(null);
      setDragOverFolder(null);
      await loadCanvases(res.relativePath);
    }
  };

  // Delete canvas
  const handleDeleteCanvas = async (relativePath: string) => {
    const confirm = window.confirm(`Are you sure you want to delete this canvas?`);
    if (!confirm) return;

    const success = await CanvasService.deleteCanvas(relativePath);
    if (success) {
      if (activeCanvasPath === relativePath) {
        setActiveCanvasPath(null);
      }
      await loadCanvases();
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#0b0d13' }}>
      {/* 1. Left Sidebar (Collapsible Canvas Hub) */}
      <aside
        style={{
          width: isCanvasSidebarCollapsed ? '0px' : '260px',
          backgroundColor: '#0e111a',
          borderRight: isCanvasSidebarCollapsed ? 'none' : '1px solid var(--border-subtle)',
          display: isCanvasSidebarCollapsed ? 'none' : 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.2s ease',
          zIndex: 30,
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutGrid size={18} color="#818cf8" />
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
              CANVAS WORKSPACE
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={() => {
                setNewCanvasTitle('');
                setNewCanvasFolder(selectedFolder || '');
                setIsNewCanvasModalOpen(true);
              }}
              title="New Canvas Note"
              style={{ width: '28px', height: '28px', color: '#818cf8' }}
            >
              <Plus size={16} />
            </button>

            <button
              type="button"
              className="btn-icon"
              onClick={() => {
                setNewFolderName('');
                setIsNewFolderModalOpen(true);
              }}
              title="New Folder"
              style={{ width: '28px', height: '28px', color: 'var(--text-secondary)' }}
            >
              <FolderPlus size={15} />
            </button>

            <button
              type="button"
              className="btn-icon"
              onClick={toggleCanvasSidebar}
              title="Collapse Sidebar"
              style={{ width: '28px', height: '28px', color: 'var(--text-muted)' }}
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#161a26',
              borderRadius: '6px',
              padding: '6px 10px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search canvases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '0.8rem',
                width: '100%',
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

        {/* Folder Filter Pill List */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div
            onClick={() => setSelectedFolder(null)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverFolder('');
            }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDropOnFolder('');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 8px',
              borderRadius: '5px',
              fontSize: '0.76rem',
              fontWeight: selectedFolder === null ? 600 : 500,
              color: selectedFolder === null ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor:
                dragOverFolder === ''
                  ? 'rgba(99, 102, 241, 0.3)'
                  : selectedFolder === null
                  ? 'rgba(99, 102, 241, 0.15)'
                  : 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={13} color={selectedFolder === null ? '#818cf8' : 'currentColor'} />
              <span>All Canvases</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{canvases.length}</span>
          </div>

          {discoveredFolders.map((f) => {
            const count = canvases.filter((c) => c.folder === f || c.folder.startsWith(`${f}/`)).length;
            const isSelected = selectedFolder === f;
            const isHovered = dragOverFolder === f;

            return (
              <div
                key={f}
                onClick={() => setSelectedFolder(isSelected ? null : f)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverFolder(f);
                }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnFolder(f);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: '5px',
                  fontSize: '0.76rem',
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  backgroundColor: isHovered
                    ? 'rgba(99, 102, 241, 0.35)'
                    : isSelected
                    ? 'rgba(99, 102, 241, 0.15)'
                    : 'transparent',
                  cursor: 'pointer',
                  border: isHovered ? '1px dashed #818cf8' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <Folder size={13} color={isSelected ? '#818cf8' : '#e2e8f0'} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f}</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* Canvases List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filteredCanvases.map((c) => {
            const isActive = c.relativePath === activeCanvasPath;
            return (
              <div
                key={c.relativePath}
                draggable
                onDragStart={() => setDraggedCanvasPath(c.relativePath)}
                onDragEnd={() => setDraggedCanvasPath(null)}
                onClick={() => selectCanvas(c.relativePath)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.18)' : '#121622',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <LayoutGrid size={14} color={isActive ? '#818cf8' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? '#ffffff' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {c.title}
                    </span>
                  </div>

                  {/* Actions meatball */}
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(c);
                        setRenameTitle(c.title);
                        setRenameFolder(c.folder || '');
                        setRenameCustomFolder('');
                      }}
                      title="Rename or Move to Folder"
                      style={{ padding: '2px', width: '22px', height: '22px', color: 'var(--text-muted)' }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCanvas(c.relativePath);
                      }}
                      title="Delete Canvas"
                      style={{ padding: '2px', width: '22px', height: '22px', color: '#f87171' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '6px',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {c.folder && (
                    <span
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      📁 {c.folder}
                    </span>
                  )}
                  <span>{c.nodeCount || 0} cards</span>
                </div>
              </div>
            );
          })}

          {filteredCanvases.length === 0 && (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              No canvas notes found. Click <strong>+</strong> above to create one!
            </div>
          )}
        </div>
      </aside>

      {/* 2. Main Canvas Viewport Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#0a0c12',
        }}
      >
        {/* Floating Sidebar Open Button (When Canvas Sidebar is collapsed) */}
        {isCanvasSidebarCollapsed && (
          <button
            type="button"
            onClick={toggleCanvasSidebar}
            title="Open Canvas Sidebar"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 90,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: '#161b26',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-secondary)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            <PanelLeftOpen size={14} color="#818cf8" />
            <span>Canvases</span>
          </button>
        )}

        {/* Top Floating Canvas Toolbar */}
        <header
          style={{
            height: '46px',
            backgroundColor: 'rgba(14, 17, 26, 0.85)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 40,
            userSelect: 'none',
          }}
        >
          {/* Left: Canvas Title & Folder */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeCanvasPath ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LayoutGrid size={15} color="#818cf8" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                    {canvases.find((c) => c.relativePath === activeCanvasPath)?.title || 'Canvas'}
                  </span>
                </div>

                {canvases.find((c) => c.relativePath === activeCanvasPath)?.folder && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: '#a5b4fc',
                      fontWeight: 600,
                    }}
                  >
                    📁 {canvases.find((c) => c.relativePath === activeCanvasPath)?.folder}
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No Canvas Selected</span>
            )}
          </div>

          {/* Center: Tools & Node Adders */}
          {activeCanvasPath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleAddTextCard}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', fontSize: '0.78rem' }}
                title="Add Text Card (Markdown)"
              >
                <FileText size={14} color="#818cf8" />
                <span>+ Text Card</span>
              </button>

              <button
                type="button"
                onClick={handleAddImageCard}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', fontSize: '0.78rem' }}
                title="Add Image Card from File"
              >
                <ImageIcon size={14} color="#34d399" />
                <span>+ Image</span>
              </button>

              <button
                type="button"
                onClick={handlePasteImageFromClipboard}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', fontSize: '0.78rem' }}
                title="Paste Image from Clipboard (Ctrl+V)"
              >
                <Clipboard size={14} color="#38bdf8" />
                <span>+ Paste Image</span>
              </button>

              <button
                type="button"
                onClick={handleOpenEmbedNote}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', fontSize: '0.78rem' }}
                title="Embed Existing Note from Notes Hub"
              >
                <BookOpen size={14} color="#38bdf8" />
                <span>+ Embed Note</span>
              </button>

              <button
                type="button"
                onClick={handleAddGroupNode}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', fontSize: '0.78rem' }}
                title="Add Group Frame"
              >
                <Layers size={14} color="#fbbf24" />
                <span>+ Group</span>
              </button>

              <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />

              {/* Tool Mode: Select vs Hand */}
              <div style={{ display: 'flex', backgroundColor: '#181d2a', borderRadius: '5px', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTool('select')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '24px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: activeTool === 'select' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                    color: activeTool === 'select' ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                  title="Select Tool (V)"
                >
                  <MousePointer size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool('hand')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '26px',
                    height: '24px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: activeTool === 'hand' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                    color: activeTool === 'hand' ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                  title="Hand / Pan Tool (H)"
                >
                  <Hand size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Right: Save Status & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {activeCanvasPath && (
              <span style={{ fontSize: '0.72rem', color: isSaving ? '#fbbf24' : '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isSaving ? '#fbbf24' : '#10b981',
                  }}
                />
                {isSaving ? 'Saving...' : 'All changes saved'}
              </span>
            )}
          </div>
        </header>

        {/* 3. The Infinite Stage (Pannable / Zoomable Workspace) */}
        <div
          ref={canvasStageRef}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFiles}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            cursor: activeTool === 'hand' ? 'grab' : isSpacePressedRef.current ? 'grab' : 'default',
            backgroundImage: `radial-gradient(circle, rgba(255, 255, 255, 0.12) 1px, transparent 1px)`,
            backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
            backgroundPosition: `${pan.x % (30 * zoom)}px ${pan.y % (30 * zoom)}px`,
          }}
        >
          {/* Transformed Stage Viewport */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: '0 0',
              pointerEvents: 'none', // Cards enable pointer events individually
            }}
          >
            {/* SVG Connector Edges Layer */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100000px',
                height: '100000px',
                transform: 'translate(-50000px, -50000px)',
                overflow: 'visible',
                pointerEvents: 'none',
              }}
            >
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#818cf8" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
                </marker>
              </defs>

              {/* Render Existing Edges */}
              {canvasData.edges.map((edge) => {
                const fromPoint = getNodeAnchorPoint(edge.fromNode, edge.fromSide);
                const toPoint = getNodeAnchorPoint(edge.toNode, edge.toSide);
                const isSelected = selectedEdgeId === edge.id;
                const pathStr = getEdgePath(
                  fromPoint.x + 50000,
                  fromPoint.y + 50000,
                  edge.fromSide,
                  toPoint.x + 50000,
                  toPoint.y + 50000,
                  edge.toSide
                );

                return (
                  <g key={edge.id} style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={() => setSelectedEdgeId(edge.id)}>
                    {/* Fat stroke for easy clicking */}
                    <path d={pathStr} fill="none" stroke="transparent" strokeWidth="16" />
                    {/* Rendered curved edge line */}
                    <path
                      d={pathStr}
                      fill="none"
                      stroke={isSelected ? '#38bdf8' : '#818cf8'}
                      strokeWidth={isSelected ? 3 : 2}
                      markerEnd={isSelected ? 'url(#arrow-selected)' : 'url(#arrow-default)'}
                      strokeDasharray={isSelected ? '6,3' : 'none'}
                    />
                    {edge.label && (
                      <text
                        x={(fromPoint.x + toPoint.x) / 2 + 50000}
                        y={(fromPoint.y + toPoint.y) / 2 + 50000 - 8}
                        fill="#c7d2fe"
                        fontSize="11"
                        textAnchor="middle"
                        fontWeight="600"
                        style={{ pointerEvents: 'none' }}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Dynamic Connecting Arrow Line when user is dragging to connect */}
              {connectingFrom && connectingMouse && (
                <path
                  d={getEdgePath(
                    getNodeAnchorPoint(connectingFrom.nodeId, connectingFrom.side).x + 50000,
                    getNodeAnchorPoint(connectingFrom.nodeId, connectingFrom.side).y + 50000,
                    connectingFrom.side,
                    connectingMouse.x + 50000,
                    connectingMouse.y + 50000,
                    'left'
                  )}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  strokeDasharray="4,4"
                  markerEnd="url(#arrow-selected)"
                />
              )}
            </svg>

            {/* Nodes Layer */}
            {canvasData.nodes.map((node) => {
              const isSelected = selectedNodeIds.includes(node.id);
              const colorInfo = COLOR_MAP[(node.color as CanvasColor) || 'default'] || COLOR_MAP.default;
              const isEditing = editingNodeId === node.id;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                    height: `${node.height}px`,
                    backgroundColor: colorInfo.bg,
                    border: `1.5px solid ${isSelected ? '#818cf8' : colorInfo.border}`,
                    borderRadius: node.type === 'group' ? '12px' : '10px',
                    boxShadow: isSelected
                      ? `0 0 0 2px rgba(129, 140, 248, 0.4), 0 10px 30px rgba(0, 0, 0, 0.5)`
                      : `0 4px 20px rgba(0, 0, 0, 0.35)`,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'visible',
                    pointerEvents: 'all',
                    zIndex: isSelected ? 100 : node.zIndex || (node.type === 'group' ? 1 : 10),
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Card Header Drag Bar */}
                  <div
                    style={{
                      padding: '6px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      borderBottom: `1px solid ${colorInfo.border}`,
                      borderTopLeftRadius: '9px',
                      borderTopRightRadius: '9px',
                      cursor: 'move',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: colorInfo.text }}>
                      {node.type === 'text' && <FileText size={13} />}
                      {node.type === 'image' && <ImageIcon size={13} />}
                      {node.type === 'note' && <BookOpen size={13} />}
                      {node.type === 'group' && <Layers size={13} />}
                      <span>
                        {node.type === 'note'
                          ? node.noteTitle || 'Note'
                          : node.type === 'group'
                          ? node.label || 'Group'
                          : node.type === 'image'
                          ? node.alt || 'Image'
                          : 'Card'}
                      </span>
                    </div>

                    {/* Node Actions Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} onMouseDown={(e) => e.stopPropagation()}>
                      {/* Color Palette Picker */}
                      {(['default', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'] as CanvasColor[]).map((c) => (
                        <div
                          key={c}
                          onClick={() => handleChangeNodeColor(node.id, c)}
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: COLOR_MAP[c].text,
                            cursor: 'pointer',
                            opacity: (node.color || 'default') === c ? 1 : 0.4,
                            transform: (node.color || 'default') === c ? 'scale(1.2)' : 'none',
                            border: '1px solid rgba(0,0,0,0.5)',
                          }}
                          title={`Color ${c}`}
                        />
                      ))}

                      {/* Delete node */}
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => {
                          const updated = {
                            nodes: canvasData.nodes.filter((n) => n.id !== node.id),
                            edges: canvasData.edges.filter((e) => e.fromNode !== node.id && e.toNode !== node.id),
                          };
                          setCanvasData(updated);
                          triggerSave(updated);
                        }}
                        title="Delete Card"
                        style={{ width: '18px', height: '18px', padding: 0, marginLeft: '4px', color: '#f87171' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Card Content Area */}
                  <div
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {/* TEXT CARD */}
                    {node.type === 'text' && (
                      <div
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          overflowY: 'auto',
                          fontSize: '0.88rem',
                          color: '#f8fafc',
                          lineHeight: '1.6',
                        }}
                        onDoubleClick={() => {
                          setEditingNodeId(node.id);
                          setEditingText(node.text || '');
                        }}
                      >
                        {isEditing ? (
                          <textarea
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => {
                              const updatedNodes = canvasData.nodes.map((n) =>
                                n.id === node.id ? { ...n, text: editingText } : n
                              );
                              setCanvasData({ ...canvasData, nodes: updatedNodes });
                              setEditingNodeId(null);
                              triggerSave({ ...canvasData, nodes: updatedNodes });
                            }}
                            style={{
                              width: '100%',
                              height: '100%',
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#ffffff',
                              fontSize: '0.88rem',
                              fontFamily: 'inherit',
                              resize: 'none',
                            }}
                          />
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {node.text || 'Double click to type words...'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* IMAGE CARD */}
                    {node.type === 'image' && (
                      <div
                        style={{
                          flex: 1,
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#07090e',
                        }}
                        onDoubleClick={() => setPreviewImageUrl(node.src || null)}
                      >
                        {node.src ? (
                          <img
                            src={node.src}
                            alt={node.alt || 'Canvas image'}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: node.fitMode || 'contain',
                              userSelect: 'none',
                              pointerEvents: 'none',
                            }}
                          />
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No image loaded</div>
                        )}

                        {/* Quick Fit Controls floating on hover */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '6px',
                            right: '6px',
                            display: 'flex',
                            gap: '4px',
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(4px)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            opacity: isSelected ? 1 : 0,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          <button
                            type="button"
                            className="btn-icon"
                            title="Toggle Contain / Cover"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newMode: 'contain' | 'cover' = node.fitMode === 'cover' ? 'contain' : 'cover';
                              const updatedNodes: CanvasNode[] = canvasData.nodes.map((n) =>
                                n.id === node.id ? { ...n, fitMode: newMode } : n
                              );
                              setCanvasData({ ...canvasData, nodes: updatedNodes });
                              triggerSave({ ...canvasData, nodes: updatedNodes });
                            }}
                            style={{ width: '20px', height: '20px', padding: 0, color: '#e2e8f0' }}
                          >
                            <Sliders size={11} />
                          </button>

                          <button
                            type="button"
                            className="btn-icon"
                            title="Reset to Aspect Ratio"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!node.aspectRatio) return;
                              const newH = Math.round(node.width / node.aspectRatio);
                              const updatedNodes = canvasData.nodes.map((n) =>
                                n.id === node.id ? { ...n, height: newH } : n
                              );
                              setCanvasData({ ...canvasData, nodes: updatedNodes });
                              triggerSave({ ...canvasData, nodes: updatedNodes });
                            }}
                            style={{ width: '20px', height: '20px', padding: 0, color: '#e2e8f0' }}
                          >
                            <RotateCcw size={11} />
                          </button>

                          <button
                            type="button"
                            className="btn-icon"
                            title="Full Resolution Preview"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImageUrl(node.src || null);
                            }}
                            style={{ width: '20px', height: '20px', padding: 0, color: '#e2e8f0' }}
                          >
                            <Maximize2 size={11} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* EMBEDDED NOTE CARD */}
                    {node.type === 'note' && (
                      <div
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          overflowY: 'auto',
                          fontSize: '0.85rem',
                          color: '#cbd5e1',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#f8fafc', lineHeight: '1.5' }}>
                          {node.notePreview || node.text || 'Empty note content'}
                        </div>

                        {node.notePath && onNavigateToNote && (
                          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <button
                              type="button"
                              onClick={() => onNavigateToNote(node.notePath!)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'transparent',
                                border: 'none',
                                color: '#60a5fa',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <ExternalLink size={12} />
                              Open in Notes Tab
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* GROUP FRAME */}
                    {node.type === 'group' && (
                      <div style={{ flex: 1, padding: '12px' }}>
                        <input
                          type="text"
                          value={node.label || ''}
                          onChange={(e) => {
                            const updatedNodes = canvasData.nodes.map((n) =>
                              n.id === node.id ? { ...n, label: e.target.value } : n
                            );
                            setCanvasData({ ...canvasData, nodes: updatedNodes });
                            triggerSave({ ...canvasData, nodes: updatedNodes });
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#94a3b8',
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* 4 Connection Anchor Points (Top, Bottom, Left, Right) */}
                  {(['top', 'bottom', 'left', 'right'] as CanvasEdgeSide[]).map((side) => {
                    const styleMap: Record<CanvasEdgeSide, React.CSSProperties> = {
                      top: { top: '-6px', left: '50%', transform: 'translateX(-50%)' },
                      bottom: { bottom: '-6px', left: '50%', transform: 'translateX(-50%)' },
                      left: { left: '-6px', top: '50%', transform: 'translateY(-50%)' },
                      right: { right: '-6px', top: '50%', transform: 'translateY(-50%)' },
                    };

                    return (
                      <div
                        key={side}
                        onMouseDown={(e) => handleAnchorMouseDown(e, node.id, side)}
                        onMouseUp={(e) => handleAnchorMouseUp(e, node.id, side)}
                        style={{
                          position: 'absolute',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#818cf8',
                          border: '2px solid #0f172a',
                          cursor: 'crosshair',
                          zIndex: 200,
                          opacity: isSelected || connectingFrom ? 1 : 0,
                          transition: 'opacity 0.15s, transform 0.15s',
                          ...styleMap[side],
                        }}
                        title={`Connect arrow from ${side}`}
                      />
                    );
                  })}

                  {/* 8 Resize Handles (when node is selected) */}
                  {isSelected &&
                    (['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const).map((h) => {
                      const handlePos: Record<string, React.CSSProperties> = {
                        nw: { top: '-5px', left: '-5px', cursor: 'nwse-resize' },
                        ne: { top: '-5px', right: '-5px', cursor: 'nesw-resize' },
                        sw: { bottom: '-5px', left: '-5px', cursor: 'nesw-resize' },
                        se: { bottom: '-5px', right: '-5px', cursor: 'nwse-resize' },
                        n: { top: '-5px', left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
                        s: { bottom: '-5px', left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
                        w: { left: '-5px', top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
                        e: { right: '-5px', top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' },
                      };

                      return (
                        <div
                          key={h}
                          onMouseDown={(e) => handleResizeStart(e, node, h)}
                          style={{
                            position: 'absolute',
                            width: '9px',
                            height: '9px',
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #6366f1',
                            borderRadius: '2px',
                            zIndex: 210,
                            ...handlePos[h],
                          }}
                        />
                      );
                    })}
                </div>
              );
            })}
          </div>

          {/* Bottom-Right Floating Zoom & Navigation Controls */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#121622',
              border: '1px solid var(--border-medium)',
              borderRadius: '8px',
              padding: '4px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              zIndex: 80,
              userSelect: 'none',
            }}
          >
            <button
              type="button"
              className="btn-icon"
              onClick={() => setZoom((prev) => Math.max(0.15, prev * 0.85))}
              title="Zoom Out (-)"
              style={{ width: '28px', height: '28px', color: '#cbd5e1' }}
            >
              <ZoomOut size={14} />
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 300, y: 200 });
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '0 8px',
                cursor: 'pointer',
              }}
              title="Reset Zoom to 100% (Ctrl+0)"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              type="button"
              className="btn-icon"
              onClick={() => setZoom((prev) => Math.min(3.0, prev * 1.15))}
              title="Zoom In (+)"
              style={{ width: '28px', height: '28px', color: '#cbd5e1' }}
            >
              <ZoomIn size={14} />
            </button>

            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)', margin: '0 2px' }} />

            <button
              type="button"
              className="btn-icon"
              onClick={handleFitToView}
              title="Fit to Screen (Ctrl+1)"
              style={{ width: '28px', height: '28px', color: '#818cf8' }}
            >
              <Maximize2 size={13} />
            </button>
          </div>

          {/* Floating Toast Notification */}
          {toast && (
            <div
              style={{
                position: 'absolute',
                bottom: '68px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 60,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '24px',
                backgroundColor:
                  toast.type === 'success'
                    ? 'rgba(16, 185, 129, 0.18)'
                    : toast.type === 'warn'
                    ? 'rgba(245, 158, 11, 0.18)'
                    : 'rgba(56, 189, 248, 0.18)',
                border: `1px solid ${
                  toast.type === 'success'
                    ? 'rgba(16, 185, 129, 0.45)'
                    : toast.type === 'warn'
                    ? 'rgba(245, 158, 11, 0.45)'
                    : 'rgba(56, 189, 248, 0.45)'
                }`,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                color:
                  toast.type === 'success'
                    ? '#34d399'
                    : toast.type === 'warn'
                    ? '#fbbf24'
                    : '#38bdf8',
                fontSize: '0.82rem',
                fontWeight: 500,
                pointerEvents: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {toast.type === 'success' ? (
                <Check size={14} />
              ) : toast.type === 'warn' ? (
                <Sparkles size={14} />
              ) : (
                <Clipboard size={14} />
              )}
              <span>{toast.message}</span>
            </div>
          )}
        </div>
      </main>

      {/* 4. MODALS */}

      {/* New Canvas Modal */}
      {isNewCanvasModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Create New Canvas
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Canvas Title
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Concept Art Moodboard, Game Pipeline"
                  value={newCanvasTitle}
                  onChange={(e) => setNewCanvasTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCanvas()}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#161a26',
                    border: '1px solid var(--border-medium)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Folder (Optional)
                </label>
                <select
                  value={newCanvasFolder}
                  onChange={(e) => setNewCanvasFolder(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#161a26',
                    border: '1px solid var(--border-medium)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">(Root / Uncategorized)</option>
                  {discoveredFolders.map((f) => (
                    <option key={f} value={f}>
                      📁 {f}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsNewCanvasModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleCreateCanvas}>
                  Create Canvas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {isNewFolderModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '380px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Create Canvas Folder
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Folder Name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. GameDesign, References, Mindmaps"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#161a26',
                    border: '1px solid var(--border-medium)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsNewFolderModalOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleCreateFolder}>
                  Create Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename / Move Canvas Modal */}
      {renameTarget && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Rename / Move Canvas Note
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Canvas Title
                </label>
                <input
                  type="text"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#161a26',
                    border: '1px solid var(--border-medium)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Target Folder
                </label>
                <select
                  value={renameFolder}
                  onChange={(e) => setRenameFolder(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#161a26',
                    border: '1px solid var(--border-medium)',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">(Root / Uncategorized)</option>
                  {discoveredFolders.map((f) => (
                    <option key={f} value={f}>
                      📁 {f}
                    </option>
                  ))}
                  <option value="__custom__">+ Create New Folder...</option>
                </select>
              </div>

              {renameFolder === '__custom__' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    New Folder Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter folder path..."
                    value={renameCustomFolder}
                    onChange={(e) => setRenameCustomFolder(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#161a26',
                      border: '1px solid var(--border-medium)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setRenameTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary" onClick={handleRenameCanvas}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embed Note Modal */}
      {isEmbedNoteModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
              Embed Markdown Note on Canvas
            </h3>

            <input
              type="text"
              autoFocus
              placeholder="Filter notes by title or folder..."
              value={embedNoteQuery}
              onChange={(e) => setEmbedNoteQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: '#161a26',
                border: '1px solid var(--border-medium)',
                color: '#ffffff',
                fontSize: '0.85rem',
                marginBottom: '12px',
              }}
            />

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {allNotesList
                .filter(
                  (n) =>
                    !embedNoteQuery ||
                    n.title.toLowerCase().includes(embedNoteQuery.toLowerCase()) ||
                    n.relativePath.toLowerCase().includes(embedNoteQuery.toLowerCase())
                )
                .map((n) => (
                  <div
                    key={n.relativePath}
                    onClick={() => handleEmbedNote(n)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#161b26',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#818cf8')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>{n.title}</span>
                      {n.folder && <span style={{ fontSize: '0.7rem', color: '#a5b4fc' }}>📁 {n.folder}</span>}
                    </div>
                    {n.preview && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.preview}
                      </span>
                    )}
                  </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button type="button" className="btn-secondary" onClick={() => setIsEmbedNoteModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {previewImageUrl && (
        <div
          className="modal-backdrop"
          onClick={() => setPreviewImageUrl(null)}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.88)', cursor: 'zoom-out' }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={previewImageUrl}
              alt="Full preview"
              style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
