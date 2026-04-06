import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { FileText, ExternalLink, Download, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

const extractFilename = (url) => {
  if (!url) return null;
  const match = url.match(/\/files\/([^#?]+)/);
  return match ? match[1] : null;
};

const PdfNodeView = ({ node, updateAttributes, deleteNode }) => {
  const { src, title, height = '550px', collapsed = false } = node.attrs;
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
    if (e) e.stopPropagation();
    if (src) {
      const filename = extractFilename(src);
      if (filename) {
        try {
          await apiFetch(`/files/${filename}`, { method: 'DELETE' });
          toast.success("PDF file deleted");
        } catch (err) {
          console.error("Error deleting PDF:", err);
        }
      }
    }
    deleteNode();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      handleDelete();
    }
  };

  return (
    <NodeViewWrapper
      className={`pdf-embed-container ${isCollapsed ? 'is-collapsed' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      contentEditable={false}
    >
      <div className="pdf-embed-header">
        <div
          className="pdf-embed-info"
          onClick={toggleCollapse}
          title={isCollapsed ? "Expand preview" : "Minimize preview"}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleCollapse(e);
            }
          }}
        >
          <div className="pdf-badge-icon">
            <FileText size={16} />
          </div>
          <span className="pdf-embed-title">
            {title || 'PDF Document'}
          </span>
          <span className="pdf-tag">PDF</span>
        </div>
        <div className="pdf-embed-actions">
          <button
            type="button"
            onClick={toggleCollapse}
            className={`pdf-action-btn pdf-toggle-btn ${isCollapsed ? 'is-collapsed' : ''}`}
            title={isCollapsed ? "Expand preview PDF" : "Minimize preview PDF"}
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
            title="Open PDF in a new tab"
          >
            <ExternalLink size={14} />
            <span>Open</span>
          </a>
          <a
            href={src}
            download={title || 'document.pdf'}
            className="pdf-action-btn"
            onClick={(e) => e.stopPropagation()}
            title="Download PDF file"
          >
            <Download size={14} />
            <span>Download</span>
          </a>
          <button
            type="button"
            onClick={handleDelete}
            className="pdf-action-btn pdf-delete-btn"
            title="Delete PDF"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div
        className="pdf-embed-body"
        style={{ height: isCollapsed ? 0 : height }}
      >
        <iframe
          src={`${src}#toolbar=1`}
          title={title || 'PDF Document'}
          className="pdf-embed-iframe"
          frameBorder="0"
        />
      </div>
    </NodeViewWrapper>
  );
};

export const PdfEmbed = Node.create({
  name: 'pdfEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: '',
      },
      title: {
        default: 'PDF Document',
      },
      height: {
        default: '550px',
      },
      collapsed: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.pdf-embed-container',
        getAttrs: (element) => {
          const iframe = element.querySelector('iframe');
          return {
            src:
              iframe?.getAttribute('src')?.replace(/#.*$/, '') ||
              element.getAttribute('data-src') ||
              '',
            title: element.getAttribute('data-title') || 'PDF Document',
            height: element.getAttribute('data-height') || '550px',
            collapsed:
              element.getAttribute('data-collapsed') === 'true' ||
              element.classList.contains('is-collapsed'),
          };
        },
      },
      {
        tag: 'iframe[data-type="pdf-viewer"]',
        getAttrs: (element) => ({
          src: element.getAttribute('src')?.replace(/#.*$/, '') || '',
          title: element.getAttribute('data-title') || 'PDF Document',
          height: element.getAttribute('height') || '550px',
          collapsed: element.getAttribute('data-collapsed') === 'true',
        }),
      },
      {
        tag: 'iframe[src*=".pdf"]',
        getAttrs: (element) => ({
          src: element.getAttribute('src')?.replace(/#.*$/, '') || '',
          title:
            element.getAttribute('data-title') ||
            element.getAttribute('title') ||
            'PDF Document',
          height: element.getAttribute('height') || '550px',
          collapsed: element.getAttribute('data-collapsed') === 'true',
        }),
      },
      {
        tag: 'embed[type="application/pdf"]',
        getAttrs: (element) => ({
          src: element.getAttribute('src')?.replace(/#.*$/, '') || '',
          title: 'PDF Document',
          height: element.getAttribute('height') || '550px',
          collapsed: element.getAttribute('data-collapsed') === 'true',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src || '';
    const title = HTMLAttributes.title || 'PDF Document';
    const height = HTMLAttributes.height || '550px';
    const collapsed = HTMLAttributes.collapsed ? 'true' : 'false';

    return [
      'iframe',
      mergeAttributes(HTMLAttributes, {
        src: `${src}#toolbar=1`,
        'data-type': 'pdf-viewer',
        'data-title': title,
        'data-collapsed': collapsed,
        width: '100%',
        height,
        class: 'pdf-embed-iframe',
        frameborder: '0',
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const src = node.attrs.src || '';
          const title = node.attrs.title || 'PDF Document';
          const height = node.attrs.height || '550px';
          const collapsed = node.attrs.collapsed ? 'true' : 'false';
          state.write(
            `<iframe src="${src}#toolbar=1" data-type="pdf-viewer" data-title="${title}" data-collapsed="${collapsed}" width="100%" height="${height}" frameborder="0"></iframe>\n\n`,
          );
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(PdfNodeView);
  },

  addCommands() {
    return {
      setPdfEmbed:
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
              {
                type: 'paragraph',
              },
            ]);
          },
    };
  },
});
