import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import React, { useEffect, useState, useRef } from 'react';
import { Globe, ExternalLink, Trash2 } from 'lucide-react';
import { apiFetch } from '../utils/api';

const LinkPreviewNodeView = ({ node, updateAttributes, deleteNode }) => {
  const { url, title, description, image, domain, favicon } = node.attrs;
  const updateAttributesRef = useRef(updateAttributes);
  updateAttributesRef.current = updateAttributes;

  const [loading, setLoading] = useState(!title);

  useEffect(() => {
    if (!url || title) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchPreview = async () => {
      try {
        const res = await apiFetch(`/notes/link-preview?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Failed to fetch preview');
        const data = await res.json();
        if (isMounted && typeof updateAttributesRef.current === 'function') {
          updateAttributesRef.current({
            title: data.title || data.domain || url,
            description: data.description || '',
            image: data.image || '',
            domain: data.domain || '',
            favicon: data.favicon || '',
          });
        }
      } catch {
        if (isMounted && typeof updateAttributesRef.current === 'function') {
          let fallbackDomain = url;
          try {
            fallbackDomain = new URL(url).hostname.replace(/^www\./, '');
          } catch {
            // ignore
          }
          updateAttributesRef.current({
            title: fallbackDomain,
            domain: fallbackDomain,
            favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(fallbackDomain)}&sz=64`,
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [url]);

  const handleDelete = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    deleteNode();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      deleteNode();
    }
  };

  let displayDomain = domain;
  if (!displayDomain && url) {
    try {
      displayDomain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      displayDomain = url;
    }
  }

  return (
    <NodeViewWrapper
      className="link-preview-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      contentEditable={false}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="link-preview-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="link-preview-content">
          <div className="link-preview-header">
            {favicon ? (
              <img
                src={favicon}
                alt=""
                className="link-preview-favicon"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <Globe size={14} className="link-preview-globe" />
            )}
            <span className="link-preview-domain">{displayDomain}</span>
          </div>
          <div className="link-preview-title">
            {loading ? 'Loading preview...' : title || url}
          </div>
          {description && (
            <div className="link-preview-description">{description}</div>
          )}
          <div className="link-preview-url">{url}</div>
        </div>
        {image && (
          <div className="link-preview-image-wrapper">
            <img
              src={image}
              alt={title || ''}
              className="link-preview-image"
              onError={(e) => {
                e.target.parentElement.style.display = 'none';
              }}
            />
          </div>
        )}
      </a>
      <div className="link-preview-actions">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="pdf-action-btn"
          onClick={(e) => e.stopPropagation()}
          title="Open link"
        >
          <ExternalLink size={14} />
        </a>
        <button
          type="button"
          onClick={handleDelete}
          className="pdf-action-btn pdf-delete-btn"
          title="Remove preview"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </NodeViewWrapper>
  );
};

export const LinkPreview = Node.create({
  name: 'linkPreview',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  priority: 1000,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      image: { default: '' },
      domain: { default: '' },
      favicon: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="link-preview"]',
        getAttrs: (element) => ({
          url: element.getAttribute('data-url') || '',
          title: element.getAttribute('data-title') || '',
          description: element.getAttribute('data-description') || '',
          image: element.getAttribute('data-image') || '',
          domain: element.getAttribute('data-domain') || '',
          favicon: element.getAttribute('data-favicon') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const {
      url = '',
      title = '',
      description = '',
      image = '',
      domain = '',
      favicon = '',
    } = HTMLAttributes;

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'link-preview',
        'data-url': url,
        'data-title': title,
        'data-description': description,
        'data-image': image,
        'data-domain': domain,
        'data-favicon': favicon,
        class: 'link-preview-static',
      }),
      [
        'a',
        { href: url, target: '_blank', rel: 'noopener noreferrer' },
        title || url,
      ],
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const esc = (str) =>
            String(str || '')
              .replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          const { url, title, description, image, domain, favicon } = node.attrs;
          state.write(
            `<div data-type="link-preview" data-url="${esc(url)}" data-title="${esc(title)}" data-description="${esc(description)}" data-image="${esc(image)}" data-domain="${esc(domain)}" data-favicon="${esc(favicon)}"><a href="${esc(url)}">${esc(title || url)}</a></div>\n\n`,
          );
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewNodeView);
  },

  addCommands() {
    return {
      setLinkPreview:
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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('linkPreviewPaste'),
        props: {
          handlePaste: (view, event) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            let text = clipboardData.getData('text/plain')?.trim();
            if (!text) return false;

            text = text
              .replace(/^<(.+)>$/, '$1')
              .replace(/^\((.+)\)$/, '$1')
              .replace(/^["'](.+)["']$/, '$1')
              .trim();

            if (/^www\./i.test(text)) {
              text = 'https://' + text;
            }

            if (/\s/.test(text)) {
              return false;
            }

            try {
              const parsed = new URL(text);
              if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                const { selection } = view.state;
                const $from = selection.$from;
                for (let d = $from.depth; d > 0; d--) {
                  if ($from.node(d).type.spec.code) {
                    return false;
                  }
                }

                event.preventDefault();
                return this.editor.commands.setLinkPreview({ url: parsed.href });
              }
            } catch {
              return false;
            }

            return false;
          },
        },
      }),
    ];
  },
});

