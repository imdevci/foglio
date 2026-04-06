import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { Pencil, Download, Trash2, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';

const DrawingNodeView = ({ node, updateAttributes, deleteNode }) => {
  const { src, title = 'Drawing', elements = '[]', collapsed = false } = node.attrs;
  const isCollapsed = Boolean(collapsed);

  let parsedElements = [];
  try {
    parsedElements = typeof elements === 'string' ? JSON.parse(decodeURIComponent(elements)) : elements;
  } catch {
    try {
      parsedElements = JSON.parse(elements);
    } catch {
      parsedElements = [];
    }
  }

  const toggleCollapse = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (typeof updateAttributes === 'function') {
      updateAttributes({ collapsed: !isCollapsed });
    }
  };

  const handleEdit = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    // Dispatch window event so Editor can open DrawingModal in edit mode
    window.dispatchEvent(
      new CustomEvent('foglio:edit-drawing', {
        detail: {
          node,
          updateAttributes,
          elements: parsedElements,
          title,
        },
      })
    );
  };

  const handleDownload = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!src) return;
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '-') || 'drawing'}.png`;
    link.href = src;
    link.click();
  };

  const handleDelete = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    deleteNode();
    toast.success('Drawing removed');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      handleDelete();
    }
  };

  return (
    <NodeViewWrapper
      className={`pdf-embed-container drawing-embed-container ${isCollapsed ? 'is-collapsed' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      contentEditable={false}
    >
      <div className="pdf-embed-header">
        <div
          className="pdf-embed-info"
          onClick={toggleCollapse}
          title={isCollapsed ? 'Expand drawing' : 'Minimize drawing'}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleCollapse(e);
            }
          }}
        >
          <div className="drawing-badge-icon">
            <Pencil size={15} />
          </div>
          <span className="pdf-embed-title">{title || 'Drawing'}</span>
          <span className="drawing-tag">DRAW</span>
        </div>

        <div className="pdf-embed-actions">
          <button
            type="button"
            onClick={handleEdit}
            className="pdf-action-btn drawing-edit-btn"
            title="Edit Drawing (Modifica forme, frecce o disegno)"
          >
            <Edit3 size={14} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="pdf-action-btn"
            title="Download drawing PNG"
          >
            <Download size={14} />
            <span>Download</span>
          </button>
          <button
            type="button"
            onClick={toggleCollapse}
            className={`pdf-action-btn pdf-toggle-btn ${isCollapsed ? 'is-collapsed' : ''}`}
            title={isCollapsed ? 'Expand drawing' : 'Minimize drawing'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            <span>{isCollapsed ? 'Expand' : 'Minimize'}</span>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="pdf-action-btn pdf-delete-btn"
            title="Delete drawing"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="pdf-embed-body drawing-embed-body">
        {src ? (
          <img
            src={src}
            alt={title || 'Drawing'}
            className="editor-drawing-element"
            onDoubleClick={handleEdit}
            title="Double click to edit drawing"
          />
        ) : (
          <div className="drawing-empty-placeholder">Empty drawing</div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const DrawingEmbed = Node.create({
  name: 'drawingEmbed',
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: (element) => {
          const img = element.querySelector('img');
          return img?.getAttribute('src') || element.getAttribute('src') || '';
        },
        renderHTML: (attributes) => ({
          src: attributes.src,
        }),
      },
      title: {
        default: 'Drawing',
        parseHTML: (element) => element.getAttribute('data-title') || 'Drawing',
        renderHTML: (attributes) => ({
          'data-title': attributes.title || 'Drawing',
        }),
      },
      elements: {
        default: '[]',
        parseHTML: (element) => element.getAttribute('data-elements') || '[]',
        renderHTML: (attributes) => ({
          'data-elements': typeof attributes.elements === 'string'
            ? attributes.elements
            : encodeURIComponent(JSON.stringify(attributes.elements || [])),
        }),
      },
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => ({
          'data-collapsed': attributes.collapsed ? 'true' : 'false',
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="drawing"]',
        getAttrs: (element) => {
          const img = element.querySelector('img');
          return {
            src: img ? img.getAttribute('src') : element.getAttribute('data-src') || '',
            title: element.getAttribute('data-title') || 'Drawing',
            elements: element.getAttribute('data-elements') || '[]',
            collapsed: element.getAttribute('data-collapsed') === 'true',
          };
        },
      },
      {
        tag: 'div[data-type="drawing"]',
        getAttrs: (element) => {
          const img = element.querySelector('img');
          return {
            src: img ? img.getAttribute('src') : element.getAttribute('data-src') || '',
            title: element.getAttribute('data-title') || 'Drawing',
            elements: element.getAttribute('data-elements') || '[]',
            collapsed: element.getAttribute('data-collapsed') === 'true',
          };
        },
      },
      {
        tag: 'img[data-type="drawing"]',
        getAttrs: (element) => ({
          src: element.getAttribute('src') || '',
          title: element.getAttribute('data-title') || element.getAttribute('alt') || 'Drawing',
          elements: element.getAttribute('data-elements') || '[]',
          collapsed: element.getAttribute('data-collapsed') === 'true',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, title = 'Drawing', elements = '[]', collapsed = 'false' } = HTMLAttributes;
    const encodedElements = typeof elements === 'string'
      ? elements
      : encodeURIComponent(JSON.stringify(elements || []));

    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'drawing',
        'data-title': title,
        'data-elements': encodedElements,
        'data-collapsed': collapsed,
        class: 'drawing-embed-figure',
      }),
      ['img', { src: src || '', alt: title, class: 'editor-drawing-img' }],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const src = node.attrs.src || '';
          const title = (node.attrs.title || 'Drawing').replace(/"/g, '&quot;');
          const rawElements = node.attrs.elements;
          const encoded = typeof rawElements === 'string'
            ? rawElements
            : encodeURIComponent(JSON.stringify(rawElements || []));
          const collapsed = node.attrs.collapsed ? 'true' : 'false';

          state.write(
            `<figure data-type="drawing" data-title="${title}" data-elements="${encoded}" data-collapsed="${collapsed}"><img src="${src}" alt="${title}" /></figure>\n\n`
          );
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingNodeView);
  },

  addCommands() {
    return {
      setDrawingEmbed:
        (options) =>
        ({ commands }) => {
          return commands.insertContent([
            {
              type: this.name,
              attrs: {
                ...options,
                elements: typeof options.elements === 'string'
                  ? options.elements
                  : encodeURIComponent(JSON.stringify(options.elements || [])),
              },
            },
            {
              type: 'paragraph',
            },
          ]);
        },
    };
  },
});

export default DrawingEmbed;
