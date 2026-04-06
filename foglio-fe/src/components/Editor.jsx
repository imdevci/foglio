import { useEditor, EditorContent } from "@tiptap/react";
import html2pdf from "html2pdf.js";
import StarterKit from "@tiptap/starter-kit";
import { CustomImage } from "../extensions/CustomImage";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Link } from "@tiptap/extension-link";
import { CustomTable, CustomTableView } from "../extensions/CustomTable";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { useRef, useState, useEffect } from "react";
import {
  Check, Trash2, FileDown, FolderOpen, ImagePlus,
  CheckSquare, Plus, ArrowLeft, LogOut, Table2,
  AlignLeft, AlignCenter, AlignRight, Highlighter,
  X, FileText, File as FileIcon, User, Settings, Lock, LockOpen, ChevronDown,
  Mic, Pin, Pencil, RotateCcw
} from "lucide-react";
import { PdfEmbed } from "../extensions/PdfEmbed";
import { AudioEmbed } from "../extensions/AudioEmbed";
import { LinkPreview } from "../extensions/LinkPreview";
import { DrawingEmbed } from "../extensions/DrawingEmbed";
import { DrawingModal } from "./DrawingModal";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import HamburgerMenu from "./HamburgerMenu";
import FloatingButton from "./FloatingButton";
import { apiFetch } from "../utils/api";
import "../App.css";

const Editor = () => {
  const { logout, deleteAccount, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showTextTools, setShowTextTools] = useState(false);
  const [showFileTools, setShowFileTools] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [noteTitle, setNoteTitle] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [labels, setLabels] = useState([]);
  const [savingNote, setSavingNote] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [currentView, setCurrentView] = useState("notes-list");
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [selectedLabelForNotes, setSelectedLabelForNotes] = useState(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNoteProtected, setIsNoteProtected] = useState(false);
  const openMarkdownFileInputRef = useRef(null);
  const uploadImageFileInputRef = useRef(null);
  const uploadPdfFileInputRef = useRef(null);
  const colorPickerInputRef = useRef(null);
  const userMenuRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const [showCreateLabelModal, setShowCreateLabelModal] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [noteToUnlock, setNoteToUnlock] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockingNote, setUnlockingNote] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [editingDrawingData, setEditingDrawingData] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    const handleEditDrawing = (e) => {
      const detail = e.detail;
      if (detail) {
        setEditingDrawingData(detail);
        setIsDrawingModalOpen(true);
      }
    };
    window.addEventListener("foglio:edit-drawing", handleEditDrawing);
    return () => window.removeEventListener("foglio:edit-drawing", handleEditDrawing);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserMenu]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const handleViewportChange = () => {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) {
        setIsKeyboardOpen(false);
        document.documentElement.style.setProperty("--keyboard-offset", "0px");
        return;
      }

      const heightDiff = window.innerHeight - viewport.height;
      const keyboardVisible = heightDiff > 150;
      setIsKeyboardOpen(keyboardVisible);
      document.documentElement.style.setProperty(
        "--keyboard-offset",
        keyboardVisible ? `${Math.max(0, heightDiff)}px` : "0px"
      );
    };

    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);
    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
      document.documentElement.style.setProperty("--keyboard-offset", "0px");
    };
  }, []);

  const fetchLabels = async () => {
    try {
      const response = await apiFetch(`/labels`, {
        headers: { user: user?.email },
      });
      const data = await response.json();
      setLabels(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading labels:", err);
      toast.error("Error loading labels");
    }
  };

  const fetchRecentNotes = async () => {
    setLoadingNotes(true);
    try {
      const response = await apiFetch(`/notes`, {
        headers: { user: user?.email },
      });
      if (!response.ok) {
        throw new Error("Error loading notes");
      }
      const data = await response.json();
      setFilteredNotes(Array.isArray(data) ? data : []);
      setSelectedLabelForNotes(null);
      setCurrentView("notes-list");
    } catch (err) {
      console.error("Error loading notes:", err);
      toast.error("Error loading notes");
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLabels();
      fetchRecentNotes();
      window.scrollTo(0, 0);
    }
  }, [user]);

  const handleCreateLabelFromModal = async (e) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;

    setIsCreatingLabel(true);
    try {
      const response = await apiFetch("/labels", {
        method: "POST",
        body: JSON.stringify({ name: newLabelName.trim(), user: user?.email }),
      });

      if (!response.ok) {
        throw new Error("Error creating label");
      }

      const createdLabel = await response.json();
      toast.success("Label created successfully");
      setNewLabelName("");
      setShowCreateLabelModal(false);
      await fetchLabels();
      if (createdLabel?._id) {
        setSelectedLabel(createdLabel._id);
      }
    } catch (err) {
      console.error("Error creating label:", err);
      toast.error(err.message || "Error creating label");
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: true,
        link: false,
      }),
      CustomImage.configure({
        allowBase64: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        tightLists: true,
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: true,
        linkOnPaste: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      CustomTable.configure({
        resizable: true,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
        View: CustomTableView,
      }),
      TableRow,
      TableHeader,
      TableCell,
      PdfEmbed,
      AudioEmbed,
      LinkPreview,
      DrawingEmbed,
    ],
    content: "",
    onUpdate: ({ editor: currentEditor }) => {
      if (typeof window !== "undefined" && window.innerWidth <= 768 && window.visualViewport) {
        requestAnimationFrame(() => {
          try {
            const { from } = currentEditor.state.selection;
            const coords = currentEditor.view.coordsAtPos(from);
            const viewportHeight = window.visualViewport.height;
            const bottomThreshold = viewportHeight - 60;
            if (coords.bottom > bottomThreshold) {
              window.scrollBy({
                top: coords.bottom - bottomThreshold + 24,
                behavior: "smooth",
              });
            }
          } catch {
            // ignore coordinate errors
          }
        });
      }
    },
    onFocus: ({ editor: currentEditor }) => {
      if (typeof window !== "undefined" && window.innerWidth <= 768) {
        setTimeout(() => {
          try {
            const { from } = currentEditor.state.selection;
            const coords = currentEditor.view.coordsAtPos(from);
            const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            const bottomThreshold = viewportHeight - 60;
            if (coords.bottom > bottomThreshold) {
              window.scrollBy({
                top: coords.bottom - bottomThreshold + 30,
                behavior: "smooth",
              });
            }
          } catch {
            // ignore coordinate errors
          }
        }, 250);
      }
    },
  });

  const addTable = () => {
    if (tableRows && tableCols) {
      editor
        .chain()
        .focus()
        .insertTable({
          rows: parseInt(tableRows),
          cols: parseInt(tableCols),
          withHeaderRow: true,
        })
        .insertContent("<p></p>")
        .run();
      setShowTableMenu(false);
    }
  };

  const openMarkdown = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith(".md")) {
        toast.error("Please select a .md file");
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        editor.chain().focus().setContent(content, true).run();
      };
      reader.readAsText(file);
      localStorage.setItem("filename", file.name.replace(".md", ""));
    }
    event.target.value = "";
  };

  const exportAsMarkdown = () => {
    if (!editor) return;
    if (!noteTitle) return;

    try {
      const markdownContent = editor.storage.markdown.getMarkdown();
      const blob = new Blob(
        [markdownContent],
        { type: "text/markdown" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${noteTitle}.md`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("Error exporting note");
    }
  };

  const exportAsPDF = async (orientation = 'portrait') => {
    if (!editor) return;
    if (!noteTitle) {
      toast.error("Please insert a title for the note");
      return;
    }

    const isLandscape = orientation === 'landscape';
    const maxImgHeight = isLandscape ? '130mm' : '190mm';
    const htmlContent = editor.getHTML();

    const element = document.createElement("div");

    element.innerHTML = `
      <div class="pdf-container">
        <h2 class="pdf-title">${noteTitle}</h2>
        <div class="pdf-content">
          ${htmlContent}
        </div>
      </div>
      <style>
        .pdf-container {
          font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b;
          padding: 4px 6px;
          box-sizing: border-box;
        }
        .pdf-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          border-bottom: 1.5px solid #cbd5e1;
          padding-bottom: 6px;
          margin: 0 0 14px 0;
          word-break: break-word;
          line-height: 1.3;
        }
        .pdf-content {
          font-size: 13px;
          line-height: 1.6;
        }
        .pdf-content table {
          border-collapse: collapse;
          width: 100%;
          margin: 14px 0;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .pdf-content th, .pdf-content td {
          border: 1px solid #cbd5e1;
          padding: 6px 10px;
          text-align: left;
          vertical-align: middle;
          box-sizing: border-box;
        }
        .pdf-content th {
          background-color: #3b82f6;
          color: white;
          font-weight: bold;
        }
        .pdf-content th p, .pdf-content td p {
          margin: 0;
          padding: 0;
          line-height: 1.4;
        }
        .pdf-content ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .pdf-content ul[data-type="taskList"] li {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .pdf-content ul[data-type="taskList"] input[type="checkbox"] {
          margin-right: 10px;
          width: 15px;
          height: 15px;
        }
        /* Disegni e immagini adattati per non sforare la pagina ed evitare tagli */
        figure[data-type="drawing"], .drawing-embed-figure {
          margin: 10px auto;
          text-align: center;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          display: block;
          max-width: 100%;
        }
        .pdf-content img, .drawing-embed-figure img, .editor-drawing-img {
          max-width: 100% !important;
          max-height: ${maxImgHeight} !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
          border-radius: 4px;
          margin: 6px auto;
          display: block;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .pdf-content blockquote {
          border-left: 3px solid #3b82f6;
          padding: 8px 16px;
          margin: 14px 0;
          background: #f8fafc;
          font-style: italic;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .pdf-content pre {
          background: #f1f5f9;
          padding: 8px 12px;
          border-radius: 6px;
          overflow-x: auto;
          font-family: monospace;
          white-space: pre-wrap;
          word-wrap: break-word;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .pdf-content code {
          background: #f1f5f9;
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
        }
      </style>
    `;

    const opt = {
      margin: 10,
      filename: `${noteTitle}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    try {
      toast.loading("Generating PDF...", { id: "pdf-gen" });
      await html2pdf().from(element).set(opt).save();
      toast.success("PDF exported successfully", { id: "pdf-gen" });
    } catch (error) {
      console.error(error);
      toast.error("Error exporting PDF", { id: "pdf-gen" });
    }
  };

  const optimizeImage = async (file) => {
    if (!file || (!file.type?.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))) {
      return file;
    }
    if (
      file.type === "image/gif" ||
      file.type === "image/svg+xml" ||
      file.name.toLowerCase().endsWith(".svg") ||
      file.name.toLowerCase().endsWith(".gif")
    ) {
      return file;
    }

    try {
      return await new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const maxWidth = 2560;
          const maxHeight = 2560;
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          const isHeic =
            file.name.toLowerCase().endsWith(".heic") ||
            file.name.toLowerCase().endsWith(".heif") ||
            file.type.includes("heic") ||
            file.type.includes("heif");

          if (!isHeic && file.size < 1.5 * 1024 * 1024 && width <= maxWidth && height <= maxHeight) {
            resolve(file);
            return;
          }

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
              const convertedFile = new File([blob], cleanName, { type: "image/jpeg" });
              resolve(convertedFile);
            },
            "image/jpeg",
            0.85
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(file);
        };
        img.src = url;
      });
    } catch {
      return file;
    }
  };

  const uploadFileToStorage = async (file, folder) => {
    const formData = new FormData();
    formData.append("file", file);
    if (folder) {
      formData.append("folder", folder);
    }
    const currentUserId = user?.userId || user?.id || localStorage.getItem("userId");
    if (currentUserId) {
      formData.append("userId", currentUserId);
    }

    const response = await apiFetch("/files/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "File upload failed";
      try {
        const err = await response.json();
        if (err && err.message) {
          errorMessage = Array.isArray(err.message) ? err.message.join(", ") : err.message;
        }
      } catch {
        if (response.status === 413) {
          errorMessage = "File is too large (max 50MB)";
        } else if (response.statusText) {
          errorMessage = `Upload failed: ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const toastId = toast.loading("Uploading image...");
    try {
      for (const file of files) {
        const fileToUpload = await optimizeImage(file);
        const data = await uploadFileToStorage(fileToUpload, "images");
        editor
          .chain()
          .focus()
          .setImage({ src: data.url, alt: fileToUpload.name })
          .focus()
          .run();
      }
      toast.success("Image uploaded to storage", { id: toastId });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(error.message || "Error uploading image", { id: toastId });
    } finally {
      event.target.value = "";
    }
  };

  const handlePdfUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const toastId = toast.loading("Uploading PDF...");
    try {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
          toast.error("Please select only PDF files", { id: toastId });
          continue;
        }
        const data = await uploadFileToStorage(file, "documents");
        editor.view.focus();
        editor.chain().focus().setPdfEmbed({ src: data.url, title: file.name }).run();
      }
      toast.success("PDF embedded successfully!", { id: toastId });
    } catch (error) {
      console.error("Error uploading PDF:", error);
      toast.error(error.message || "Error uploading PDF", { id: toastId });
    } finally {
      event.target.value = "";
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Microphone access is not supported by your browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        } else {
          mimeType = "";
        }
      }

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      toast.error("Could not access microphone: " + (err.message || "Permission denied"));
    }
  };

  const stopAndSaveRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    const toastId = toast.loading("Saving voice note to MinIO...");
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      try {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size === 0) {
          toast.error("Recording is empty", { id: toastId });
          return;
        }

        const fileName = `voice-note-${Date.now()}.${extension}`;
        const file = new File([audioBlob], fileName, { type: mimeType });

        const data = await uploadFileToStorage(file, "audio");
        const title = `Voice Note ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

        editor.view.focus();
        editor.chain().focus().setAudioEmbed({ src: data.url, title }).run();
        toast.success("Voice note saved!", { id: toastId });
      } catch (err) {
        console.error("Error saving voice note:", err);
        toast.error("Error saving voice note: " + (err.message || "Upload failed"), { id: toastId });
      } finally {
        setIsRecording(false);
        setRecordingDuration(0);
        audioChunksRef.current = [];
      }
    };

    recorder.stop();
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
    toast("Recording cancelled");
  };

  if (!editor) return null;

  const handleOpenMarkdownFileInputRef = () => {
    openMarkdownFileInputRef.current.click();
  };

  const handleUploadImageFileInputRef = () => {
    uploadImageFileInputRef.current.click();
  };

  const handleUploadPdfFileInputRef = () => {
    uploadPdfFileInputRef.current.click();
  };

  const handleColorPickerInputRef = () => {
    colorPickerInputRef.current?.click();
  };

  const handleOpenNewDrawing = () => {
    setEditingDrawingData(null);
    setIsDrawingModalOpen(true);
  };

  const handleSaveDrawing = async ({ dataUrl, elements, title }) => {
    try {
      if (editingDrawingData && editingDrawingData.updateAttributes) {
        editingDrawingData.updateAttributes({
          src: dataUrl,
          title: title || "Drawing",
          elements: encodeURIComponent(JSON.stringify(elements || [])),
        });
        toast.success("Drawing updated");
        setEditingDrawingData(null);
        return;
      }

      editor
        .chain()
        .focus()
        .setDrawingEmbed({
          src: dataUrl,
          title: title || "Drawing",
          elements,
        })
        .run();

      toast.success("Drawing inserted in note");
    } catch (err) {
      console.error("Error saving drawing:", err);
      toast.error("Error saving drawing");
    } finally {
      setEditingDrawingData(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Logout failed");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete your account? All your data (notes, labels, and files) will be permanently deleted. This action cannot be undone."
    );
    if (!confirmDelete) return;

    setShowUserMenu(false);
    const toastId = toast.loading("Deleting account...");
    try {
      await deleteAccount();
      toast.success("Account deleted successfully", { id: toastId });
      navigate("/login");
    } catch (error) {
      console.error("Delete account failed:", error);
      toast.error(error.message || "Failed to delete account", { id: toastId });
    }
  };

  const handleLabelSelectForNotes = async (label) => {
    if (!label || !label._id) {
      fetchRecentNotes();
      return;
    }
    setSelectedLabelForNotes(label);
    setSelectedLabel(label._id);
    setLoadingNotes(true);
    try {
      const response = await apiFetch(`/notes/by-label/${label._id}`, {
        headers: { user: user?.email },
      });
      if (!response.ok) {
        throw new Error("Error loading notes");
      }
      const data = await response.json();
      setFilteredNotes(Array.isArray(data) ? data : []);
      setCurrentView("notes-list");
    } catch (err) {
      console.error("Error loading notes:", err);
      toast.error("Error loading notes");
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleTogglePin = async (noteId, e) => {
    e.stopPropagation();
    try {
      const response = await apiFetch(`/notes/${noteId}/pin`, {
        method: "PUT",
      });
      if (!response.ok) {
        throw new Error("Error toggling pin");
      }
      const result = await response.json();
      setFilteredNotes((prevNotes) => {
        const updated = prevNotes.map((n) =>
          n._id === noteId ? { ...n, isPinned: result.isPinned } : n
        );
        return [...updated].sort((a, b) => {
          if (!!a.isPinned !== !!b.isPinned) {
            return a.isPinned ? -1 : 1;
          }
          const dateA = new Date(a.updatedAt || a.createdAt);
          const dateB = new Date(b.updatedAt || b.createdAt);
          return dateB - dateA;
        });
      });
      toast.success(result.isPinned ? "Note pinned to top" : "Note unpinned");
    } catch (err) {
      console.error("Error toggling pin:", err);
      toast.error("Error toggling pin");
    }
  };

  const handleToggleNoteProtection = async () => {
    const nextProtected = !isNoteProtected;
    setIsNoteProtected(nextProtected);

    if (!currentNoteId) {
      toast.success(
        nextProtected
          ? "Note will be protected when saved"
          : "Note protection removed"
      );
      return;
    }

    try {
      const response = await apiFetch(`/notes/${currentNoteId}/protect`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isProtected: nextProtected }),
      });

      if (!response.ok) {
        throw new Error("Error updating note protection");
      }

      const result = await response.json();
      setIsNoteProtected(result.isProtected);
      setFilteredNotes((prevNotes) =>
        prevNotes.map((n) =>
          n._id === currentNoteId ? { ...n, isProtected: result.isProtected } : n
        )
      );
      toast.success(
        result.isProtected
          ? "Note protected with login password"
          : "Note unlocked"
      );
    } catch (err) {
      setIsNoteProtected(!nextProtected);
      console.error("Error updating note protection:", err);
      toast.error("Error updating note protection");
    }
  };

  const handleNoteSelect = async (note) => {
    if (note.isProtected) {
      setNoteToUnlock(note);
      setUnlockPassword("");
      return;
    }

    setCurrentNoteId(note._id);
    setNoteTitle(note.title);
    const labelId = note.label && note.label._id ? note.label._id : note.label;
    setSelectedLabel(labelId);
    setIsNoteProtected(false);
    editor.chain().focus().setContent(note.content, true).run();
    setCurrentView("editor");
  };

  const handleUnlockNoteSubmit = async (e) => {
    e.preventDefault();
    if (!noteToUnlock || !unlockPassword) return;

    setUnlockingNote(true);
    try {
      const response = await apiFetch(`/notes/${noteToUnlock._id}/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: unlockPassword }),
      });

      if (!response.ok) {
        if (response.status === 400 || response.status === 401) {
          toast.error("Invalid password");
        } else {
          throw new Error("Error unlocking note");
        }
        return;
      }

      const fullNote = await response.json();
      setCurrentNoteId(fullNote._id);
      setNoteTitle(fullNote.title);
      const labelId = fullNote.label && fullNote.label._id ? fullNote.label._id : fullNote.label;
      setSelectedLabel(labelId);
      setIsNoteProtected(true);
      editor.chain().focus().setContent(fullNote.content, true).run();
      setNoteToUnlock(null);
      setUnlockPassword("");
      setCurrentView("editor");
    } catch (err) {
      console.error("Error unlocking note:", err);
      toast.error("Error unlocking note");
    } finally {
      setUnlockingNote(false);
    }
  };

  const handleBackToEditor = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setCurrentView("editor");
    setFilteredNotes([]);
    setSelectedLabelForNotes(null);
    setSearchQuery("");
  };

  const handleCreateNewNote = () => {
    if (selectedLabelForNotes && selectedLabelForNotes.name.toLowerCase() !== "trash") {
      setSelectedLabel(selectedLabelForNotes._id);
    }
    setNoteTitle("");
    setIsNoteProtected(false);
    setCurrentNoteId(null);
    if (editor) {
      editor.chain().focus().clearContent().run();
    }
    setCurrentView("editor");
  };

  const stripHtmlToText = (html) => {
    if (!html) return "";
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      return (tempDiv.textContent || tempDiv.innerText || "").replace(/\s+/g, " ").trim();
    } catch {
      return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
  };

  const renderHighlightedText = (text, query) => {
    if (!text) return "";
    const trimmed = (query || "").trim();
    if (!trimmed) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = trimmed.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text;

    const before = text.slice(0, index);
    const match = text.slice(index, index + trimmed.length);
    const after = text.slice(index + trimmed.length);

    return (
      <>
        {before}
        <mark className="search-highlight">{match}</mark>
        {renderHighlightedText(after, query)}
      </>
    );
  };

  const renderNoteSnippet = (content, query) => {
    const plainText = stripHtmlToText(content);
    if (!plainText) return null;

    const trimmed = (query || "").trim();
    if (!trimmed) {
      return plainText.length > 120 ? plainText.slice(0, 120) + "..." : plainText;
    }

    const lowerText = plainText.toLowerCase();
    const lowerQuery = trimmed.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) {
      return plainText.length > 120 ? plainText.slice(0, 120) + "..." : plainText;
    }

    const start = Math.max(0, matchIndex - 35);
    const end = Math.min(plainText.length, matchIndex + trimmed.length + 55);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < plainText.length ? "..." : "";

    const excerpt = plainText.slice(start, end);
    return (
      <span>
        {prefix}
        {renderHighlightedText(excerpt, trimmed)}
        {suffix}
      </span>
    );
  };

  const performSearch = async (value) => {
    const trimmed = (value || "").trim();
    if (trimmed.length >= 1) {
      setLoadingNotes(true);
      try {
        const response = await apiFetch(`/notes?search=${encodeURIComponent(trimmed)}`, {
          headers: { user: user?.email },
        });
        if (!response.ok) throw new Error("Error searching notes");
        const data = await response.json();
        setFilteredNotes(Array.isArray(data) ? data : []);
        setCurrentView("notes-list");
        setSelectedLabelForNotes({ name: `Search results for: "${trimmed}"` });
      } catch (err) {
        console.error("Search error:", err);
        toast.error("Error searching notes");
      } finally {
        setLoadingNotes(false);
      }
    } else if (trimmed === "") {
      fetchRecentNotes();
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (value.trim() === "") {
      fetchRecentNotes();
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 250);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      performSearch(searchQuery);
    }
  };

  const handleClearSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setSearchQuery("");
    fetchRecentNotes();
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleDeleteNote = async (noteId, labelName) => {
    const isTrash =
      selectedLabelForNotes?.name?.toLowerCase() === "trash" ||
      labelName?.toLowerCase() === "trash";

    if (isTrash) {
      const confirmDelete = window.confirm("Are you sure you want to permanently delete this note?");
      if (!confirmDelete) return;
    }

    try {
      const endpoint = isTrash ? `/notes/${noteId}?permanent=true` : `/notes/${noteId}`;
      const response = await apiFetch(endpoint, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Error deleting note");

      if (!isTrash) {
        toast.success(`Note moved to Trash`);
      } else {
        toast.success(`Note permanently deleted`);
      }

      setFilteredNotes((prevNotes) => prevNotes.filter((n) => n._id !== noteId));

      if (searchQuery && searchQuery.trim()) {
        performSearch(searchQuery);
      } else if (selectedLabelForNotes && selectedLabelForNotes._id) {
        handleLabelSelectForNotes(selectedLabelForNotes);
      } else {
        fetchRecentNotes();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting note");
    }
  };

  const handleRestoreNote = async (noteId) => {
    try {
      const response = await apiFetch(`/notes/${noteId}/restore`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Error restoring note");

      toast.success("Note restored successfully");
      setFilteredNotes((prevNotes) => prevNotes.filter((n) => n._id !== noteId));

      if (searchQuery && searchQuery.trim()) {
        performSearch(searchQuery);
      } else if (selectedLabelForNotes && selectedLabelForNotes._id) {
        handleLabelSelectForNotes(selectedLabelForNotes);
      } else {
        fetchRecentNotes();
      }
    } catch (err) {
      console.error("Error restoring note:", err);
      toast.error("Error restoring note");
    }
  };

  const handleEmptyTrash = async () => {
    if (!filteredNotes.length) return;
    const confirmDelete = window.confirm("Are you sure you want to permanently delete all notes in Trash?");
    if (!confirmDelete) return;

    try {
      const response = await apiFetch(`/notes/trash/empty`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Error emptying Trash");

      toast.success("Trash emptied successfully");
      if (selectedLabelForNotes) {
        handleLabelSelectForNotes(selectedLabelForNotes);
      } else {
        fetchRecentNotes();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error emptying Trash");
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      toast.error("Please insert a title for the note");
      return;
    }

    if (!selectedLabel) {
      toast.error("Please select a label");
      return;
    }

    const markdownContent = editor.storage.markdown.getMarkdown();
    if (markdownContent.trim() === "") {
      toast.error("Please insert some content");
      return;
    }

    if (!editor) return;

    setSavingNote(true);
    try {
      const url = currentNoteId
        ? `${import.meta.env.VITE_API_BASE_URL}/notes/${currentNoteId}`
        : `${import.meta.env.VITE_API_BASE_URL}/notes`;
      const bodyPayload = {
        title: noteTitle,
        content: markdownContent,
        label: selectedLabel,
        user: user?.email,
        isProtected: isNoteProtected,
      };

      const method = currentNoteId ? "PUT" : "POST";
      const response = await apiFetch(url.replace(import.meta.env.VITE_API_BASE_URL, ""), {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        throw new Error("Error saving note");
      }

      const data = await response.json().catch(() => null);
      if (!currentNoteId && data?._id) {
        setCurrentNoteId(data._id);
      }

      toast.success(currentNoteId ? "Note updated" : "Note created");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Error saving note");
    } finally {
      setSavingNote(false);
    }
  };

  const renderToolbar = (position = "top") => {
    if (!editor) return null;
    const isTextToolActive =
      showTextTools ||
      editor.isActive("bold") ||
      editor.isActive("italic") ||
      editor.isActive("heading", { level: 1 }) ||
      editor.isActive("heading", { level: 2 }) ||
      editor.isActive("heading", { level: 3 }) ||
      editor.isActive("highlight") ||
      editor.isActive("bulletList");

    const isFileToolActive = showFileTools || isRecording;

    return (
      <div className={`toolbar-wrapper toolbar-wrapper-${position}`}>
        <div className="toolbar">
          <div className="toolbar-group">
            <button
              type="button"
              title="Text and color tools"
              onClick={() => setShowTextTools(!showTextTools)}
              className={`custom-button text-tools-toggle ${isTextToolActive ? "is-active" : ""}`}
            >
              <span style={{ fontWeight: "700", fontSize: "15px", lineHeight: 1 }}>Aa</span>
            </button>
            {showTextTools && (
              <div className="text-tools-popup-inline">
                <button
                  type="button"
                  title="Bold"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`custom-button ${editor.isActive("bold") ? "is-active" : ""}`}
                >
                  B
                </button>
                <button
                  type="button"
                  title="Italic"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`custom-button ${editor.isActive("italic") ? "is-active" : ""}`}
                >
                  I
                </button>
                <button
                  type="button"
                  title="Heading 1"
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                  className={`custom-button ${editor.isActive("heading", { level: 1 }) ? "is-active" : ""}`}
                >
                  H1
                </button>
                <button
                  type="button"
                  title="Heading 2"
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                  className={`custom-button ${editor.isActive("heading", { level: 2 }) ? "is-active" : ""}`}
                >
                  H2
                </button>
                <button
                  type="button"
                  title="Heading 3"
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                  }
                  className={`custom-button ${editor.isActive("heading", { level: 3 }) ? "is-active" : ""}`}
                >
                  H3
                </button>
                <button
                  type="button"
                  className="custom-button"
                  title="Text color"
                  onClick={handleColorPickerInputRef}
                >
                  <input
                    ref={position === "top" ? colorPickerInputRef : undefined}
                    type="color"
                    onInput={(event) =>
                      editor.chain().focus().setColor(event.target.value).run()
                    }
                    value={editor.getAttributes("textStyle").color || "#000000"}
                    title="Text Color"
                  />
                </button>
                <button
                  type="button"
                  title="Mark"
                  onClick={() => editor.chain().focus().toggleHighlight().run()}
                  className={`custom-button ${editor.isActive("highlight") ? "is-active" : ""}`}
                >
                  <Highlighter size={16} />
                </button>
                <button
                  type="button"
                  title="Bullet List"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`custom-button ${editor.isActive("bulletList") ? "is-active" : ""}`}
                >
                  (•)
                </button>
                <button
                  type="button"
                  className="custom-button"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("left").run()
                  }
                  title="Align to Left"
                >
                  <AlignLeft size={16} />
                </button>
                <button
                  type="button"
                  className="custom-button"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("center").run()
                  }
                  title="Align to Center"
                >
                  <AlignCenter size={16} />
                </button>
                <button
                  type="button"
                  className="custom-button"
                  onClick={() =>
                    editor.chain().focus().setTextAlign("right").run()
                  }
                  title="Align to Right"
                >
                  <AlignRight size={16} />
                </button>
              </div>
            )}
            <button
              type="button"
              title="Files and attachments (Images, PDF, Audio)"
              onClick={() => setShowFileTools(!showFileTools)}
              className={`custom-button file-tools-toggle ${isFileToolActive ? "is-active" : ""}`}
            >
              <FileIcon size={16} />
            </button>
            {(showFileTools || isRecording) && (
              <div className="text-tools-popup-inline">
                <button
                  type="button"
                  title="Upload Image"
                  className="custom-button"
                  onClick={handleUploadImageFileInputRef}
                >
                  <ImagePlus size={16} />
                </button>
                <button
                  type="button"
                  title="Upload PDF"
                  className="custom-button"
                  onClick={handleUploadPdfFileInputRef}
                >
                  <FileText size={16} />
                </button>
                {!isRecording ? (
                  <button
                    type="button"
                    title="Record Voice Note"
                    className="custom-button"
                    onClick={startRecording}
                  >
                    <Mic size={16} />
                  </button>
                ) : (
                  <div className="recording-bar" title="Recording voice note">
                    <div className="recording-dot"></div>
                    <span className="recording-time">{formatRecordingTime(recordingDuration)}</span>
                    <button
                      type="button"
                      onClick={stopAndSaveRecording}
                      className="recording-action-btn recording-stop-btn"
                      title="Save voice note"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="recording-action-btn recording-cancel-btn"
                      title="Cancel recording"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              title="Task List"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`custom-button ${editor.isActive("taskList") ? "is-active" : ""}`}
            >
              <CheckSquare size={16} />
            </button>
            <button
              type="button"
              title="Code Block"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`custom-button ${editor.isActive("codeBlock") ? "is-active" : ""}`}
            >
              {"</>"}
            </button>
            <button
              type="button"
              className={`custom-button ${showTableMenu ? "is-active" : ""}`}
              onClick={() => setShowTableMenu(true)}
              title="Insert Table"
            >
              <Table2 size={16} />
            </button>
            <button
              type="button"
              className="custom-button"
              onClick={handleOpenNewDrawing}
              title="Draw"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="custom-button"
              title="Open Markdown"
              onClick={handleOpenMarkdownFileInputRef}
            >
              <FolderOpen size={16} /> .md
            </button>
            <button
              type="button"
              className="custom-button"
              onClick={() => setShowExportModal(true)}
              title="Export note"
            >
              <FileDown size={16} />
            </button>
            {position === "bottom" && (
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote || !noteTitle.trim() || !selectedLabel}
                className="custom-button bottom-toolbar-save-btn"
                title="Save Note"
              >
                {savingNote ? "Saving..." : <><Check size={14} /> Save</>}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`App-wrapper ${isKeyboardOpen ? "keyboard-open" : ""}`}>
      <header className="main-header">
        <div className="header-content">
          <div className="header-left">
            <HamburgerMenu
              onLabelSelect={handleLabelSelectForNotes}
              selectedLabelId={selectedLabel}
              labels={labels}
              onLabelsChange={fetchLabels}
            />
            {currentView === "editor" && (
              <button
                type="button"
                onClick={fetchRecentNotes}
                className="header-back-to-notes-btn"
                title="Back to notes list"
              >
                <ArrowLeft size={16} />
                <span>Notes</span>
              </button>
            )}
            {currentView === "notes-list" && (
              <div className="search-input-wrapper">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={handleSearch}
                  onKeyDown={handleSearchKeyDown}
                  className="search-input-header"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={handleClearSearch}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="user-profile-container" ref={userMenuRef}>
            <button
              className="user-profile-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <User size={18} />
              <ChevronDown size={14} />
            </button>

            {showUserMenu && (
              <div className="user-dropdown-menu">
                <div
                  className="dropdown-user-btn"
                  title={user?.name || user?.email || "User"}
                >
                  <User size={14} />
                  <span>{user?.name || user?.email || "User"}</span>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="dropdown-logout-btn"
                  style={{ marginBottom: "6px", color: "#ff6b6b" }}
                >
                  <Trash2 size={14} />
                  <span>Delete account</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="dropdown-logout-btn"
                >
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="editor-container">
        {currentView === "editor" ? (
          <>
            <div className="note-metadata">
              <div className="metadata-group">
                <input
                  type="text"
                  placeholder="Note title..."
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  onFocus={(e) => {
                    if (window.innerWidth <= 768) {
                      setTimeout(() => {
                        e.target.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 250);
                    }
                  }}
                  className="note-title-input"
                />
                <button
                  type="button"
                  onClick={handleToggleNoteProtection}
                  className={`note-lock-toggle-btn ${isNoteProtected ? "is-protected" : ""}`}
                  title={isNoteProtected ? "Protected with login password (click to unlock)" : "Protect note with login password"}
                  aria-label={isNoteProtected ? "Protected note" : "Unprotected note"}
                >
                  {isNoteProtected ? <Lock size={16} /> : <LockOpen size={16} />}
                </button>
                <select
                  value={selectedLabel}
                  onChange={(e) => {
                    if (e.target.value === "__create_label__") {
                      setShowCreateLabelModal(true);
                    } else {
                      setSelectedLabel(e.target.value);
                    }
                  }}
                  className="note-label-select"
                >
                  <option value="">Select a label...</option>
                  {labels.filter((label) => label.name.toLowerCase() !== "trash").length === 0 && (
                    <option value="__create_label__">Create label</option>
                  )}
                  {labels
                    .filter((label) => label.name.toLowerCase() !== "trash")
                    .map((label) => (
                      <option key={label._id} value={label._id}>
                        {label.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteTitle.trim() || !selectedLabel}
                  className="save-note-btn is-active"
                  title="Save"
                >
                  {savingNote ? "Saving..." : <><Check size={14} /> Save</>}
                </button>
              </div>
            </div>
            <input
              type="file"
              ref={uploadImageFileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
            <input
              type="file"
              ref={uploadPdfFileInputRef}
              accept="application/pdf,.pdf"
              onChange={handlePdfUpload}
              style={{ display: "none" }}
            />
            <input
              type="file"
              ref={openMarkdownFileInputRef}
              accept=".md"
              onChange={openMarkdown}
              style={{ display: "none" }}
            />

            {renderToolbar("top")}

            <div
              className="editor-content"
              onClick={() => editor?.commands.focus()}
            >
              <EditorContent editor={editor} />
            </div>

            {renderToolbar("bottom")}

            {showTableMenu && (
              <div className="table-modal-overlay" onClick={() => setShowTableMenu(false)}>
                <div className="table-modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="table-modal-header">
                    <h3>Table Menu</h3>
                    <button className="table-modal-close" onClick={() => setShowTableMenu(false)}>
                      <X size={16} color="#ffffff" />
                    </button>
                  </div>
                  <div className="table-modal-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Rows:</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={tableRows}
                          onChange={(e) => setTableRows(e.target.value)}
                          style={{ width: '70px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'center', backgroundColor: '#ffffff', color: '#000000' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Columns:</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={tableCols}
                          onChange={(e) => setTableCols(e.target.value)}
                          style={{ width: '70px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', textAlign: 'center', backgroundColor: '#ffffff', color: '#000000' }}
                        />
                      </div>
                      <button
                        onClick={addTable}
                        className="custom-button"
                        style={{ marginTop: '4px', width: '100%', justifyContent: 'center', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '25px', padding: '8px', fontWeight: '600' }}
                      >
                        <Plus size={14} /> Insert Table
                      </button>
                    </div>

                    {editor.isActive("table") && (
                      <>
                        <button
                          className="delete-text custom-button"
                          onClick={() => {
                            editor.chain().focus().deleteTable().run();
                            setShowTableMenu(false);
                          }}
                        >
                          <Table2 size={14} /> Delete Table
                        </button>
                        <div className="dropdown-divider"></div>
                        <div className="table-modal-row">
                          <button
                            className="custom-button"
                            onClick={() =>
                              editor.chain().focus().addColumnAfter().run()
                            }
                          >
                            <Plus size={14} /> Column
                          </button>
                          <button
                            className="delete-text custom-button"
                            onClick={() =>
                              editor.chain().focus().deleteColumn().run()
                            }
                          >
                            <X size={14} /> Column
                          </button>
                        </div>
                        <div className="table-modal-row">
                          <button
                            className="custom-button"
                            onClick={() =>
                              editor.chain().focus().addRowAfter().run()
                            }
                          >
                            <Plus size={14} /> Row
                          </button>
                          <button
                            className="delete-text custom-button"
                            onClick={() =>
                              editor.chain().focus().deleteRow().run()
                            }
                          >
                            <X size={14} /> Row
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            {showExportModal && (
              <div className="table-modal-overlay" onClick={() => { setShowExportModal(false); setShowPdfDropdown(false); }}>
                <div className="table-modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="table-modal-header">
                    <h3>Export Note</h3>
                    <button className="table-modal-close" onClick={() => { setShowExportModal(false); setShowPdfDropdown(false); }}>
                      <X size={16} color="#ffffff" />
                    </button>
                  </div>
                  <div className="table-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ color: '#555', fontSize: '14px', marginBottom: '8px' }}>Choose your preferred export format:</p>
                    <button
                      className="custom-button"
                      onClick={() => { exportAsMarkdown(); setShowExportModal(false); setShowPdfDropdown(false); }}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <FileDown size={14} /> Export Markdown
                    </button>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <button
                        type="button"
                        className="custom-button"
                        onClick={() => setShowPdfDropdown((prev) => !prev)}
                        style={{
                          width: '100%',
                          justifyContent: 'space-between',
                          padding: '0.65rem 1rem',
                          borderRadius: '25px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} />
                          <span>Export PDF</span>
                        </div>
                        <ChevronDown
                          size={16}
                          style={{
                            transform: showPdfDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      </button>

                      {showPdfDropdown && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '16px',
                            marginTop: '6px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              exportAsPDF('portrait');
                              setShowPdfDropdown(false);
                              setShowExportModal(false);
                            }}
                            className="custom-button"
                            style={{
                              width: '100%',
                              justifyContent: 'flex-start',
                              padding: '0.65rem 1.2rem',
                              border: 'none',
                              borderRadius: 0,
                              borderBottom: '1px solid #f1f5f9',
                              gap: '8px',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: '#1e293b',
                            }}
                          >
                            <span>Portrait (Vertical)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              exportAsPDF('landscape');
                              setShowPdfDropdown(false);
                              setShowExportModal(false);
                            }}
                            className="custom-button"
                            style={{
                              width: '100%',
                              justifyContent: 'flex-start',
                              padding: '0.65rem 1.2rem',
                              border: 'none',
                              borderRadius: 0,
                              gap: '8px',
                              fontSize: '13px',
                              fontWeight: 500,
                              color: '#1e293b',
                            }}
                          >
                            <span>Landscape (Horizontal)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showCreateLabelModal && (
              <div className="table-modal-overlay" onClick={() => setShowCreateLabelModal(false)}>
                <div className="table-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                  <div className="table-modal-header">
                    <h3>Create label</h3>
                    <button className="table-modal-close" onClick={() => setShowCreateLabelModal(false)}>
                      <X size={16} color="#ffffff" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateLabelFromModal}>
                    <div className="table-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>
                        Enter a name for the new label:
                      </p>
                      <input
                        type="text"
                        placeholder="Label name..."
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        className="note-title-input"
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          color: '#000000',
                          backgroundColor: '#ffffff',
                          border: '1px solid #94a3b8'
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                        <button
                          type="button"
                          className="custom-button"
                          onClick={() => setShowCreateLabelModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isCreatingLabel || !newLabelName.trim()}
                          className="save-note-btn"
                          style={{ padding: '0.5rem 1.2rem' }}
                        >
                          {isCreatingLabel ? "Creating..." : "Create"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="notes-list-view">
            <div className="notes-list-header">
              <h2>{selectedLabelForNotes ? selectedLabelForNotes.name : "Notes"}</h2>
              {selectedLabelForNotes?.name?.toLowerCase() === "trash" &&
                filteredNotes.length > 0 && (
                  <button
                    className="empty-trash-btn"
                    onClick={handleEmptyTrash}
                  >
                    <Trash2 size={16} />
                    <span>Empty Trash</span>
                  </button>
                )}
            </div>
            {loadingNotes && <p className="loading">Loading notes...</p>}
            {!loadingNotes && filteredNotes.length === 0 && (
              selectedLabelForNotes?.name?.toLowerCase() === "trash" ? (
                <p className="empty">Empty Trash</p>
              ) : (
                <p className="empty">No notes found</p>
              )
            )}
            {!loadingNotes && filteredNotes.length > 0 && (
              (() => {
                const isTrash = selectedLabelForNotes?.name?.toLowerCase() === "trash";
                const pinnedNotes = !isTrash ? filteredNotes.filter((n) => n.isPinned) : [];
                const otherNotes = !isTrash ? filteredNotes.filter((n) => !n.isPinned) : filteredNotes;

                const renderNoteCard = (note) => (
                  <div
                    key={note._id}
                    className={`note-card ${note.isPinned ? "is-pinned" : ""}`}
                  >
                    <div className="note-card-top-bar">
                      {!isTrash && (
                        <button
                          type="button"
                          className={`pin-note-btn ${note.isPinned ? "pinned" : ""}`}
                          onClick={(e) => handleTogglePin(note._id, e)}
                          title={note.isPinned ? "Unpin note" : "Pin note to top"}
                        >
                          <Pin size={16} />
                        </button>
                      )}
                      {isTrash ? (
                        <>
                          <button
                            type="button"
                            className="restore-note-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreNote(note._id);
                            }}
                            title="Restore note"
                          >
                            <RotateCcw size={14} />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            className="permanent-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNote(note._id, note.label?.name || "Trash");
                            }}
                            title="Delete permanently"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="delete-note-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note._id, note.label?.name);
                          }}
                          title="Move to Trash"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="note-header" onClick={() => handleNoteSelect(note)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
                        <h3 className="note-title" style={{ margin: 0 }}>
                          {renderHighlightedText(note.title, searchQuery)}
                        </h3>
                        {note.isProtected && (
                          <span className="note-protected-badge" title="Password protected note">
                            <Lock size={14} className="lock-icon" />
                          </span>
                        )}
                      </div>
                      {note.content && (
                        <p className="note-card-snippet">
                          {renderNoteSnippet(note.content, searchQuery)}
                        </p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        {note.label?.name && (
                          <span className="note-label-badge">{note.label.name}</span>
                        )}
                        <p className="note-date">
                          {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );

                if (pinnedNotes.length > 0 && otherNotes.length > 0) {
                  return (
                    <>
                      <div className="notes-section-header">
                        <Pin size={14} /> Pinned ({pinnedNotes.length})
                      </div>
                      <div className="notes-grid">
                        {pinnedNotes.map(renderNoteCard)}
                      </div>
                      <div className="notes-section-header" style={{ marginTop: '24px' }}>
                        Others
                      </div>
                      <div className="notes-grid">
                        {otherNotes.map(renderNoteCard)}
                      </div>
                    </>
                  );
                }

                return (
                  <div className="notes-grid">
                    {filteredNotes.map(renderNoteCard)}
                  </div>
                );
              })()
            )}
            <FloatingButton onClick={handleCreateNewNote} />
            {noteToUnlock && (
              <div className="table-modal-overlay" onClick={() => { setNoteToUnlock(null); setUnlockPassword(""); }}>
                <div className="table-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                  <div className="table-modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lock size={18} /> Protected Note
                    </h3>
                    <button className="table-modal-close" onClick={() => { setNoteToUnlock(null); setUnlockPassword(""); }}>
                      <X size={16} color="#ffffff" />
                    </button>
                  </div>
                  <form onSubmit={handleUnlockNoteSubmit}>
                    <div className="table-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <p style={{ color: '#cbd5e1', fontSize: '13.5px', margin: 0 }}>
                        Enter your login password to unlock <strong>"{noteToUnlock.title}"</strong>:
                      </p>
                      <input
                        type="password"
                        placeholder="Login password..."
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        className="note-title-input"
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          color: '#000000',
                          backgroundColor: '#ffffff',
                          border: '1px solid #94a3b8'
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                        <button
                          type="button"
                          className="custom-button"
                          onClick={() => { setNoteToUnlock(null); setUnlockPassword(""); }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={unlockingNote || !unlockPassword}
                          className="save-note-btn is-active"
                          style={{ padding: '0.5rem 1.2rem' }}
                        >
                          {unlockingNote ? "Unlocking..." : "Unlock"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <DrawingModal
        key={isDrawingModalOpen ? (editingDrawingData ? `edit-${editingDrawingData.title || ''}-${editingDrawingData.elements?.length || 0}` : 'new-drawing') : 'closed'}
        isOpen={isDrawingModalOpen}
        onClose={() => {
          setIsDrawingModalOpen(false);
          setEditingDrawingData(null);
        }}
        onSave={handleSaveDrawing}
        initialElements={editingDrawingData?.elements || []}
        initialTitle={editingDrawingData?.title || "Drawing"}
      />
    </div>
  );
};

export default Editor;
