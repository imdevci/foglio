import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';
import { Mic, Download, Trash2 } from 'lucide-react';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';

const extractFilename = (url) => {
  if (!url) return null;
  const match = url.match(/\/files\/([^#?]+)/);
  return match ? match[1] : null;
};

const AudioNodeView = ({ node, deleteNode }) => {
  const { src, title = 'Voice Note' } = node.attrs;

  const handleDelete = async (e) => {
    if (e) e.stopPropagation();
    if (src) {
      const filename = extractFilename(src);
      if (filename) {
        try {
          await apiFetch(`/files/${filename}`, { method: 'DELETE' });
          toast.success("Voice note deleted");
        } catch (err) {
          console.error("Error deleting audio:", err);
          toast.error("Failed to delete audio from storage");
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

  return (
    <NodeViewWrapper
      className="audio-embed-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      contentEditable={false}
    >
      <div className="audio-embed-header">
        <div className="audio-embed-info">
          <div className="audio-badge-icon">
            <Mic size={16} />
          </div>
          <span className="audio-embed-title">
            {title || 'Voice Note'}
          </span>
          <span className="audio-tag">AUDIO</span>
        </div>
        <div className="audio-embed-actions">
          <a
            href={src}
            download={title ? `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm` : 'voice-note.webm'}
            className="pdf-action-btn"
            onClick={(e) => e.stopPropagation()}
            title="Download voice note"
          >
            <Download size={14} />
            <span>Download</span>
          </a>
          <button
            type="button"
            onClick={handleDelete}
            className="pdf-action-btn pdf-delete-btn"
            title="Delete voice note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="audio-embed-player-wrapper">
        <audio
          controls
          src={src}
          className="audio-embed-native-player"
          preload="metadata"
        />
      </div>
    </NodeViewWrapper>
  );
};

export const AudioEmbed = Node.create({
  name: 'audioEmbed',
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
        default: 'Voice Note',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.audio-embed-container',
        getAttrs: (element) => {
          const audio = element.querySelector('audio');
          return {
            src: audio?.getAttribute('src') || element.getAttribute('data-src') || '',
            title: element.getAttribute('data-title') || 'Voice Note',
          };
        },
      },
      {
        tag: 'audio[data-type="audio-player"]',
        getAttrs: (element) => ({
          src: element.getAttribute('src') || '',
          title: element.getAttribute('data-title') || 'Voice Note',
        }),
      },
      {
        tag: 'audio',
        getAttrs: (element) => ({
          src: element.getAttribute('src') || '',
          title: element.getAttribute('data-title') || element.getAttribute('title') || 'Voice Note',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src || '';
    const title = HTMLAttributes.title || 'Voice Note';

    return [
      'audio',
      mergeAttributes(HTMLAttributes, {
        src,
        controls: 'true',
        'data-type': 'audio-player',
        'data-title': title,
        class: 'audio-embed-native-player',
      }),
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const src = node.attrs.src || '';
          const title = node.attrs.title || 'Voice Note';
          state.write(
            `<audio controls src="${src}" data-type="audio-player" data-title="${title}"></audio>\n\n`,
          );
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioNodeView);
  },

  addCommands() {
    return {
      setAudioEmbed:
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
