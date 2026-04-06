import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { Trash2, ExternalLink, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

const extractFilename = (url) => {
  if (!url) return null;
  const match = url.match(/\/files\/([^#?]+)/);
  return match ? match[1] : null;
};

const ImageNodeView = ({ node, updateAttributes, deleteNode }) => {
  const { src, alt, collapsed = false } = node.attrs;
  const isCollapsed = Boolean(collapsed);

  const toggleCollapse = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (typeof updateAttributes === 'function') {
      updateAttributes({ collapsed: !isCollapsed });
    }
  };

  const handleDelete = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (src) {
      const filename = extractFilename(src);
      if (filename) {
        try {
          await apiFetch(`/files/${filename}`, { method: 'DELETE' });
          toast.success("Image deleted");
        } catch (err) {
          console.error("Error deleting image:", err);
        }
      }
    }
    deleteNode();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      handleDelete(e);
    }
  };

  const displayTitle = alt || extractFilename(src)?.split('/').pop() || 'Image';

  return (
    <NodeViewWrapper
      className={`pdf-embed-container image-embed-container ${isCollapsed ? 'is-collapsed' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      contentEditable={false}
    >
      <div className="pdf-embed-header">
        <div
          className="pdf-embed-info"
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand image" : "Minimize image"}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleCollapse(e);
            }
          }}
        >
          <div className="image-badge-icon">
            <ImageIcon size={16} />
          </div>
          <span className="pdf-embed-title">
            {displayTitle}
          </span>
          <span className="image-tag">IMG</span>
        </div>
        <div className="pdf-embed-actions">
          <button
            type="button"
            onClick={toggleCollapse}
            className={`pdf-action-btn pdf-toggle-btn ${isCollapsed ? 'is-collapsed' : ''}`}
            title={isCollapsed ? "Expand image" : "Minimize image"}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            <span>{isCollapsed ? "Expand" : "Minimize"}</span>
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="pdf-action-btn"
            onClick={(e) => e.stopPropagation()}
            title="Open image in a new tab"
          >
            <ExternalLink size={14} />
            <span>Open</span>
          </a>
          <button
            type="button"
            onClick={handleDelete}
            className="pdf-action-btn pdf-delete-btn"
            title="Delete image"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="pdf-embed-body image-embed-body">
        <img
          src={src}
          alt={alt || ''}
          className="editor-image-element"
        />
      </div>
    </NodeViewWrapper>
  );
};

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => ({
          'data-collapsed': attributes.collapsed ? 'true' : 'false',
        }),
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const src = node.attrs.src || '';
          const alt = (node.attrs.alt || '').replace(/"/g, '&quot;');
          if (node.attrs.collapsed) {
            state.write(`<img src="${src}" alt="${alt}" data-collapsed="true" />`);
          } else {
            state.write(
              '![' +
                state.esc(node.attrs.alt || '') +
                '](' +
                src.replace(/[\(\)]/g, '\\$&') +
                (node.attrs.title ? ' "' + node.attrs.title.replace(/"/g, '\\"') + '"' : '') +
                ')'
            );
          }
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addCommands() {
    return {
      setImage:
        (options) =>
          ({ commands }) => {
            return commands.insertContent([
              {
                type: this.name,
                attrs: options,
              },
              {
                type: 'paragraph',
              },
            ]);
          },
    };
  },
});
