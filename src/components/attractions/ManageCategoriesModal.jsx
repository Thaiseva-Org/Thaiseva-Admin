import { useState } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from "@mui/material";
import { CloseIcon, DeleteIcon, EditIcon } from "@icons";
import {
  deleteAttractionCategory,
  saveAttractionCategory,
} from "../../services/attractionsService";

const PRESET_COLORS = [
  { label: "Blue", value: "#2563EB" },
  { label: "Purple", value: "#7C3AED" },
  { label: "Amber", value: "#D97706" },
  { label: "Emerald", value: "#059669" },
  { label: "Rose", value: "#E11D48" },
  { label: "Cyan", value: "#0891B2" },
  { label: "Indigo", value: "#4F46E5" },
  { label: "Orange", value: "#EA580C" },
];

const PRESET_EMOJIS = [
  "🛍️", "🍸", "🛕", "🍢", "🌴", "🎡", 
  "🌊", "🍹", "🏛️", "🧘", "🚤", "🐘",
  "🍱", "🎉", "🏨", "🚢"
];

export default function ManageCategoriesModal({
  open,
  onClose,
  categories = [],
  onCategoriesChanged,
}) {
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({
    name: "",
    emoji: "🛍️",
    badgeColor: "#2563EB",
    description: "",
    order: categories.length + 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setEditingCategory(null);
    setForm({
      name: "",
      emoji: "🛍️",
      badgeColor: "#2563EB",
      description: "",
      order: categories.length + 1,
    });
    setError("");
  };

  const handleStartEdit = (cat) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name || "",
      emoji: cat.emoji || "📍",
      badgeColor: cat.badgeColor || "#2563EB",
      description: cat.description || "",
      order: cat.order || 1,
    });
    setError("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Category name is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await saveAttractionCategory(
        {
          name: form.name.trim(),
          emoji: form.emoji,
          badgeColor: form.badgeColor,
          description: form.description,
          order: Number(form.order) || 1,
        },
        editingCategory ? editingCategory.id : null
      );
      resetForm();
      if (onCategoriesChanged) {
        await onCategoriesChanged();
      }
    } catch (err) {
      console.error("Error saving category:", err);
      setError(err.message || "Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cat) => {
    if (
      !window.confirm(
        `Are you sure you want to delete category "${cat.name}"? If any places use this category, you must reassign them first.`
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      await deleteAttractionCategory(cat.id);
      if (editingCategory?.id === cat.id) {
        resetForm();
      }
      if (onCategoriesChanged) {
        await onCategoriesChanged();
      }
    } catch (err) {
      alert(err.message || "Failed to delete category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        },
      }}
    >
      {/* Header with Dark Accent Gradient */}
      <DialogTitle
        sx={{
          p: 0,
          background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
          color: "white",
        }}
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl shadow-md shadow-purple-500/20 text-white">
              ⚙️
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Manage Categories
              </h2>
              <p className="text-xs text-slate-300 font-normal mt-0.5">
                Configure dynamic categories, tags, and theme labels for GoThai Prime Locations.
              </p>
            </div>
          </div>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: "rgba(255, 255, 255, 0.7)",
              "&:hover": { color: "white", backgroundColor: "rgba(255, 255, 255, 0.1)" },
            }}
          >
            <CloseIcon />
          </IconButton>
        </div>
      </DialogTitle>

      <DialogContent
        sx={{
          p: { xs: 2.5, md: 3.5 },
          backgroundColor: "#F8FAFC",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Column: Categories List */}
          <div className="md:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>📑</span> Active Categories ({categories.length})
              </span>
              {editingCategory && (
                <button
                  onClick={resetForm}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer transition"
                >
                  + Add New
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {categories.map((cat) => {
                const isSelected = editingCategory?.id === cat.id;
                return (
                  <div
                    key={cat.id}
                    className={`p-3.5 rounded-xl border transition flex items-center justify-between group ${
                      isSelected
                        ? "bg-blue-50/60 border-blue-500 shadow-sm"
                        : "bg-white border-slate-200/80 hover:border-slate-300 shadow-xs"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-xs"
                        style={{
                          backgroundColor: `${cat.badgeColor || "#2563EB"}15`,
                          border: `1.5px solid ${cat.badgeColor || "#2563EB"}30`,
                        }}
                      >
                        {cat.emoji || "📍"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-slate-800 truncate">
                            {cat.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                            #{cat.order || 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate max-w-[190px] mt-0.5">
                          {cat.description || "No description provided"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <Tooltip title="Edit Category">
                        <IconButton
                          size="small"
                          onClick={() => handleStartEdit(cat)}
                          sx={{ color: isSelected ? "#2563EB" : "#64748B" }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Category">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(cat)}
                          disabled={loading}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Add / Edit Form */}
          <div className="md:col-span-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{editingCategory ? "✏️" : "✨"}</span>
                  <span>{editingCategory ? `Edit: ${editingCategory.name}` : "Create New Category"}</span>
                </span>
                {editingCategory && (
                  <button
                    onClick={resetForm}
                    className="text-[11px] text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Temples & Culture, Rooftop Bars..."
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>

                {/* Emoji Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Icon Emoji: <span className="text-base ml-1">{form.emoji}</span>
                  </label>
                  <div className="grid grid-cols-8 gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {PRESET_EMOJIS.map((em) => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => setForm({ ...form, emoji: em })}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition cursor-pointer ${
                          form.emoji === em
                            ? "bg-white shadow-md border-2 border-blue-500 scale-110"
                            : "hover:bg-white/80"
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme Color Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Badge Color Theme
                  </label>
                  <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
                    {PRESET_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c.value}
                        onClick={() => setForm({ ...form, badgeColor: c.value })}
                        title={c.label}
                        className={`w-7 h-7 rounded-full shrink-0 transition cursor-pointer ${
                          form.badgeColor === c.value
                            ? "ring-3 ring-blue-500 ring-offset-2 scale-110"
                            : "hover:opacity-80"
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Order <span className="text-slate-400 font-normal">(Position in category tabs)</span>
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short summary for tourists discovering this category..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={loading}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !form.name.trim()}
                    className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition cursor-pointer ${
                      loading || !form.name.trim()
                        ? "bg-slate-400 cursor-not-allowed opacity-60"
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25 active:scale-98"
                    }`}
                  >
                    {loading ? "Saving..." : editingCategory ? "Update Category" : "Add Category"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3.5,
          py: 2,
          backgroundColor: "white",
          borderTop: "1px solid #E2E8F0",
        }}
      >
        <button
          onClick={onClose}
          className="px-5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          Close
        </button>
      </DialogActions>
    </Dialog>
  );
}
