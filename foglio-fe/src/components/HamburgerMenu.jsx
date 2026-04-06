import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { Pencil, Trash2, Menu, Check, X, FileText } from "lucide-react";
import toast from "react-hot-toast";
import "./HamburgerMenu.css";

const HamburgerMenu = ({ onLabelSelect, selectedLabelId, labels, onLabelsChange }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelName, setEditingLabelName] = useState("");
  const [deletingLabelId, setDeletingLabelId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && labels.length === 0) {
      onLabelsChange();
    }
  }, [isOpen]);

  const handleCreateLabel = async (e) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;

    setCreatingLabel(true);
    try {
      const response = await apiFetch(`/labels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newLabelName, user: user?.email }),
      });

      if (!response.ok) {
        throw new Error("Error creating label");
      }

      setNewLabelName("");
      if (onLabelsChange) onLabelsChange();
    } catch (err) {
      setError(err.message);
      console.error("Error:", err);
      toast.error(err.message || "Error creating label");
    } finally {
      setCreatingLabel(false);
    }
  };

  const handleSelectLabel = (label) => {
    console.log("Label selected:", label);
    if (onLabelSelect) {
      onLabelSelect(label);
    }
    setIsOpen(false);
  };

  const handleDeleteLabel = async (labelId, e) => {
    e.stopPropagation();

    setDeletingLabelId(labelId);
    try {
      const response = await apiFetch(`/labels/${labelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error deleting label");
      }

      if (onLabelsChange) onLabelsChange();
    } catch (err) {
      setError(err.message);
      console.error("Error:", err);
      toast.error(err.message || "Error deleting label");
    } finally {
      setDeletingLabelId(null);
    }
  };

  const handleEditLabel = (label, e) => {
    e.stopPropagation();
    setEditingLabelId(label._id);
    setEditingLabelName(label.name);
  };

  const handleUpdateLabel = async (labelId, e) => {
    e.preventDefault();
    if (!editingLabelName.trim()) return;

    try {
      const response = await apiFetch(`/labels/${labelId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: editingLabelName }),
      });

      if (!response.ok) {
        throw new Error("Error updating label");
      }

      setEditingLabelId(null);
      if (onLabelsChange) onLabelsChange();
    } catch (err) {
      setError(err.message);
      console.error("Error:", err);
      toast.error(err.message || "Error updating label");
    }
  };

  return (
    <div className="hamburger-menu" ref={menuRef}>
      <button
        className="hamburger-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Menu"
      >
        <Menu size={20} />
      </button>

      {isOpen && (
        <div className="menu-dropdown">
          <form onSubmit={handleCreateLabel} className="create-label-form">
            <input
              type="text"
              placeholder="Create a new label..."
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              disabled={creatingLabel}
              className="label-input"
            />
            <button type="submit" disabled={creatingLabel || !newLabelName.trim()} className="create-label-btn">
              <Check size={16} />
            </button>
          </form>
          {loading &&
            <div className="bouncing-dots">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          }
          {error && <p className="error">Error: {error}</p>}
          {!loading && !error && labels.length === 0 && (
            <p className="empty">No labels found</p>
          )}
          {!loading && !error && (
            <ul className="labels-list">
              <li className={`label-item ${!selectedLabelId ? "active" : ""}`}>
                <span
                  className="label-name"
                  onClick={() => handleSelectLabel(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                >
                  <FileText size={16} /> All Notes
                </span>
              </li>
              <li className="label-divider"></li>
              {(() => {
                const otherLabels = labels.filter((l) => l.name.toLowerCase() !== "trash");
                const trashLabel = labels.find((l) => l.name.toLowerCase() === "trash");

                const renderLabel = (label, isTrash = false) => (
                  <li key={label._id} className={`label-item ${selectedLabelId === label._id ? "active" : ""}`}>
                    {editingLabelId === label._id ? (
                      <form onSubmit={(e) => handleUpdateLabel(label._id, e)} className="edit-label-form">
                        <input
                          type="text"
                          value={editingLabelName}
                          onChange={(e) => setEditingLabelName(e.target.value)}
                          className="edit-label-input"
                          autoFocus
                        />
                        <button type="submit" className="save-btn"><Check size={16} /></button>
                        <button
                          type="button"
                          className="cancel-btn"
                          onClick={() => setEditingLabelId(null)}
                        >
                          <X size={16} />
                        </button>
                      </form>
                    ) : (
                      <>
                        <span
                          className="label-name"
                          onClick={() => handleSelectLabel(label)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          {isTrash && <Trash2 size={16} />}
                          {label.name}
                        </span>
                        {!isTrash && (
                          <div className="label-actions">
                            <button
                              className="edit-btn"
                              onClick={(e) => handleEditLabel(label, e)}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="delete-btn"
                              onClick={(e) => handleDeleteLabel(label._id, e)}
                              disabled={deletingLabelId === label._id}
                              title="Delete"
                            >
                              {deletingLabelId === label._id ? "..." : <Trash2 size={14} />}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );

                return (
                  <>
                    {otherLabels.map((l) => renderLabel(l, false))}
                    {trashLabel && (
                      <>
                        <li className="label-divider"></li>
                        {renderLabel(trashLabel, true)}
                      </>
                    )}
                  </>
                );
              })()}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default HamburgerMenu;
