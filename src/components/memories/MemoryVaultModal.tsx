"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  X,
  Calendar,
  User,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Image as ImageIcon,
  Plus,
  ArrowLeft,
  Upload,
  Link as LinkIcon,
  Globe,
  Lock,
  CheckCircle2,
  Loader2,
  LogIn,
  UserPlus,
  LogOut,
  Eye,
  EyeOff,
  Search,
  Folder,
  FolderPlus,
  Edit2,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  ChevronDown,
} from "lucide-react";
import { getEvergreenTarget } from "@/lib/dateUtils";
import { authClient } from "@/lib/authClient";
import { playLanternReleaseSound } from "@/lib/soundEngine";

export interface MemoryItem {
  _id: string;
  title: string;
  story: string;
  imageUrl: string;
  year: number;
  visibility?: "public" | "private";
  authorName: string;
  userId?: string;
  collectionId?: string | null;
  createdAt?: string;
}

export interface CollectionItem {
  _id: string;
  name: string;
  userId: string;
  createdAt?: string;
}

interface MemoryVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

export default function MemoryVaultModal({ isOpen, onClose }: MemoryVaultModalProps) {
  // Views: "library" | "create" | "edit"
  const [view, setView] = useState<"library" | "create" | "edit">("library");
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");

  // Authentication state
  const { data: session, isPending: isSessionLoading, refetch: refetchSession } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const currentUserRole = (session?.user as { role?: string } | undefined)?.role;

  // Auth gate state
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Memories & Pagination
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalMemories, setTotalMemories] = useState(0);

  // Search & Filtering
  const target = getEvergreenTarget();
  const currentTargetYear = target.targetYear;
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedCollection, setSelectedCollection] = useState<string>("all"); // "all" | "uncategorized" | collectionId

  // Collections state
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);

  // Delete Confirmation state
  const [memoryToDelete, setMemoryToDelete] = useState<MemoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create / Edit Form state
  const [memoryToEdit, setMemoryToEdit] = useState<MemoryItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formStory, setFormStory] = useState("");
  const [formYear, setFormYear] = useState(currentTargetYear);
  const [formVisibility, setFormVisibility] = useState<"public" | "private">("public");
  const [formCollectionId, setFormCollectionId] = useState<string>("");
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [directImageUrl, setDirectImageUrl] = useState("");
  const [selectedFileBase64, setSelectedFileBase64] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch collections when user is logged in
  const fetchCollections = useCallback(async () => {
    if (!currentUserId) {
      setCollections([]);
      return;
    }
    try {
      setIsCollectionsLoading(true);
      const res = await fetch(`${SERVER_URL}/api/collections`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCollections(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load collections:", err);
    } finally {
      setIsCollectionsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen && currentUserId) {
      fetchCollections();
    }
  }, [isOpen, currentUserId, fetchCollections]);

  // Fetch memories with pagination, search, and filtering
  const fetchMemories = useCallback(
    async (targetPage = 1, append = false) => {
      try {
        if (targetPage === 1) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }
        setError(null);

        const params = new URLSearchParams();
        if (selectedYear !== "all") {
          params.append("year", String(selectedYear));
        }
        if (debouncedSearch.trim()) {
          params.append("search", debouncedSearch.trim());
        }
        if (selectedCollection !== "all") {
          params.append("collectionId", selectedCollection);
        }
        params.append("page", String(targetPage));
        params.append("limit", "12");

        const res = await fetch(`${SERVER_URL}/api/memories?${params.toString()}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Failed to load memories (${res.status} ${res.statusText})`);
        }

        const data = await res.json();
        const items: MemoryItem[] = Array.isArray(data) ? data : data.memories || [];
        const moreAvailable = typeof data.hasMore === "boolean" ? data.hasMore : false;
        const total = typeof data.total === "number" ? data.total : items.length;

        if (append) {
          setMemories((prev) => [...prev, ...items]);
        } else {
          setMemories(items);
        }

        setHasMore(moreAvailable);
        setTotalMemories(total);
        setPage(targetPage);
      } catch (err) {
        console.error("Error fetching memories:", err);
        setError(err instanceof Error ? err.message : "Unable to reach the Memory Vault.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [selectedYear, debouncedSearch, selectedCollection]
  );

  useEffect(() => {
    if (isOpen) {
      fetchMemories(1, false);
    } else {
      setSelectedMemory(null);
      setView("library");
      setSearchQuery("");
      setDebouncedSearch("");
      setSelectedCollection("all");
    }
  }, [isOpen, selectedYear, debouncedSearch, selectedCollection, fetchMemories]);

  // Handle Load More
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchMemories(page + 1, true);
    }
  };

  // Reset Create / Edit Form
  const resetForm = () => {
    setFormTitle("");
    setFormStory("");
    setFormYear(currentTargetYear);
    setFormVisibility("public");
    setFormCollectionId("");
    setImageMode("upload");
    setDirectImageUrl("");
    setSelectedFileBase64(null);
    setSelectedFileName(null);
    setFormError(null);
    setFormSuccess(null);
    setIsFormSubmitting(false);
    setMemoryToEdit(null);
  };

  // Open Edit Form for an owned memory
  const handleStartEdit = (memory: MemoryItem) => {
    setMemoryToEdit(memory);
    setFormTitle(memory.title);
    setFormStory(memory.story);
    setFormYear(memory.year);
    setFormVisibility(memory.visibility || "public");
    setFormCollectionId(memory.collectionId || "");
    setImageMode("url");
    setDirectImageUrl(memory.imageUrl);
    setSelectedFileBase64(null);
    setSelectedFileName(null);
    setFormError(null);
    setFormSuccess(null);
    setSelectedMemory(null);
    setView("edit");
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Please select an image file (PNG, JPG, WebP, etc.).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError("Selected file is larger than 10MB. Please choose a smaller image.");
      return;
    }

    setFormError(null);
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFileBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle Create or Edit Submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formTitle.trim()) {
      setFormError("Please enter a memory title.");
      return;
    }
    if (!formStory.trim()) {
      setFormError("Please write a story or reflection.");
      return;
    }
    if (!formYear || isNaN(Number(formYear))) {
      setFormError("Please provide a valid year.");
      return;
    }

    let finalImageUrl = directImageUrl.trim();

    try {
      setIsFormSubmitting(true);

      // Upload image from device if selected
      if (imageMode === "upload") {
        if (!selectedFileBase64 && !memoryToEdit?.imageUrl) {
          setFormError("Please select an image to upload.");
          setIsFormSubmitting(false);
          return;
        }

        if (selectedFileBase64) {
          const uploadRes = await fetch(`${SERVER_URL}/api/memories/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ image: selectedFileBase64 }),
          });

          if (!uploadRes.ok) {
            const uploadErr = await uploadRes.json().catch(() => null);
            throw new Error(uploadErr?.message || "Failed to upload image from device.");
          }

          const uploadData = await uploadRes.json();
          finalImageUrl = uploadData.display_url || uploadData.url;
        } else if (memoryToEdit?.imageUrl) {
          finalImageUrl = memoryToEdit.imageUrl;
        }
      } else {
        if (!finalImageUrl) {
          setFormError("Please provide a valid image URL.");
          setIsFormSubmitting(false);
          return;
        }
      }

      const payload = {
        title: formTitle.trim(),
        story: formStory.trim(),
        imageUrl: finalImageUrl,
        year: Number(formYear),
        visibility: formVisibility,
        collectionId: formCollectionId ? formCollectionId : null,
      };

      if (view === "edit" && memoryToEdit) {
        // PATCH /api/memories/:id
        const res = await fetch(`${SERVER_URL}/api/memories/${memoryToEdit._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || "Failed to update memory.");
        }

        const updated: MemoryItem = await res.json();
        setMemories((prev) => prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m)));
        setFormSuccess("Memory updated successfully!");
      } else {
        // POST /api/memories
        const res = await fetch(`${SERVER_URL}/api/memories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || "Failed to seal memory in vault.");
        }

        const created: MemoryItem = await res.json();
        playLanternReleaseSound();
        setMemories((prev) => [created, ...prev]);
        setTotalMemories((prev) => prev + 1);
        setFormSuccess("Memory sealed in the Horizon Vault!");
      }

      setTimeout(() => {
        resetForm();
        setView("library");
      }, 1200);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // Handle Memory Deletion
  const handleConfirmDelete = async () => {
    if (!memoryToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`${SERVER_URL}/api/memories/${memoryToDelete._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to delete memory.");
      }

      setMemories((prev) => prev.filter((m) => m._id !== memoryToDelete._id));
      setTotalMemories((prev) => Math.max(0, prev - 1));
      if (selectedMemory?._id === memoryToDelete._id) {
        setSelectedMemory(null);
      }
      setMemoryToDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete memory.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Collection Creation / Rename
  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    try {
      if (editingCollection) {
        // Rename collection
        const res = await fetch(`${SERVER_URL}/api/collections/${editingCollection._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: newCollectionName.trim() }),
        });
        if (res.ok) {
          const updated = await res.json();
          setCollections((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
        }
      } else {
        // Create collection
        const res = await fetch(`${SERVER_URL}/api/collections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: newCollectionName.trim() }),
        });
        if (res.ok) {
          const created = await res.json();
          setCollections((prev) => [...prev, created]);
          setSelectedCollection(created._id);
        }
      }
      setNewCollectionName("");
      setEditingCollection(null);
      setShowCreateCollectionModal(false);
    } catch (err) {
      console.error("Error saving collection:", err);
    }
  };

  // Handle Collection Deletion
  const handleDeleteCollection = async (colId: string) => {
    if (!confirm("Delete this collection? Its memories will move to Uncategorized.")) return;

    try {
      const res = await fetch(`${SERVER_URL}/api/collections/${colId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setCollections((prev) => prev.filter((c) => c._id !== colId));
        if (selectedCollection === colId) {
          setSelectedCollection("all");
        }
        // Update local memories
        setMemories((prev) =>
          prev.map((m) => (m.collectionId === colId ? { ...m, collectionId: null } : m))
        );
      }
    } catch (err) {
      console.error("Error deleting collection:", err);
    }
  };

  // Handle Auth submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError("Email and password are required.");
      return;
    }

    try {
      setIsAuthSubmitting(true);

      if (authMode === "signup") {
        if (!authName.trim()) {
          setAuthError("Your name is required to sign up.");
          setIsAuthSubmitting(false);
          return;
        }

        const res = await authClient.signUp.email({
          email: authEmail.trim(),
          password: authPassword.trim(),
          name: authName.trim(),
        });

        if (res.error) {
          throw new Error(res.error.message || "Failed to create account.");
        }
      } else {
        const res = await authClient.signIn.email({
          email: authEmail.trim(),
          password: authPassword.trim(),
        });

        if (res.error) {
          throw new Error(res.error.message || "Invalid email or password.");
        }
      }

      await refetchSession();
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Handle Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setAuthError("");

      await authClient.signIn.social({
        provider: "google",
        callbackURL: typeof window !== "undefined" ? window.location.href : "http://localhost:3000",
      });
    } catch (err) {
      console.error("Google sign in error:", err);
      setAuthError(err instanceof Error ? err.message : "Failed to connect to Google.");
      setIsGoogleLoading(false);
    }
  };

  // Check if current user is owner of a memory or admin
  const canManageMemory = (memory: MemoryItem) => {
    if (!currentUserId) return false;
    return memory.userId === currentUserId || currentUserRole === "admin";
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-hidden"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-6xl max-h-[94vh] glass-panel rounded-3xl border border-white/15 p-3.5 sm:p-6 md:p-7 shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10 shrink-0 gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3.5 truncate">
              {view !== "library" ? (
                <button
                  type="button"
                  onClick={() => {
                    setView("library");
                    resetForm();
                  }}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl glass-card flex items-center justify-center text-cyan-300 hover:text-white border border-white/15 hover:border-cyan-400/40 transition-colors cursor-pointer shrink-0"
                  aria-label="Back to Library"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl glass-card flex items-center justify-center text-cyan-400 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)] shrink-0">
                  <Compass className="w-5 h-5 animate-pulse" />
                </div>
              )}
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-xl md:text-2xl font-extrabold text-white tracking-wide truncate">
                    {view === "create"
                      ? "Seal a New Memory"
                      : view === "edit"
                      ? "Edit Memory"
                      : "Memory Library"}
                  </h2>
                  {view === "library" && (
                    <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                      {totalMemories} {totalMemories === 1 ? "Memory" : "Memories"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  {view === "create" || view === "edit"
                    ? "Preserve your reflection, photo, year and collection"
                    : "Digital archive of shared moments, reflections & milestones"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {view === "library" && (
                <>
                  {/* Grid / List Toggle */}
                  <div className="hidden sm:flex items-center rounded-xl bg-black/40 p-0.5 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setDisplayMode("grid")}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        displayMode === "grid" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                      }`}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode("list")}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        displayMode === "list" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                      }`}
                      aria-label="List view"
                    >
                      <ListIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Create Memory CTA */}
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setView("create");
                    }}
                    className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs sm:text-sm tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden xs:inline">New Memory</span>
                    <span className="xs:hidden">New</span>
                  </button>
                </>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full text-slate-400 hover:text-white glass-card transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* MAIN BODY CONTENT */}
          <div className="flex-1 overflow-y-auto pt-3.5 pb-2 pr-0.5 custom-scrollbar">
            {/* VIEW: LIBRARY */}
            {view === "library" && (
              <div className="space-y-3.5 sm:space-y-4">
                {/* SEARCH & FILTER BAR (Sticky / Top of Vault) */}
                <div className="space-y-2.5">
                  {/* Search and Year Row */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search memories by title, story or author..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-medium text-slate-400 pl-1 sm:pl-0">Year:</span>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value === "all" ? "all" : Number(e.target.value))}
                        className="px-3 py-2 rounded-xl glass-card border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400/50 bg-[#070914] cursor-pointer"
                      >
                        <option value="all">All Years</option>
                        <option value="2027">2027 (Horizon)</option>
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                      </select>
                    </div>
                  </div>

                  {/* COLLECTIONS CHIP BAR */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar no-scrollbar text-xs">
                    {/* All Collections */}
                    <button
                      type="button"
                      onClick={() => setSelectedCollection("all")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all cursor-pointer ${
                        selectedCollection === "all"
                          ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                          : "glass-card text-slate-300 hover:text-white border-white/10"
                      }`}
                    >
                      <Globe className="w-3 h-3" />
                      <span>All Collections</span>
                    </button>

                    {/* Uncategorized */}
                    <button
                      type="button"
                      onClick={() => setSelectedCollection("uncategorized")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all cursor-pointer ${
                        selectedCollection === "uncategorized"
                          ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                          : "glass-card text-slate-300 hover:text-white border-white/10"
                      }`}
                    >
                      <Folder className="w-3 h-3 text-slate-400" />
                      <span>Uncategorized</span>
                    </button>

                    {/* User's Collections */}
                    {collections.map((col) => {
                      const isSelected = selectedCollection === col._id;
                      return (
                        <div
                          key={col._id}
                          className={`flex items-center rounded-xl border transition-all ${
                            isSelected
                              ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                              : "glass-card text-slate-300 hover:text-white border-white/10"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedCollection(col._id)}
                            className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 whitespace-nowrap font-medium cursor-pointer"
                          >
                            <Folder className="w-3 h-3 text-cyan-400" />
                            <span>{col.name}</span>
                          </button>

                          {/* Collection edit/delete actions */}
                          <div className="flex items-center pr-1.5 gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCollection(col);
                                setNewCollectionName(col.name);
                                setShowCreateCollectionModal(true);
                              }}
                              className="p-1 hover:text-cyan-300 rounded text-slate-400 cursor-pointer"
                              title="Rename Collection"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCollection(col._id);
                              }}
                              className="p-1 hover:text-rose-400 rounded text-slate-400 cursor-pointer"
                              title="Delete Collection"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Collection CTA (If Authenticated) */}
                    {currentUserId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCollection(null);
                          setNewCollectionName("");
                          setShowCreateCollectionModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 whitespace-nowrap text-xs transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>New Collection</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* MEMORIES DISPLAY */}
                {isLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-11 h-11 rounded-2xl glass-card border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)] animate-spin">
                      <Compass className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-white mt-3.5">Searching Memory Vault...</p>
                    <p className="text-xs text-slate-400 mt-0.5">Filtering through archived memories</p>
                  </div>
                ) : error ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                    <AlertCircle className="w-10 h-10 text-rose-400 mb-3" />
                    <h3 className="text-base font-semibold text-white">Unable to Load Library</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
                    <button
                      type="button"
                      onClick={() => fetchMemories(1, false)}
                      className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl glass-card text-xs font-semibold text-cyan-300 hover:text-white cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : memories.length === 0 ? (
                  <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                    <Sparkles className="w-10 h-10 text-amber-300 animate-pulse mb-3" />
                    <h3 className="text-base sm:text-lg font-bold text-white">No Memories Found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md">
                      {debouncedSearch
                        ? `No stories matched "${debouncedSearch}". Try adjusting your keywords or filters.`
                        : "No memories archived under this collection or year yet."}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setView("create");
                      }}
                      className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs tracking-wide shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add a Memory</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* GRID / LIST VIEW */}
                    {displayMode === "grid" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {memories.map((memory) => {
                          const isOwner = canManageMemory(memory);
                          return (
                            <div
                              key={memory._id}
                              onClick={() => setSelectedMemory(memory)}
                              className="glass-card rounded-2xl border border-white/10 hover:border-cyan-400/50 overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(6,182,212,0.2)] hover:-translate-y-1 group"
                            >
                              {/* Thumbnail */}
                              <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
                                {memory.imageUrl ? (
                                  <img
                                    src={memory.imageUrl}
                                    alt={memory.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600 bg-white/[0.02]">
                                    <ImageIcon className="w-8 h-8" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                                {/* Badges */}
                                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                  {memory.visibility === "private" && (
                                    <span className="p-1 rounded-full bg-black/60 border border-white/20 text-amber-300 backdrop-blur-md" title="Private Memory">
                                      <Lock className="w-3 h-3" />
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 border border-white/20 text-cyan-300 backdrop-blur-md">
                                    {memory.year}
                                  </span>
                                </div>

                                {/* Owner Quick Actions */}
                                {isOwner && (
                                  <div
                                    className="absolute top-2.5 left-2.5 flex items-center gap-1 z-10"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(memory)}
                                      className="p-1.5 rounded-lg bg-black/60 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 border border-white/20 backdrop-blur-md transition-colors cursor-pointer"
                                      title="Edit Memory"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setMemoryToDelete(memory)}
                                      className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-slate-300 hover:text-white border border-white/20 backdrop-blur-md transition-colors cursor-pointer"
                                      title="Delete Memory"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Card Content */}
                              <div className="p-3.5 flex-1 flex flex-col justify-between">
                                <div>
                                  <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-cyan-200 transition-colors line-clamp-1">
                                    {memory.title}
                                  </h4>
                                  <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed font-light">
                                    {memory.story}
                                  </p>
                                </div>

                                {/* Footer */}
                                <div className="pt-3 mt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                                  <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                                    <User className="w-3 h-3 text-cyan-400 shrink-0" />
                                    <span className="truncate font-medium text-slate-300">
                                      {memory.authorName || "Anonymous"}
                                    </span>
                                  </div>
                                  {memory.createdAt && (
                                    <span className="text-[10px] text-slate-500">
                                      {new Date(memory.createdAt).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* COMPACT LIST VIEW (Especially friendly on mobile) */
                      <div className="space-y-2">
                        {memories.map((memory) => {
                          const isOwner = canManageMemory(memory);
                          return (
                            <div
                              key={memory._id}
                              onClick={() => setSelectedMemory(memory)}
                              className="glass-card rounded-2xl border border-white/10 hover:border-cyan-400/50 p-2.5 sm:p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-white/[0.03] group"
                            >
                              {/* Thumbnail */}
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-slate-900 shrink-0 relative">
                                {memory.imageUrl ? (
                                  <img
                                    src={memory.imageUrl}
                                    alt={memory.title}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <ImageIcon className="w-5 h-5" />
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0 pr-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 truncate">
                                    {memory.title}
                                  </h4>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/10 text-cyan-300 shrink-0">
                                    {memory.year}
                                  </span>
                                  {memory.visibility === "private" && (
                                    <Lock className="w-3 h-3 text-amber-300 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-light">
                                  {memory.story}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                  <span className="text-slate-300 font-medium truncate max-w-[120px]">
                                    {memory.authorName || "Anonymous"}
                                  </span>
                                  {memory.createdAt && (
                                    <span>
                                      •{" "}
                                      {new Date(memory.createdAt).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Owner Actions */}
                              {isOwner && (
                                <div
                                  className="flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(memory)}
                                    className="p-1.5 rounded-lg hover:bg-cyan-500 hover:text-slate-950 text-slate-400 transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMemoryToDelete(memory)}
                                    className="p-1.5 rounded-lg hover:bg-rose-500 hover:text-white text-slate-400 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* LOAD MORE BUTTON */}
                    {hasMore && (
                      <div className="pt-3 pb-2 flex justify-center">
                        <button
                          type="button"
                          disabled={isLoadingMore}
                          onClick={handleLoadMore}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-xl glass-card border border-cyan-500/40 text-cyan-300 hover:text-white hover:border-cyan-400 text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isLoadingMore ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                              <span>Loading more memories...</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              <span>Load More Memories</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* VIEW: CREATE / EDIT MEMORY */}
            {(view === "create" || view === "edit") && (
              <div className="max-w-2xl mx-auto py-1">
                {/* Check Session Loading */}
                {isSessionLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    <p className="text-xs sm:text-sm text-slate-400 mt-3">Verifying authentication status...</p>
                  </div>
                ) : !session?.user ? (
                  /* AUTHENTICATION GATE */
                  <div className="py-6 sm:py-8 px-4 sm:px-8 glass-card rounded-3xl border border-white/15 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl glass-card flex items-center justify-center text-cyan-400 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                      <Lock className="w-6 h-6" />
                    </div>

                    <h3 className="text-lg sm:text-2xl font-extrabold text-white mt-4">
                      Sign In Required
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Sign in or create an account to seal and manage your personal memories in the vault.
                    </p>

                    {/* Google OAuth Button */}
                    <div className="mt-5 max-w-sm mx-auto">
                      <button
                        type="button"
                        disabled={isGoogleLoading || isAuthSubmitting}
                        onClick={handleGoogleSignIn}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl glass-card border border-white/15 text-slate-200 hover:text-white hover:border-cyan-400/40 text-xs sm:text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 shadow-md"
                      >
                        {isGoogleLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>Connecting to Google...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            <span>Continue with Google</span>
                          </>
                        )}
                      </button>

                      <div className="relative my-4 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10" />
                        </div>
                        <span className="relative px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-[#0d1226] rounded-full">
                          or with email
                        </span>
                      </div>
                    </div>

                    {/* Auth Mode Tabs */}
                    <div className="flex rounded-xl bg-black/40 p-1 max-w-sm mx-auto border border-white/10 mb-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("signin");
                          setAuthError("");
                        }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          authMode === "signin" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("signup");
                          setAuthError("");
                        }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          authMode === "signup" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Create Account
                      </button>
                    </div>

                    {authError && (
                      <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-left max-w-sm mx-auto">
                        {authError}
                      </div>
                    )}

                    {/* Auth Form */}
                    <form onSubmit={handleAuthSubmit} className="space-y-3 max-w-sm mx-auto text-left">
                      {authMode === "signup" && (
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Your Name
                          </label>
                          <input
                            type="text"
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            placeholder="e.g. Abrar or Maya"
                            className="w-full px-3.5 py-2 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full px-3.5 py-2 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-3.5 pr-10 py-2 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setView("library")}
                          className="px-4 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={isAuthSubmitting}
                          className="flex-1 flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs tracking-wide shadow-md transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isAuthSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Authenticating...</span>
                            </>
                          ) : authMode === "signup" ? (
                            <>
                              <UserPlus className="w-4 h-4" />
                              <span>Sign Up & Continue</span>
                            </>
                          ) : (
                            <>
                              <LogIn className="w-4 h-4" />
                              <span>Sign In & Continue</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  /* CREATE / EDIT MEMORY FORM */
                  <form onSubmit={handleFormSubmit} className="space-y-3.5 sm:space-y-4">
                    {/* Logged in User Bar */}
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl glass-card border border-white/10 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <User className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-slate-400">Author:</span>
                        <span className="font-semibold text-white truncate">
                          {session.user.name || session.user.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await authClient.signOut();
                          await refetchSession();
                        }}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors ml-2 shrink-0 cursor-pointer"
                        title="Sign Out"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Sign out</span>
                      </button>
                    </div>

                    {/* Feedback Alerts */}
                    {formError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}
                    {formSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{formSuccess}</span>
                      </div>
                    )}

                    {/* Title */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g. Midnight Sparks with Loved Ones"
                        maxLength={80}
                        className="w-full px-3.5 py-2 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50"
                        required
                      />
                    </div>

                    {/* Story */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        Story or Reflection *
                      </label>
                      <textarea
                        value={formStory}
                        onChange={(e) => setFormStory(e.target.value)}
                        placeholder="Describe the moment, reflections, or gratitude you want to preserve..."
                        rows={3}
                        maxLength={1000}
                        className="w-full px-3.5 py-2 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 resize-none"
                        required
                      />
                      <div className="text-right text-[10px] text-slate-500 mt-0.5">{formStory.length}/1000</div>
                    </div>

                    {/* Row: Year & Visibility */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                          Year *
                        </label>
                        <input
                          type="number"
                          value={formYear}
                          onChange={(e) => setFormYear(Number(e.target.value))}
                          min={2020}
                          max={2100}
                          className="w-full px-3.5 py-2 rounded-xl glass-card border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                          Visibility
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormVisibility("public")}
                            className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              formVisibility === "public"
                                ? "border-cyan-400 text-cyan-300 bg-cyan-500/15"
                                : "border-white/10 text-slate-400 glass-card"
                            }`}
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Public</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormVisibility("private")}
                            className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              formVisibility === "private"
                                ? "border-amber-400 text-amber-300 bg-amber-500/15"
                                : "border-white/10 text-slate-400 glass-card"
                            }`}
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Private</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Collection Assignment */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Collection
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCollection(null);
                            setNewCollectionName("");
                            setShowCreateCollectionModal(true);
                          }}
                          className="text-[11px] text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>New Collection</span>
                        </button>
                      </div>
                      <select
                        value={formCollectionId}
                        onChange={(e) => setFormCollectionId(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl glass-card border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 bg-[#070914] cursor-pointer"
                      >
                        <option value="">Uncategorized (No Collection)</option>
                        {collections.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Image Attachment (Upload OR URL) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Image Snapshot *
                        </label>
                        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                          <button
                            type="button"
                            onClick={() => setImageMode("upload")}
                            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                              imageMode === "upload" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                            }`}
                          >
                            <Upload className="w-3 h-3" />
                            <span>Device</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageMode("url")}
                            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                              imageMode === "url" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                            }`}
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span>URL</span>
                          </button>
                        </div>
                      </div>

                      {imageMode === "upload" ? (
                        <div>
                          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                          {!selectedFileBase64 && !directImageUrl ? (
                            <div
                              onClick={() => fileInputRef.current?.click()}
                              className="border-2 border-dashed border-white/20 hover:border-cyan-400/50 rounded-2xl p-5 text-center cursor-pointer transition-colors glass-card flex flex-col items-center justify-center group"
                            >
                              <Upload className="w-5 h-5 text-cyan-400 mb-1 group-hover:scale-110 transition-transform" />
                              <p className="text-xs font-semibold text-slate-200">Select photo from device</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, or WebP up to 10MB</p>
                            </div>
                          ) : (
                            <div className="rounded-2xl overflow-hidden glass-card border border-cyan-500/40 p-2 flex items-center gap-3">
                              <img
                                src={selectedFileBase64 || directImageUrl}
                                alt="Preview"
                                className="w-14 h-14 rounded-xl object-cover shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">
                                  {selectedFileName || "Image selected"}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="text-[11px] text-cyan-300 hover:underline cursor-pointer mt-0.5"
                                >
                                  Change file
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <input
                            type="url"
                            value={directImageUrl}
                            onChange={(e) => setDirectImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3.5 py-2 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50"
                          />
                          {directImageUrl.trim() && (
                            <div className="mt-2 rounded-xl overflow-hidden h-24 w-full glass-card border border-white/10">
                              <img src={directImageUrl} alt="URL preview" className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        disabled={isFormSubmitting}
                        onClick={() => {
                          setView("library");
                          resetForm();
                        }}
                        className="px-4 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={isFormSubmitting}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs sm:text-sm tracking-wide shadow-md hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                      >
                        {isFormSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{view === "edit" ? "Updating..." : "Sealing Memory..."}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-cyan-200" />
                            <span>{view === "edit" ? "Save Changes" : "Seal in Vault"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* MEMORY LIGHTBOX / DETAIL MODAL */}
        <AnimatePresence>
          {selectedMemory && (
            <div
              className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-lg"
              onClick={() => setSelectedMemory(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-2xl max-h-[92vh] glass-panel rounded-3xl border border-white/20 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedMemory(null)}
                  className="absolute top-3.5 right-3.5 z-10 p-2 rounded-full text-white/80 hover:text-white bg-black/60 backdrop-blur-md border border-white/20 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Cover Image */}
                {selectedMemory.imageUrl && (
                  <div className="relative max-h-64 sm:max-h-72 w-full overflow-hidden bg-black shrink-0">
                    <img src={selectedMemory.imageUrl} alt={selectedMemory.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1d] via-transparent to-transparent pointer-events-none" />
                  </div>
                )}

                {/* Details Content */}
                <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                      {selectedMemory.year} Horizon
                    </span>
                    {selectedMemory.visibility === "private" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Private</span>
                      </span>
                    )}
                    {selectedMemory.createdAt && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>
                          {new Date(selectedMemory.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-2xl font-extrabold text-white">{selectedMemory.title}</h3>

                  <div className="flex items-center gap-2 mt-1.5 mb-4 text-xs text-slate-300">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-medium text-slate-200">{selectedMemory.authorName || "Anonymous"}</span>
                  </div>

                  <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/10 relative">
                    <span className="text-2xl font-serif text-cyan-400/40 absolute top-1.5 left-2.5">“</span>
                    <p className="text-slate-200 text-xs sm:text-sm leading-relaxed pl-4 pr-1 font-light whitespace-pre-line">
                      {selectedMemory.story}
                    </p>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      {canManageMemory(selectedMemory) && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(selectedMemory)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl glass-card text-xs text-cyan-300 hover:text-white border border-cyan-500/30 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMemoryToDelete(selectedMemory)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl glass-card text-xs text-rose-300 hover:text-white border border-rose-500/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedMemory(null)}
                      className="px-5 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                    >
                      Close Story
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* DELETE CONFIRMATION MODAL */}
        <AnimatePresence>
          {memoryToDelete && (
            <div
              className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setMemoryToDelete(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm glass-panel rounded-2xl border border-rose-500/30 p-5 shadow-2xl text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-10 h-10 mx-auto rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-white">Delete Memory?</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Are you sure you want to remove &quot;{memoryToDelete.title}&quot; from the vault? This cannot be undone.
                </p>

                <div className="mt-5 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setMemoryToDelete(null)}
                    className="flex-1 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* CREATE / RENAME COLLECTION MODAL */}
        <AnimatePresence>
          {showCreateCollectionModal && (
            <div
              className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setShowCreateCollectionModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm glass-panel rounded-2xl border border-white/20 p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">
                      {editingCollection ? "Rename Collection" : "New Collection"}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateCollectionModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveCollection}>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="e.g. Midnight Celebrations or Family"
                    maxLength={40}
                    className="w-full px-3 py-2 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400/50"
                    autoFocus
                    required
                  />

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateCollectionModal(false)}
                      className="px-3 py-1.5 rounded-xl glass-card text-xs text-slate-300 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs"
                    >
                      {editingCollection ? "Save" : "Create"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
