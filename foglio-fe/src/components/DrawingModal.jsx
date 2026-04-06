import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Pencil,
  ArrowRight,
  Square,
  Circle,
  Minus,
  Triangle,
  Eraser,
  MousePointer,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Check,
  X,
  Grid,
  Sun,
  Moon,
  Palette,
  Diamond,
  ZoomIn,
  ZoomOut,
  Hand,
  Maximize2,
  Type,
  Plus
} from 'lucide-react';
import './DrawingModal.css';

const COLOR_PALETTE = [
  '#18181b', // Default Black/Dark
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber/Yellow
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Slate gray
  '#ffffff', // White
];

const STROKE_WIDTHS = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 8 },
  { label: 'Bold', value: 14 },
];

const TEXT_SIZES = [
  { label: 'S', value: 16 },
  { label: 'M', value: 24 },
  { label: 'L', value: 36 },
  { label: 'XL', value: 52 },
];

export const DrawingModal = ({
  isOpen,
  onClose,
  onSave,
  initialElements = [],
  initialTitle = 'Drawing',
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const textInputRef = useRef(null);

  // Tools: 'pencil' | 'arrow' | 'rect' | 'rounded-rect' | 'circle' | 'diamond' | 'text' | 'line' | 'triangle' | 'eraser' | 'select' | 'hand'
  const [tool, setTool] = useState('pencil');
  const [strokeColor, setStrokeColor] = useState('#18181b'); // Default dark for white canvas
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [textSize, setTextSize] = useState(24);
  const [isDashed, setIsDashed] = useState(false);
  const [fillStyle, setFillStyle] = useState('none'); // 'none' | 'tint' | 'solid'
  const [showGrid, setShowGrid] = useState(true);
  const [isWhiteCanvas, setIsWhiteCanvas] = useState(true); // Default WHITE
  const [title, setTitle] = useState(initialTitle || 'Drawing');

  // Zoom & Pan for infinite expandable canvas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isGrabbing, setIsGrabbing] = useState(false);

  const isPanningRef = useRef(false);
  const isSpacePressedRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Drawing elements
  const [elements, setElements] = useState(() => (Array.isArray(initialElements) ? initialElements : []));
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [selectedElementIndex, setSelectedElementIndex] = useState(null);

  // Inline text input state (coordinates in world space)
  const [activeTextInput, setActiveTextInput] = useState(null); // { x, y }
  const [currentTextValue, setCurrentTextValue] = useState('');

  // Transient state for drawing in progress
  const currentDrawingRef = useRef(null);
  const isInteractingRef = useRef(false);
  const dragStartRef = useRef(null);

  // Coordinate transforms
  const screenToWorld = useCallback(
    (screenX, screenY) => ({
      x: (screenX - pan.x) / zoom,
      y: (screenY - pan.y) / zoom,
    }),
    [pan, zoom]
  );

  const worldToScreen = useCallback(
    (worldX, worldY) => ({
      x: worldX * zoom + pan.x,
      y: worldY * zoom + pan.y,
    }),
    [pan, zoom]
  );

  // Zoom helpers
  const handleZoomAtPoint = useCallback((factor, clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pivotX = clientX !== undefined ? clientX - rect.left : rect.width / 2;
    const pivotY = clientY !== undefined ? clientY - rect.top : rect.height / 2;

    setZoom((prevZoom) => {
      const nextZoom = Math.min(Math.max(Number((prevZoom * factor).toFixed(2)), 0.15), 5);
      setPan((prevPan) => ({
        x: pivotX - ((pivotX - prevPan.x) / prevZoom) * nextZoom,
        y: pivotY - ((pivotY - prevPan.y) / prevZoom) * nextZoom,
      }));
      return nextZoom;
    });
  }, []);

  const handleZoomIn = () => handleZoomAtPoint(1.2);
  const handleZoomOut = () => handleZoomAtPoint(0.83);
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitContent = () => {
    if (elements.length === 0) {
      handleResetZoom();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach((el) => {
      const bbox = getBoundingBox(el);
      if (bbox) {
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.w);
        maxY = Math.max(maxY, bbox.y + bbox.h);
      }
    });

    if (minX === Infinity) {
      handleResetZoom();
      return;
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padding = 100;
    const availableW = Math.max(100, canvas.width - padding * 2);
    const availableH = Math.max(100, canvas.height - padding * 2);

    const fitScale = Math.min(availableW / Math.max(contentW, 10), availableH / Math.max(contentH, 10));
    const newZoom = Math.min(Math.max(Number(fitScale.toFixed(2)), 0.15), 2.0);

    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    setZoom(newZoom);
    setPan({
      x: canvas.width / 2 - contentCenterX * newZoom,
      y: canvas.height / 2 - contentCenterY * newZoom,
    });
  };

  // Undo / Redo
  const pushState = useCallback((newElements) => {
    setHistory((prev) => [...prev, elements]);
    setRedoStack([]);
    setElements(newElements);
  }, [elements]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [elements, ...prev]);
    setElements(previous);
    setSelectedElementIndex(null);
  }, [history, elements]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    setHistory((prev) => [...prev, elements]);
    setElements(next);
    setSelectedElementIndex(null);
  }, [redoStack, elements]);

  const handleClear = useCallback(() => {
    if (elements.length === 0) return;
    if (window.confirm('Do you want to clear the entire canvas?')) {
      pushState([]);
      setSelectedElementIndex(null);
    }
  }, [elements.length, pushState]);

  // Focus textarea when text tool creates input
  useEffect(() => {
    if (activeTextInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [activeTextInput]);

  // Wheel listener for smooth zoom centered on mouse
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      handleZoomAtPoint(factor, e.clientX, e.clientY);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [handleZoomAtPoint]);

  // Spacebar pan mode
  useEffect(() => {
    const onKeyDown = (e) => {
      if (activeTextInput) return;
      if (
        e.code === 'Space' &&
        !e.repeat &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        isSpacePressedRef.current = true;
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activeTextInput]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTextInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (
          selectedElementIndex !== null &&
          document.activeElement.tagName !== 'INPUT' &&
          document.activeElement.tagName !== 'TEXTAREA'
        ) {
          e.preventDefault();
          const next = elements.filter((_, idx) => idx !== selectedElementIndex);
          pushState(next);
          setSelectedElementIndex(null);
        }
      } else if (e.key === 'Enter') {
        if (
          selectedElementIndex !== null &&
          elements[selectedElementIndex]?.type === 'text' &&
          !activeTextInput
        ) {
          e.preventDefault();
          startEditingText(selectedElementIndex);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedElementIndex, elements, pushState, onClose, activeTextInput]);

  // Canvas render with zoom and pan
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Full canvas background
    ctx.fillStyle = isWhiteCanvas ? '#ffffff' : '#141416';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Grid pattern rendered in world coordinates across visible area
    if (showGrid) {
      const dotSpacing = 28;
      const worldLeft = (0 - pan.x) / zoom;
      const worldTop = (0 - pan.y) / zoom;
      const worldRight = (width - pan.x) / zoom;
      const worldBottom = (height - pan.y) / zoom;

      const startX = Math.floor(worldLeft / dotSpacing) * dotSpacing;
      const endX = Math.ceil(worldRight / dotSpacing) * dotSpacing;
      const startY = Math.floor(worldTop / dotSpacing) * dotSpacing;
      const endY = Math.ceil(worldBottom / dotSpacing) * dotSpacing;

      ctx.fillStyle = isWhiteCanvas ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.14)';
      for (let x = startX; x <= endX; x += dotSpacing) {
        for (let y = startY; y <= endY; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2 / Math.min(zoom, 1), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Render all elements
    const allElements = currentDrawingRef.current
      ? [...elements, currentDrawingRef.current]
      : elements;

    allElements.forEach((el, index) => {
      // Don't render text currently being edited inline to prevent ghost duplicate
      if (activeTextInput && activeTextInput.elementIndex === index) return;
      const isSelected = selectedElementIndex === index && !currentDrawingRef.current;
      renderElement(ctx, el, isSelected);
    });

    ctx.restore();
  }, [isWhiteCanvas, showGrid, elements, selectedElementIndex, pan, zoom, activeTextInput]);

  // Resize canvas to match window / container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Start editing existing text element
  const startEditingText = (idx) => {
    const el = elements[idx];
    if (!el || el.type !== 'text') return;
    setActiveTextInput({ x: el.x, y: el.y, elementIndex: idx });
    setCurrentTextValue(el.text);
    if (el.fontSize) setTextSize(el.fontSize);
    if (el.color || el.strokeColor) setStrokeColor(el.color || el.strokeColor);
    setSelectedElementIndex(idx);
    setTool('text');
  };

  // Commit text
  const commitCurrentText = () => {
    if (activeTextInput) {
      const trimmed = currentTextValue.trim();
      const isEditingExisting =
        activeTextInput.elementIndex !== null && activeTextInput.elementIndex !== undefined;

      if (isEditingExisting) {
        const idx = activeTextInput.elementIndex;
        if (trimmed) {
          const updated = elements.map((el, i) =>
            i === idx
              ? {
                  ...el,
                  text: trimmed,
                  fontSize: textSize,
                  color: strokeColor,
                  strokeColor: strokeColor,
                }
              : el
          );
          pushState(updated);
        } else {
          // If text was erased completely, delete the element
          const filtered = elements.filter((_, i) => i !== idx);
          pushState(filtered);
          setSelectedElementIndex(null);
        }
      } else if (trimmed) {
        const newEl = {
          type: 'text',
          text: trimmed,
          x: activeTextInput.x,
          y: activeTextInput.y,
          color: strokeColor,
          strokeColor: strokeColor,
          fontSize: textSize,
        };
        pushState([...elements, newEl]);
      }
    }
    setActiveTextInput(null);
    setCurrentTextValue('');
  };

  const handleSelectTextTool = () => {
    setTool('text');
    if (selectedElementIndex !== null && elements[selectedElementIndex]?.type === 'text') {
      startEditingText(selectedElementIndex);
      return;
    }
    setSelectedElementIndex(null);
    if (!activeTextInput) {
      const canvas = canvasRef.current;
      const centerScreenX = canvas ? canvas.width / 2 - 100 : 150;
      const centerScreenY = canvas ? canvas.height / 2 - 50 : 150;
      const worldPos = screenToWorld(centerScreenX, centerScreenY);
      setActiveTextInput({ x: worldPos.x, y: worldPos.y, elementIndex: null });
      setCurrentTextValue('');
    }
  };

  const handleTextSizeChange = (newSize) => {
    const parsed = Math.max(10, Math.min(120, Number(newSize)));
    setTextSize(parsed);
    // If a text element is currently selected, update its size
    if (selectedElementIndex !== null && elements[selectedElementIndex]?.type === 'text') {
      const next = elements.map((el, idx) =>
        idx === selectedElementIndex ? { ...el, fontSize: parsed } : el
      );
      pushState(next);
    }
  };

  // Double click handler on canvas to edit text
  const handleDoubleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    const foundIdx = hitTest(worldPos, elements);
    if (foundIdx !== -1 && elements[foundIdx].type === 'text') {
      if (activeTextInput && currentTextValue.trim()) {
        commitCurrentText();
      }
      startEditingText(foundIdx);
    }
  };

  // Pointer Handlers
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Check for pan triggers: middle-click, space pressed, or 'hand' tool
    if (e.button === 1 || isSpacePressedRef.current || tool === 'hand') {
      isPanningRef.current = true;
      setIsGrabbing(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.target.setPointerCapture?.(e.pointerId);
      return;
    }

    const worldPos = screenToWorld(screenX, screenY);

    if (tool === 'text') {
      const foundIdx = hitTest(worldPos, elements);
      if (foundIdx !== -1 && elements[foundIdx].type === 'text') {
        if (activeTextInput && currentTextValue.trim()) {
          commitCurrentText();
        }
        startEditingText(foundIdx);
        return;
      }

      if (activeTextInput && currentTextValue.trim()) {
        commitCurrentText();
      }
      setActiveTextInput({ x: worldPos.x, y: worldPos.y, elementIndex: null });
      setCurrentTextValue('');
      return;
    }

    if (activeTextInput) {
      commitCurrentText();
    }

    isInteractingRef.current = true;
    dragStartRef.current = worldPos;
    e.target.setPointerCapture?.(e.pointerId);

    if (tool === 'select') {
      const foundIdx = hitTest(worldPos, elements);
      setSelectedElementIndex(foundIdx !== -1 ? foundIdx : null);
      if (foundIdx !== -1 && elements[foundIdx].fontSize) {
        setTextSize(elements[foundIdx].fontSize);
      }
      redrawCanvas();
      return;
    }

    if (tool === 'eraser') {
      eraseAt(worldPos);
      return;
    }

    if (tool === 'pencil') {
      currentDrawingRef.current = {
        type: 'pencil',
        points: [worldPos],
        strokeColor,
        strokeWidth,
        isDashed,
      };
    } else if (tool === 'arrow') {
      currentDrawingRef.current = {
        type: 'arrow',
        start: worldPos,
        end: worldPos,
        strokeColor,
        strokeWidth,
        isDashed,
      };
    } else if (tool === 'line') {
      currentDrawingRef.current = {
        type: 'line',
        start: worldPos,
        end: worldPos,
        strokeColor,
        strokeWidth,
        isDashed,
      };
    } else if (tool === 'rect') {
      currentDrawingRef.current = {
        type: 'rect',
        start: worldPos,
        end: worldPos,
        strokeColor,
        strokeWidth,
        isDashed,
        fillStyle,
      };
    } else if (tool === 'rounded-rect') {
      currentDrawingRef.current = {
        type: 'rounded-rect',
        start: worldPos,
        end: worldPos,
        strokeColor,
        strokeWidth,
        isDashed,
        fillStyle,
      };
    } else if (tool === 'circle') {
      currentDrawingRef.current = {
        type: 'circle',
        start: worldPos,
        end: worldPos,
        strokeColor,
        strokeWidth,
        isDashed,
        fillStyle,
      };
    } else if (tool === 'diamond') {
      currentDrawingRef.current = {
        type: 'diamond',
        start: worldPos,
        end: worldPos,
        strokeColor,
        strokeWidth,
        isDashed,
        fillStyle,
      };
    } else if (tool === 'triangle') {
      currentDrawingRef.current = {
        type: 'triangle',
        start: worldPos,
        end: worldPos,
        strokeColor,
        strokeWidth,
        isDashed,
        fillStyle,
      };
    }

    redrawCanvas();
  };

  const handlePointerMove = (e) => {
    // Handle Pan
    if (isPanningRef.current) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    if (!isInteractingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = screenToWorld(screenX, screenY);

    if (tool === 'select') {
      if (selectedElementIndex !== null && dragStartRef.current) {
        const dx = worldPos.x - dragStartRef.current.x;
        const dy = worldPos.y - dragStartRef.current.y;
        dragStartRef.current = worldPos;
        setElements((prev) =>
          prev.map((el, i) => (i === selectedElementIndex ? moveElement(el, dx, dy) : el))
        );
      }
      return;
    }

    if (tool === 'eraser') {
      eraseAt(worldPos);
      return;
    }

    if (!currentDrawingRef.current) return;

    if (tool === 'pencil') {
      currentDrawingRef.current.points.push(worldPos);
    } else {
      currentDrawingRef.current.end = worldPos;
    }

    redrawCanvas();
  };

  const handlePointerUp = (e) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsGrabbing(false);
      e.target.releasePointerCapture?.(e.pointerId);
      return;
    }

    if (!isInteractingRef.current) return;
    isInteractingRef.current = false;
    dragStartRef.current = null;
    e.target.releasePointerCapture?.(e.pointerId);

    if (tool === 'pencil' && currentDrawingRef.current) {
      if (currentDrawingRef.current.points.length > 0) {
        pushState([...elements, currentDrawingRef.current]);
      }
      currentDrawingRef.current = null;
    } else if (
      ['arrow', 'rect', 'rounded-rect', 'circle', 'diamond', 'line', 'triangle'].includes(tool) &&
      currentDrawingRef.current
    ) {
      const el = currentDrawingRef.current;
      const dist = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
      if (dist > 3) {
        pushState([...elements, el]);
      }
      currentDrawingRef.current = null;
    }

    redrawCanvas();
  };

  const eraseAt = (pos) => {
    const radius = 18 / zoom;
    const filtered = elements.filter((el) => !isNearElement(pos, el, radius));
    if (filtered.length !== elements.length) {
      pushState(filtered);
      setSelectedElementIndex(null);
    }
  };

  // Export & Save with full bounding box preservation
  const computeExportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    if (elements.length === 0) {
      const emptyCanvas = document.createElement('canvas');
      emptyCanvas.width = canvas.width;
      emptyCanvas.height = canvas.height;
      const ctx = emptyCanvas.getContext('2d');
      ctx.fillStyle = isWhiteCanvas ? '#ffffff' : '#141416';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return emptyCanvas;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach((el) => {
      const bbox = getBoundingBox(el);
      if (bbox) {
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.w);
        maxY = Math.max(maxY, bbox.y + bbox.h);
      }
    });

    const padding = 50;
    const width = Math.max(200, Math.ceil(maxX - minX + padding * 2));
    const height = Math.max(150, Math.ceil(maxY - minY + padding * 2));

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const expCtx = exportCanvas.getContext('2d');

    expCtx.fillStyle = isWhiteCanvas ? '#ffffff' : '#141416';
    expCtx.fillRect(0, 0, width, height);

    expCtx.save();
    expCtx.translate(-minX + padding, -minY + padding);
    elements.forEach((el) => {
      renderElement(expCtx, el, false);
    });
    expCtx.restore();

    return exportCanvas;
  };

  const handleSaveDrawing = () => {
    if (activeTextInput && currentTextValue.trim()) {
      commitCurrentText();
    }

    const exportCanvas = computeExportCanvas();
    if (!exportCanvas) return;

    const dataUrl = exportCanvas.toDataURL('image/png');

    onSave({
      dataUrl,
      elements,
      title: title.trim() || 'Drawing',
      width: exportCanvas.width,
      height: exportCanvas.height,
    });
    onClose();
  };

  const handleDownloadImage = () => {
    const exportCanvas = computeExportCanvas();
    if (!exportCanvas) return;

    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '-') || 'drawing'}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  if (!isOpen) return null;

  const textScreenPos = activeTextInput
    ? worldToScreen(activeTextInput.x, activeTextInput.y)
    : { x: 0, y: 0 };

  return (
    <div className="drawing-modal-overlay" onClick={onClose}>
      <div className="drawing-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="drawing-modal-header">
          <div className="drawing-title-wrapper">
            <div className="drawing-header-icon">
              <Pencil size={18} />
            </div>
            <input
              type="text"
              className="drawing-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Drawing Title"
              title="Click to rename drawing"
            />
          </div>

          <div className="drawing-header-actions">
            <button
              type="button"
              className="drawing-btn drawing-btn-ghost"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="drawing-btn drawing-btn-ghost"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={16} />
            </button>
            <button
              type="button"
              className="drawing-btn drawing-btn-ghost"
              onClick={handleClear}
              disabled={elements.length === 0}
              title="Clear Canvas"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              className="drawing-btn drawing-btn-ghost"
              onClick={handleDownloadImage}
              title="Export as PNG"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              className="drawing-btn drawing-btn-save"
              onClick={handleSaveDrawing}
              title="Insert into Note"
            >
              <Check size={16} />
              <span>Insert in Note</span>
            </button>
            <button
              type="button"
              className="drawing-btn drawing-btn-close"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Floating Tools Toolbar */}
        <div className="drawing-toolbar-bar">
          {/* Main Drawing Tools */}
          <div className="drawing-toolbar-group">
            <button
              type="button"
              className={`tool-btn ${tool === 'pencil' ? 'is-active' : ''}`}
              onClick={() => { setTool('pencil'); setSelectedElementIndex(null); }}
              title="Pencil (Freehand)"
            >
              <Pencil size={17} />
              <span className="tool-tooltip">Pencil</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'arrow' ? 'is-active' : ''}`}
              onClick={() => { setTool('arrow'); setSelectedElementIndex(null); }}
              title="Arrow"
            >
              <ArrowRight size={17} />
              <span className="tool-tooltip">Arrow</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'rect' ? 'is-active' : ''}`}
              onClick={() => { setTool('rect'); setSelectedElementIndex(null); }}
              title="Rectangle"
            >
              <Square size={17} />
              <span className="tool-tooltip">Rectangle</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'rounded-rect' ? 'is-active' : ''}`}
              onClick={() => { setTool('rounded-rect'); setSelectedElementIndex(null); }}
              title="Rounded Rectangle"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="5" ry="5" />
              </svg>
              <span className="tool-tooltip">Rounded</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'circle' ? 'is-active' : ''}`}
              onClick={() => { setTool('circle'); setSelectedElementIndex(null); }}
              title="Circle / Ellipse"
            >
              <Circle size={17} />
              <span className="tool-tooltip">Circle</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'diamond' ? 'is-active' : ''}`}
              onClick={() => { setTool('diamond'); setSelectedElementIndex(null); }}
              title="Diamond (Flowchart)"
            >
              <Diamond size={17} />
              <span className="tool-tooltip">Diamond</span>
            </button>
            <button
              type="button"
              className={`tool-btn tool-btn-aa ${tool === 'text' ? 'is-active' : ''}`}
              onClick={handleSelectTextTool}
              title="Add Text (Aa)"
            >
              <span className="aa-icon-text">Aa</span>
              <span className="tool-tooltip">Text</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'line' ? 'is-active' : ''}`}
              onClick={() => { setTool('line'); setSelectedElementIndex(null); }}
              title="Straight Line"
            >
              <Minus size={17} />
              <span className="tool-tooltip">Line</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'triangle' ? 'is-active' : ''}`}
              onClick={() => { setTool('triangle'); setSelectedElementIndex(null); }}
              title="Triangle"
            >
              <Triangle size={17} />
              <span className="tool-tooltip">Triangle</span>
            </button>
            <div className="drawing-toolbar-divider" />
            <button
              type="button"
              className={`tool-btn ${tool === 'eraser' ? 'is-active' : ''}`}
              onClick={() => { setTool('eraser'); setSelectedElementIndex(null); }}
              title="Eraser"
            >
              <Eraser size={17} />
              <span className="tool-tooltip">Eraser</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'select' ? 'is-active' : ''}`}
              onClick={() => setTool('select')}
              title="Select / Move Element"
            >
              <MousePointer size={17} />
              <span className="tool-tooltip">Select</span>
            </button>
            <button
              type="button"
              className={`tool-btn ${tool === 'hand' ? 'is-active' : ''}`}
              onClick={() => { setTool('hand'); setSelectedElementIndex(null); }}
              title="Hand / Pan Tool (Click and drag to pan canvas)"
            >
              <Hand size={17} />
              <span className="tool-tooltip">Pan (Hand)</span>
            </button>
          </div>

          <div className="drawing-toolbar-divider" />

          {/* Stroke Width Selector OR Text Size Selector */}
          {tool === 'text' || (selectedElementIndex !== null && elements[selectedElementIndex]?.type === 'text') ? (
            <div className="drawing-toolbar-group text-size-group" title="Text Font Size">
              <Type size={15} style={{ color: '#64748b', marginRight: '2px' }} />
              {TEXT_SIZES.map((ts) => (
                <button
                  key={ts.value}
                  type="button"
                  className={`text-size-pill ${textSize === ts.value ? 'is-active' : ''}`}
                  onClick={() => handleTextSizeChange(ts.value)}
                  title={`Size ${ts.label} (${ts.value}px)`}
                >
                  {ts.label}
                </button>
              ))}
              <div className="text-size-stepper" style={{ marginLeft: '4px' }}>
                <button
                  type="button"
                  className="text-size-stepper-btn"
                  onClick={() => handleTextSizeChange(textSize - 2)}
                  title="Decrease size (-2px)"
                >
                  <Minus size={12} />
                </button>
                <span className="text-size-stepper-val">{textSize}px</span>
                <button
                  type="button"
                  className="text-size-stepper-btn"
                  onClick={() => handleTextSizeChange(textSize + 2)}
                  title="Increase size (+2px)"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div className="drawing-toolbar-group">
              {STROKE_WIDTHS.map((sw) => (
                <button
                  key={sw.value}
                  type="button"
                  className={`stroke-btn ${strokeWidth === sw.value ? 'is-active' : ''}`}
                  onClick={() => setStrokeWidth(sw.value)}
                  title={`Stroke ${sw.label} (${sw.value}px)`}
                >
                  <div
                    className="stroke-indicator"
                    style={{ height: `${Math.max(2, sw.value / 2)}px` }}
                  />
                </button>
              ))}
            </div>
          )}

          <div className="drawing-toolbar-divider" />

          {/* Style Modifiers: Dashed & Fill */}
          <div className="drawing-toolbar-group">
            <button
              type="button"
              className={`tool-btn ${isDashed ? 'is-active' : ''}`}
              onClick={() => setIsDashed(!isDashed)}
              title="Dashed Line"
            >
              <span style={{ fontSize: '11px', fontWeight: 'bold' }}>- - -</span>
            </button>
            {['rect', 'rounded-rect', 'circle', 'diamond', 'triangle'].includes(tool) && (
              <button
                type="button"
                className={`tool-btn tool-btn-text ${fillStyle !== 'none' ? 'is-active' : ''}`}
                onClick={() => {
                  setFillStyle((prev) => (prev === 'none' ? 'tint' : prev === 'tint' ? 'solid' : 'none'));
                }}
                title={`Fill Style: ${fillStyle} (Click to toggle)`}
              >
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  {fillStyle === 'none' ? 'Outline' : fillStyle === 'tint' ? 'Tint' : 'Solid'}
                </span>
              </button>
            )}
          </div>

          <div className="drawing-toolbar-divider" />

          {/* Color Palette */}
          <div className="drawing-toolbar-group color-palette-group">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${strokeColor.toLowerCase() === c.toLowerCase() ? 'is-selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => {
                  setStrokeColor(c);
                  if (selectedElementIndex !== null) {
                    const next = elements.map((el, idx) =>
                      idx === selectedElementIndex ? { ...el, strokeColor: c, color: c } : el
                    );
                    pushState(next);
                  }
                }}
                title={`Color: ${c}`}
              />
            ))}
            <label className="color-picker-label" title="Custom Color">
              <Palette size={14} />
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => {
                  setStrokeColor(e.target.value);
                  if (selectedElementIndex !== null) {
                    const next = elements.map((el, idx) =>
                      idx === selectedElementIndex ? { ...el, strokeColor: e.target.value, color: e.target.value } : el
                    );
                    pushState(next);
                  }
                }}
                className="color-picker-native"
              />
            </label>
          </div>

          <div className="drawing-toolbar-divider" />

          {/* Canvas Options */}
          <div className="drawing-toolbar-group">
            <button
              type="button"
              className={`tool-btn ${showGrid ? 'is-active' : ''}`}
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle Grid Dots"
            >
              <Grid size={16} />
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => setIsWhiteCanvas(!isWhiteCanvas)}
              title={isWhiteCanvas ? 'Dark Canvas' : 'White Canvas (Default)'}
            >
              {isWhiteCanvas ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* Canvas Body */}
        <div className={`drawing-canvas-container ${isWhiteCanvas ? 'is-white-bg' : 'is-dark-bg'}`} ref={containerRef}>
          <canvas
            ref={canvasRef}
            className={`drawing-canvas ${
              isGrabbing
                ? 'is-grabbing'
                : tool === 'hand'
                ? 'is-hand'
                : tool === 'eraser'
                ? 'is-eraser'
                : tool === 'select'
                ? 'is-select'
                : tool === 'text'
                ? 'is-text'
                : 'is-draw'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleDoubleClick}
          />

          {/* Inline Text Overlay with live font-size controls */}
          {activeTextInput && (
            <div
              className="inline-text-input-wrapper"
              style={{
                left: `${textScreenPos.x}px`,
                top: `${textScreenPos.y}px`,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="inline-text-box">
                <div className="inline-text-size-row">
                  <span className="inline-text-size-label">
                    <Type size={12} /> Size:
                  </span>
                  {TEXT_SIZES.map((ts) => (
                    <button
                      key={ts.value}
                      type="button"
                      className={`text-size-pill ${textSize === ts.value ? 'is-active' : ''}`}
                      onClick={() => handleTextSizeChange(ts.value)}
                    >
                      {ts.label}
                    </button>
                  ))}
                  <div className="text-size-stepper" style={{ marginLeft: 'auto' }}>
                    <button
                      type="button"
                      className="text-size-stepper-btn"
                      onClick={() => handleTextSizeChange(textSize - 2)}
                      title="Smaller"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="text-size-stepper-val">{textSize}px</span>
                    <button
                      type="button"
                      className="text-size-stepper-btn"
                      onClick={() => handleTextSizeChange(textSize + 2)}
                      title="Larger"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>

                <textarea
                  ref={textInputRef}
                  className="inline-text-textarea"
                  value={currentTextValue}
                  onChange={(e) => setCurrentTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commitCurrentText();
                    } else if (e.key === 'Escape') {
                      setActiveTextInput(null);
                      setCurrentTextValue('');
                    }
                  }}
                  placeholder="Write your text here..."
                  style={{
                    color: strokeColor,
                    fontSize: `${Math.max(12, textSize * zoom)}px`,
                  }}
                  rows={2}
                  autoFocus
                />
                <div className="inline-text-footer">
                  <span className="inline-text-tip">Enter to {activeTextInput.elementIndex !== null && activeTextInput.elementIndex !== undefined ? 'update' : 'insert'} • Shift+Enter for newline</span>
                  <div className="inline-text-btns">
                    <button
                      type="button"
                      className="inline-text-btn-confirm"
                      onClick={commitCurrentText}
                      title={activeTextInput.elementIndex !== null && activeTextInput.elementIndex !== undefined ? 'Update text' : 'Insert text'}
                    >
                      <Check size={13} /> {activeTextInput.elementIndex !== null && activeTextInput.elementIndex !== undefined ? 'Update' : 'Insert'}
                    </button>
                    <button
                      type="button"
                      className="inline-text-btn-cancel"
                      onClick={() => {
                        setActiveTextInput(null);
                        setCurrentTextValue('');
                      }}
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Floating Zoom & Pan Controls Widget */}
          <div className="drawing-zoom-controls">
            <button
              type="button"
              className="drawing-zoom-btn"
              onClick={handleZoomOut}
              title="Zoom Out (Dezomma)"
            >
              <ZoomOut size={16} />
            </button>
            <span
              className="drawing-zoom-text"
              onClick={handleResetZoom}
              title="Click to reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="drawing-zoom-btn"
              onClick={handleZoomIn}
              title="Zoom In (Ingrandisci)"
            >
              <ZoomIn size={16} />
            </button>
            <div className="drawing-zoom-divider" />
            <button
              type="button"
              className="drawing-zoom-btn"
              onClick={handleFitContent}
              title="Fit All Content into View (Adatta alla vista)"
            >
              <Maximize2 size={15} />
            </button>
          </div>

          {selectedElementIndex !== null && (
            <div className="drawing-selected-hint">
              <span>
                {elements[selectedElementIndex]?.type === 'text'
                  ? 'Text selected • Double click or click "Edit text" to modify'
                  : 'Element selected • Drag to move • Delete to remove'}
              </span>
              {elements[selectedElementIndex]?.type === 'text' && (
                <button
                  type="button"
                  onClick={() => startEditingText(selectedElementIndex)}
                  className="selected-edit-text-btn"
                  title="Edit text content and styling"
                >
                  <Type size={13} /> Edit text
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const next = elements.filter((_, idx) => idx !== selectedElementIndex);
                  pushState(next);
                  setSelectedElementIndex(null);
                }}
                className="selected-delete-btn"
                title="Delete element"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Element Rendering & Geometry Math (World Coordinates)
// -------------------------------------------------------------
function renderElement(ctx, el, isSelected = false) {
  if (!el) return;
  ctx.save();

  ctx.strokeStyle = el.strokeColor || '#18181b';
  ctx.lineWidth = el.strokeWidth || 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (el.isDashed) {
    ctx.setLineDash([8, 6]);
  } else {
    ctx.setLineDash([]);
  }

  let fill = null;
  if (el.fillStyle === 'solid') {
    fill = el.strokeColor;
  } else if (el.fillStyle === 'tint') {
    fill = hexToRgba(el.strokeColor, 0.22);
  }

  if (el.type === 'pencil' && el.points && el.points.length > 0) {
    ctx.beginPath();
    const pts = el.points;
    if (pts.length === 1) {
      ctx.arc(pts[0].x, pts[0].y, (el.strokeWidth || 4) / 2, 0, Math.PI * 2);
      ctx.fillStyle = el.strokeColor || '#18181b';
      ctx.fill();
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
  } else if (el.type === 'line' && el.start && el.end) {
    ctx.beginPath();
    ctx.moveTo(el.start.x, el.start.y);
    ctx.lineTo(el.end.x, el.end.y);
    ctx.stroke();
  } else if (el.type === 'arrow' && el.start && el.end) {
    drawArrow(ctx, el.start, el.end, el.strokeWidth || 4, el.strokeColor || '#18181b');
  } else if (el.type === 'rect' && el.start && el.end) {
    const x = Math.min(el.start.x, el.end.x);
    const y = Math.min(el.start.y, el.end.y);
    const w = Math.abs(el.end.x - el.start.x);
    const h = Math.abs(el.end.y - el.start.y);

    ctx.beginPath();
    ctx.rect(x, y, w, h);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  } else if (el.type === 'rounded-rect' && el.start && el.end) {
    const x = Math.min(el.start.x, el.end.x);
    const y = Math.min(el.start.y, el.end.y);
    const w = Math.abs(el.end.x - el.start.x);
    const h = Math.abs(el.end.y - el.start.y);
    const radius = Math.min(18, w / 3, h / 3);

    ctx.beginPath();
    roundRect(ctx, x, y, w, h, radius);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  } else if (el.type === 'circle' && el.start && el.end) {
    const cx = (el.start.x + el.end.x) / 2;
    const cy = (el.start.y + el.end.y) / 2;
    const rx = Math.abs(el.end.x - el.start.x) / 2;
    const ry = Math.abs(el.end.y - el.start.y) / 2;

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  } else if (el.type === 'diamond' && el.start && el.end) {
    const minX = Math.min(el.start.x, el.end.x);
    const maxX = Math.max(el.start.x, el.end.x);
    const minY = Math.min(el.start.y, el.end.y);
    const maxY = Math.max(el.start.y, el.end.y);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    ctx.beginPath();
    ctx.moveTo(cx, minY);
    ctx.lineTo(maxX, cy);
    ctx.lineTo(cx, maxY);
    ctx.lineTo(minX, cy);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  } else if (el.type === 'triangle' && el.start && el.end) {
    const minX = Math.min(el.start.x, el.end.x);
    const maxX = Math.max(el.start.x, el.end.x);
    const minY = Math.min(el.start.y, el.end.y);
    const maxY = Math.max(el.start.y, el.end.y);
    const topX = (minX + maxX) / 2;

    ctx.beginPath();
    ctx.moveTo(topX, minY);
    ctx.lineTo(maxX, maxY);
    ctx.lineTo(minX, maxY);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  } else if (el.type === 'text' && el.text) {
    const fontSize = el.fontSize || 24;
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = el.color || el.strokeColor || '#18181b';
    ctx.textBaseline = 'top';
    const lines = el.text.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, el.x, el.y + i * (fontSize * 1.25));
    });
  }

  // Draw selection bounding box if selected
  if (isSelected) {
    const bbox = getBoundingBox(el);
    if (bbox) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bbox.x - 6, bbox.y - 6, bbox.w + 12, bbox.h + 12);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawArrow(ctx, start, end, strokeWidth, color) {
  const headLen = Math.max(12, strokeWidth * 3.5);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLen * Math.cos(angle - Math.PI / 6),
    end.y - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    end.x - headLen * Math.cos(angle + Math.PI / 6),
    end.y - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgba(hex, alpha = 0.25) {
  if (!hex || !hex.startsWith('#')) return `rgba(24, 24, 27, ${alpha})`;
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getBoundingBox(el) {
  if (!el) return null;
  if (el.type === 'pencil' && el.points && el.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    el.points.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (el.type === 'text' && el.text) {
    const fontSize = el.fontSize || 24;
    const lines = el.text.split('\n');
    const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
    const approxW = maxLineLen * fontSize * 0.62;
    const approxH = lines.length * fontSize * 1.3;
    return { x: el.x, y: el.y, w: approxW, h: approxH };
  }
  if (el.start && el.end) {
    const x = Math.min(el.start.x, el.end.x);
    const y = Math.min(el.start.y, el.end.y);
    const w = Math.abs(el.end.x - el.start.x);
    const h = Math.abs(el.end.y - el.start.y);
    return { x, y, w, h };
  }
  return null;
}

function moveElement(el, dx, dy) {
  if (el.type === 'pencil' && el.points) {
    return {
      ...el,
      points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  }
  if (el.type === 'text') {
    return {
      ...el,
      x: el.x + dx,
      y: el.y + dy,
    };
  }
  if (el.start && el.end) {
    return {
      ...el,
      start: { x: el.start.x + dx, y: el.start.y + dy },
      end: { x: el.end.x + dx, y: el.end.y + dy },
    };
  }
  return el;
}

function isNearElement(pos, el, threshold = 14) {
  const bbox = getBoundingBox(el);
  if (!bbox) return false;
  if (
    pos.x < bbox.x - threshold ||
    pos.x > bbox.x + bbox.w + threshold ||
    pos.y < bbox.y - threshold ||
    pos.y > bbox.y + bbox.h + threshold
  ) {
    return false;
  }
  return true;
}

function hitTest(pos, elements) {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (isNearElement(pos, elements[i], 14)) {
      return i;
    }
  }
  return -1;
}

export default DrawingModal;
