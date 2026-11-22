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
  ChevronDown,
  Shield,
} from "lucide-react";
import { getEvergreenTarget } from "@/lib/dateUtils";
import { authClient } from "@/lib/authClient";
import { playLanternReleaseSound } from "@/lib/soundEngine";
import ImageLightbox from "@/components/ui/ImageLightbox";

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
  isApproved?: boolean;
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

// ─── Shared micro-components ───────────────────────────────────────────────

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${className}`}
    >
      {children}
    </span>
  );
}

function IconBtn({
  onClick,
  label,
  className = "",
  children,
}: {
  onClick: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex items-center justify-center rounded-full transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

// Google "G" SVG
const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

// ─── Main component ────────────────────────────────────────────────────────

export default function MemoryVaultModal({ isOpen, onClose }: MemoryVaultModalProps) {
  // Views
  const [view, setView] = useState<"library" | "create" | "edit">("library");
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");

  // Authentication state
  const { data: session, isPending: isSessionLoading, refetch: refetchSession } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const currentUserRole = (session?.user as { role?: string } | undefined)?.role;
  const isStaff = currentUserRole === "admin" || currentUserRole === "moderator";
  const [isUpdatingApproval, setIsUpdatingApproval] = useState(false);

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
  const [selectedCollection, setSelectedCollection] = useState<string>("all");

  // Collections state
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [isCollectionsLoading, setIsCollectionsLoading] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);

  // Delete Confirmation state
  const [memoryToDelete, setMemoryToDelete] = useState<MemoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

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

  // ── Debounce search ──────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Fetch collections ────────────────────────────────────────────────────
  const fetchCollections = useCallback(async () => {
    if (!currentUserId) { setCollections([]); return; }
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
    if (isOpen && currentUserId) fetchCollections();
  }, [isOpen, currentUserId, fetchCollections]);

  // ── Fetch memories ───────────────────────────────────────────────────────
  const fetchMemories = useCallback(
    async (targetPage = 1, append = false) => {
      try {
        if (targetPage === 1) setIsLoading(true);
        else setIsLoadingMore(true);
        setError(null);

        const params = new URLSearchParams();
        if (selectedYear !== "all") params.append("year", String(selectedYear));
        if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
        if (selectedCollection !== "all") params.append("collectionId", selectedCollection);
        params.append("page", String(targetPage));
        params.append("limit", "12");

        const res = await fetch(`${SERVER_URL}/api/memories?${params.toString()}`, {
          credentials: "include",
        });

        if (!res.ok) throw new Error(`Failed to load memories (${res.status} ${res.statusText})`);

        const data = await res.json();
        const items: MemoryItem[] = Array.isArray(data) ? data : data.memories || [];
        const moreAvailable = typeof data.hasMore === "boolean" ? data.hasMore : false;
        const total = typeof data.total === "number" ? data.total : items.length;

        if (append) setMemories((prev) => [...prev, ...items]);
        else setMemories(items);

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

  // ── Load More ────────────────────────────────────────────────────────────
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) fetchMemories(page + 1, true);
  };

  // ── Form helpers ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormTitle(""); setFormStory(""); setFormYear(currentTargetYear);
    setFormVisibility("public"); setFormCollectionId(""); setImageMode("upload");
    setDirectImageUrl(""); setSelectedFileBase64(null); setSelectedFileName(null);
    setFormError(null); setFormSuccess(null); setIsFormSubmitting(false);
    setMemoryToEdit(null);
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setFormError("Please select an image file (PNG, JPG, WebP, etc.)."); return; }
    if (file.size > 10 * 1024 * 1024) { setFormError("Selected file is larger than 10MB. Please choose a smaller image."); return; }
    setFormError(null);
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => setSelectedFileBase64(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); setFormSuccess(null);

    if (!formTitle.trim()) { setFormError("Please enter a memory title."); return; }
    if (!formStory.trim()) { setFormError("Please write a story or reflection."); return; }
    if (!formYear || isNaN(Number(formYear))) { setFormError("Please provide a valid year."); return; }

    let finalImageUrl = directImageUrl.trim();

    try {
      setIsFormSubmitting(true);

      if (imageMode === "upload") {
        if (!selectedFileBase64 && !memoryToEdit?.imageUrl) {
          setFormError("Please select an image to upload."); setIsFormSubmitting(false); return;
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
        if (!finalImageUrl) { setFormError("Please provide a valid image URL."); setIsFormSubmitting(false); return; }
      }

      const isOwnerOfEditingMemory = view === "create" || (memoryToEdit && memoryToEdit.userId === currentUserId);

      const payload: Record<string, any> = {
        title: formTitle.trim(),
        story: formStory.trim(),
        imageUrl: finalImageUrl,
        year: Number(formYear),
      };

      if (isOwnerOfEditingMemory) {
        payload.visibility = formVisibility;
        payload.collectionId = formCollectionId ? formCollectionId : null;
      }

      if (view === "edit" && memoryToEdit) {
        const res = await fetch(`${SERVER_URL}/api/memories/${memoryToEdit._id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.message || "Failed to update memory."); }
        const updated: MemoryItem = await res.json();
        setMemories((prev) => prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m)));
        setFormSuccess("Memory updated successfully!");
      } else {
        const res = await fetch(`${SERVER_URL}/api/memories`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => null); throw new Error(e?.message || "Failed to seal memory in vault."); }
        const created: MemoryItem = await res.json();
        playLanternReleaseSound();
        setMemories((prev) => [created, ...prev]);
        setTotalMemories((prev) => prev + 1);
        setFormSuccess("Memory sealed in the Horizon Vault!");
      }

      setTimeout(() => { resetForm(); setView("library"); }, 1200);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!memoryToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`${SERVER_URL}/api/memories/${memoryToDelete._id}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.message || "Failed to delete memory."); }
      setMemories((prev) => prev.filter((m) => m._id !== memoryToDelete._id));
      setTotalMemories((prev) => Math.max(0, prev - 1));
      if (selectedMemory?._id === memoryToDelete._id) setSelectedMemory(null);
      setMemoryToDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete memory.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      if (editingCollection) {
        const res = await fetch(`${SERVER_URL}/api/collections/${editingCollection._id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ name: newCollectionName.trim() }),
        });
        if (res.ok) { const updated = await res.json(); setCollections((prev) => prev.map((c) => (c._id === updated._id ? updated : c))); }
      } else {
        const res = await fetch(`${SERVER_URL}/api/collections`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ name: newCollectionName.trim() }),
        });
        if (res.ok) { const created = await res.json(); setCollections((prev) => [...prev, created]); setSelectedCollection(created._id); }
      }
      setNewCollectionName(""); setEditingCollection(null); setShowCreateCollectionModal(false);
    } catch (err) {
      console.error("Error saving collection:", err);
    }
  };

  const handleDeleteCollection = async (colId: string) => {
    if (!confirm("Delete this collection? Its memories will move to Uncategorized.")) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/collections/${colId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setCollections((prev) => prev.filter((c) => c._id !== colId));
        if (selectedCollection === colId) setSelectedCollection("all");
        setMemories((prev) => prev.map((m) => (m.collectionId === colId ? { ...m, collectionId: null } : m)));
      }
    } catch (err) {
      console.error("Error deleting collection:", err);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authEmail.trim() || !authPassword.trim()) { setAuthError("Email and password are required."); return; }
    try {
      setIsAuthSubmitting(true);
      if (authMode === "signup") {
        if (!authName.trim()) { setAuthError("Your name is required to sign up."); setIsAuthSubmitting(false); return; }
        const res = await authClient.signUp.email({ email: authEmail.trim(), password: authPassword.trim(), name: authName.trim() });
        if (res.error) throw new Error(res.error.message || "Failed to create account.");
      } else {
        const res = await authClient.signIn.email({ email: authEmail.trim(), password: authPassword.trim() });
        if (res.error) throw new Error(res.error.message || "Invalid email or password.");
      }
      await refetchSession();
      setAuthEmail(""); setAuthPassword(""); setAuthName("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true); setAuthError("");
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

  const canManageMemory = (memory: MemoryItem) => {
    if (!currentUserId) return false;
    // Nobody except the owner can access or manage another user's PRIVATE memories, including Admin
    if (memory.visibility === "private") {
      return memory.userId === currentUserId;
    }
    // Owners can manage their own memories; Admin and Moderator can manage other users' PUBLIC memories
    return memory.userId === currentUserId || isStaff;
  };

  const handleToggleApproval = async (memory: MemoryItem) => {
    if (!isStaff || memory.visibility === "private") return;
    try {
      setIsUpdatingApproval(true);
      const nextApproved = memory.isApproved === false;
      const res = await fetch(`${SERVER_URL}/api/memories/${memory._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isApproved: nextApproved }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update moderation status");
      }
      const updated: MemoryItem = await res.json();
      setMemories((prev) =>
        prev.map((m) => (m._id === updated._id ? { ...m, isApproved: updated.isApproved } : m))
      );
      if (selectedMemory?._id === updated._id) {
        setSelectedMemory((prev) => (prev ? { ...prev, isApproved: updated.isApproved } : null));
      }
    } catch (err) {
      console.error("Moderation error:", err);
      alert(err instanceof Error ? err.message : "Error updating approval status");
    } finally {
      setIsUpdatingApproval(false);
    }
  };

  if (!isOpen) return null;

  // ── Helpers for labels ───────────────────────────────────────────────────
  const viewTitle = view === "create" ? "New Memory" : view === "edit" ? "Edit Memory" : "Memory Library";
  const viewSubtitle =
    view === "library"
      ? "Digital archive of shared moments, reflections & milestones"
      : "Preserve your reflection, photo, year and collection";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md overflow-hidden"
        onClick={onClose}
      >
        {/* Panel – slides up from bottom on mobile, scales in on desktop */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.97 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full max-w-6xl sm:max-h-[94vh] h-[96dvh] sm:h-auto glass-panel rounded-t-3xl sm:rounded-3xl border border-white/15 shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle – visible only on mobile */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 sm:px-6 md:px-7 pb-3 sm:pb-4 pt-2 sm:pt-5 border-b border-white/10 shrink-0 gap-2">
            {/* Left: icon + title */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              {view !== "library" ? (
                <button
                  type="button"
                  onClick={() => { setView("library"); resetForm(); }}
                  className="w-9 h-9 rounded-xl glass-card flex items-center justify-center text-cyan-300 hover:text-white border border-white/15 hover:border-cyan-400/40 transition-colors cursor-pointer shrink-0 active:scale-95"
                  aria-label="Back to Library"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl glass-card flex items-center justify-center text-cyan-400 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.25)] shrink-0">
                  <Compass className="w-5 h-5 animate-pulse" />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-xl md:text-2xl font-extrabold text-white tracking-tight truncate">
                    {viewTitle}
                  </h2>
                  {view === "library" && totalMemories > 0 && (
                    <Badge className="hidden sm:inline-flex bg-cyan-500/15 border-cyan-500/30 text-cyan-300">
                      {totalMemories} {totalMemories === 1 ? "Memory" : "Memories"}
                    </Badge>
                  )}
                  {session?.user && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${
                        currentUserRole === "admin"
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-amber-500/10"
                          : currentUserRole === "moderator"
                          ? "bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-purple-500/10"
                          : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      {currentUserRole === "admin"
                        ? "Admin"
                        : currentUserRole === "moderator"
                        ? "Moderator"
                        : "Member"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5">{viewSubtitle}</p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {view === "library" && (
                <>
                  {/* Grid/List toggle – desktop only */}
                  <div className="hidden sm:flex items-center rounded-xl bg-black/40 p-0.5 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setDisplayMode("grid")}
                      aria-label="Grid view"
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${displayMode === "grid" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode("list")}
                      aria-label="List view"
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${displayMode === "list" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
                    >
                      <ListIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* New Memory CTA */}
                  <button
                    type="button"
                    onClick={() => { resetForm(); setView("create"); }}
                    className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:shadow-[0_0_30px_rgba(6,182,212,0.55)] active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden xs:inline">New Memory</span>
                    <span className="xs:hidden">New</span>
                  </button>
                </>
              )}

              {/* Close */}
              <IconBtn
                onClick={onClose}
                label="Close"
                className="w-9 h-9 text-slate-400 hover:text-white glass-card border border-white/10 hover:border-white/25 active:scale-95"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </IconBtn>
            </div>
          </div>

          {/* ── BODY ───────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
            {/* ══ LIBRARY VIEW ══════════════════════════════════════════ */}
            {view === "library" && (
              <div className="px-4 sm:px-6 md:px-7 pt-4 pb-6 space-y-4">

                {/* Search + Year row */}
                <div className="flex gap-2">
                  {/* Search input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search memories…"
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Year selector */}
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value === "all" ? "all" : Number(e.target.value))}
                    aria-label="Filter by year"
                    className="px-3 py-2.5 rounded-xl glass-card border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400/50 bg-[#070914] cursor-pointer shrink-0"
                  >
                    <option value="all">All Years</option>
                    <option value="2027">2027 (Horizon)</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                </div>

                {/* Collections chip bar */}
                <div
                  className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-7 md:px-7 no-scrollbar"
                  role="tablist"
                  aria-label="Collection filters"
                >
                  {/* All */}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedCollection === "all"}
                    onClick={() => setSelectedCollection("all")}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border whitespace-nowrap text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                      selectedCollection === "all"
                        ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_14px_rgba(6,182,212,0.35)]"
                        : "glass-card text-slate-300 hover:text-white border-white/10 hover:border-white/25"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    All
                  </button>

                  {/* Uncategorized */}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selectedCollection === "uncategorized"}
                    onClick={() => setSelectedCollection("uncategorized")}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border whitespace-nowrap text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                      selectedCollection === "uncategorized"
                        ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_14px_rgba(6,182,212,0.35)]"
                        : "glass-card text-slate-300 hover:text-white border-white/10 hover:border-white/25"
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    Uncategorized
                  </button>

                  {/* User collections */}
                  {!isCollectionsLoading &&
                    collections.map((col) => {
                      const isSelected = selectedCollection === col._id;
                      return (
                        <div
                          key={col._id}
                          className={`flex items-center rounded-xl border text-xs font-semibold transition-all shrink-0 ${
                            isSelected
                              ? "bg-cyan-500/20 text-cyan-200 border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                              : "glass-card text-slate-300 hover:text-white border-white/10 hover:border-white/25"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedCollection(col._id)}
                            className="flex items-center gap-1.5 pl-3 pr-1.5 py-2 whitespace-nowrap cursor-pointer"
                          >
                            <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>{col.name}</span>
                          </button>
                          <div className="flex items-center pr-1.5 gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingCollection(col); setNewCollectionName(col.name); setShowCreateCollectionModal(true); }}
                              aria-label="Rename collection"
                              className="p-1 text-slate-400 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteCollection(col._id); }}
                              aria-label="Delete collection"
                              className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {/* Add Collection */}
                  {currentUserId && (
                    <button
                      type="button"
                      onClick={() => { setEditingCollection(null); setNewCollectionName(""); setShowCreateCollectionModal(true); }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 whitespace-nowrap text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      New
                    </button>
                  )}
                </div>

                {/* ── Memory grid / list ─────────────────────────────── */}
                {isLoading ? (
                  <div className="py-24 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 rounded-2xl glass-card border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)] animate-spin">
                      <Compass className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-white">Searching Memory Vault…</p>
                    <p className="text-xs text-slate-400">Filtering through archived memories</p>
                  </div>
                ) : error ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center px-4 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Unable to Load Library</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchMemories(1, false)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-card border border-white/15 text-xs font-semibold text-cyan-300 hover:text-white cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Again
                    </button>
                  </div>
                ) : memories.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center px-4 gap-3">
                    <Sparkles className="w-10 h-10 text-amber-300/70 animate-pulse" />
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-white">No Memories Found</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        {debouncedSearch
                          ? `No stories matched "${debouncedSearch}". Try different keywords.`
                          : "Nothing archived here yet. Be the first to seal a moment."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { resetForm(); setView("create"); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs tracking-wide shadow-md hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      Add a Memory
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Mobile list toggle row */}
                    <div className="sm:hidden flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {totalMemories} {totalMemories === 1 ? "memory" : "memories"}
                      </span>
                      <div className="flex items-center rounded-lg bg-black/40 p-0.5 border border-white/10">
                        <button
                          type="button"
                          aria-label="Grid view"
                          onClick={() => setDisplayMode("grid")}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${displayMode === "grid" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="List view"
                          onClick={() => setDisplayMode("list")}
                          className={`p-1.5 rounded-md transition-colors cursor-pointer ${displayMode === "list" ? "bg-cyan-500 text-slate-950" : "text-slate-400"}`}
                        >
                          <ListIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* GRID VIEW */}
                    {displayMode === "grid" ? (
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {memories.map((memory) => {
                          const isOwner = canManageMemory(memory);
                          return (
                            <motion.div
                              key={memory._id}
                              layout
                              initial={{ opacity: 0, scale: 0.96 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.2 }}
                              onClick={() => setSelectedMemory(memory)}
                              className="glass-card rounded-2xl border border-white/10 hover:border-cyan-400/50 overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:shadow-[0_0_28px_rgba(6,182,212,0.18)] hover:-translate-y-0.5 group active:scale-[0.98]"
                            >
                              {/* Thumbnail */}
                              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#07090f] shrink-0">
                                {memory.imageUrl ? (
                                  <img
                                    src={memory.imageUrl}
                                    alt={memory.title}
                                    loading="lazy"
                                    onClick={(e) => { e.stopPropagation(); setLightboxSrc(memory.imageUrl); }}
                                    className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-500 cursor-zoom-in"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-700 bg-white/[0.02]">
                                    <ImageIcon className="w-7 h-7" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

                                {/* Top-right badges */}
                                <div className="absolute top-2 right-2 flex items-center gap-1">
                                  {memory.visibility === "private" && (
                                    <span title="Private" className="p-1 rounded-full bg-black/60 border border-white/15 text-amber-300 backdrop-blur-sm">
                                      <Lock className="w-3 h-3" />
                                    </span>
                                  )}
                                  {isStaff && memory.visibility !== "private" && memory.isApproved === false && (
                                    <span title="Unapproved" className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/30 border border-rose-500/50 text-rose-200 backdrop-blur-sm flex items-center gap-1">
                                      <EyeOff className="w-2.5 h-2.5" />
                                      Unapproved
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 border border-white/15 text-cyan-300 backdrop-blur-sm">
                                    {memory.year}
                                  </span>
                                </div>

                                {/* Manage actions */}
                                {isOwner && (
                                  <div
                                    className="absolute top-2 left-2 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(memory)}
                                      title="Edit"
                                      className="p-1.5 rounded-lg bg-black/60 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 border border-white/15 backdrop-blur-sm transition-colors cursor-pointer"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setMemoryToDelete(memory)}
                                      title="Delete"
                                      className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 hover:text-white text-slate-300 border border-white/15 backdrop-blur-sm transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                    {isStaff && memory.visibility !== "private" && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleApproval(memory)}
                                        title={memory.isApproved === false ? "Approve" : "Unapprove"}
                                        className={`p-1.5 rounded-lg border backdrop-blur-sm transition-colors cursor-pointer ${
                                          memory.isApproved === false
                                            ? "bg-emerald-600/70 hover:bg-emerald-500 text-white border-emerald-400/50"
                                            : "bg-black/60 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border-white/15"
                                        }`}
                                      >
                                        {memory.isApproved === false ? (
                                          <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                                        ) : (
                                          <EyeOff className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Card body */}
                              <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                                <div>
                                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 transition-colors line-clamp-1 leading-snug">
                                    {memory.title}
                                  </h4>
                                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                    {memory.story}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-white/5">
                                  <div className="flex items-center gap-1 min-w-0">
                                    <User className="w-3 h-3 text-cyan-500 shrink-0" />
                                    <span className="truncate text-slate-400 font-medium">{memory.authorName || "Anonymous"}</span>
                                  </div>
                                  {memory.createdAt && (
                                    <span className="shrink-0 pl-1">
                                      {new Date(memory.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      /* LIST VIEW */
                      <div className="space-y-2">
                        {memories.map((memory) => {
                          const isOwner = canManageMemory(memory);
                          return (
                            <motion.div
                              key={memory._id}
                              layout
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.18 }}
                              onClick={() => setSelectedMemory(memory)}
                              className="glass-card rounded-xl border border-white/10 hover:border-cyan-400/40 p-2.5 sm:p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-white/[0.03] group active:scale-[0.99]"
                            >
                              {/* Thumbnail */}
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-[#07090f] shrink-0">
                                {memory.imageUrl ? (
                                  <img
                                    src={memory.imageUrl}
                                    alt={memory.title}
                                    loading="lazy"
                                    onClick={(e) => { e.stopPropagation(); setLightboxSrc(memory.imageUrl); }}
                                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 cursor-zoom-in"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <ImageIcon className="w-5 h-5" />
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 truncate transition-colors">
                                    {memory.title}
                                  </h4>
                                  <span className="px-1.5 py-px rounded text-[9px] font-bold bg-white/10 text-cyan-300 shrink-0">
                                    {memory.year}
                                  </span>
                                  {memory.visibility === "private" && <Lock className="w-3 h-3 text-amber-300 shrink-0" />}
                                  {isStaff && memory.visibility !== "private" && memory.isApproved === false && (
                                    <span className="px-1.5 py-px rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 flex items-center gap-0.5">
                                      <EyeOff className="w-2.5 h-2.5" />
                                      Unapproved
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{memory.story}</p>
                                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                                  <span className="text-slate-400 font-medium truncate max-w-[130px]">
                                    {memory.authorName || "Anonymous"}
                                  </span>
                                  {memory.createdAt && (
                                    <span>
                                      ·{" "}
                                      {new Date(memory.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Manage actions (owner or staff) */}
                              {isOwner && (
                                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {isStaff && memory.visibility !== "private" && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleApproval(memory)}
                                      title={memory.isApproved === false ? "Approve memory" : "Unapprove memory"}
                                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                        memory.isApproved === false
                                          ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15"
                                          : "text-slate-400 hover:text-amber-300 hover:bg-amber-500/15"
                                      }`}
                                    >
                                      {memory.isApproved === false ? (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      ) : (
                                        <EyeOff className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(memory)}
                                    title="Edit"
                                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/15 transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMemoryToDelete(memory)}
                                    title="Delete"
                                    className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* Load More */}
                    {hasMore && (
                      <div className="pt-4 flex justify-center">
                        <button
                          type="button"
                          disabled={isLoadingMore}
                          onClick={handleLoadMore}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-xl glass-card border border-cyan-500/40 text-cyan-300 hover:text-white hover:border-cyan-400 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                        >
                          {isLoadingMore ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /><span>Loading…</span></>
                          ) : (
                            <><ChevronDown className="w-4 h-4" /><span>Load More Memories</span></>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ══ CREATE / EDIT VIEW ════════════════════════════════════ */}
            {(view === "create" || view === "edit") && (
              <div className="px-4 sm:px-6 md:px-7 pt-4 pb-8">
                <div className="max-w-2xl mx-auto">
                  {isSessionLoading ? (
                    <div className="py-24 flex flex-col items-center gap-3 text-center">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                      <p className="text-sm text-slate-400">Verifying authentication…</p>
                    </div>
                  ) : !session?.user ? (
                    /* ── AUTH GATE ─────────────────────────────────────── */
                    <div className="py-6 sm:py-8 glass-card rounded-3xl border border-white/15 px-5 sm:px-8 text-center">
                      <div className="w-12 h-12 mx-auto rounded-2xl glass-card flex items-center justify-center text-cyan-400 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
                        <Lock className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold text-white mt-4">Sign In Required</h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                        Sign in or create an account to seal and manage your personal memories.
                      </p>

                      {/* Google OAuth */}
                      <div className="mt-5 max-w-sm mx-auto space-y-4">
                        <button
                          type="button"
                          disabled={isGoogleLoading || isAuthSubmitting}
                          onClick={handleGoogleSignIn}
                          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl glass-card border border-white/15 text-slate-200 hover:text-white hover:border-cyan-400/40 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 shadow-md"
                        >
                          {isGoogleLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin text-cyan-400" /><span>Connecting…</span></>
                          ) : (
                            <><GoogleIcon /><span>Continue with Google</span></>
                          )}
                        </button>

                        {/* Divider */}
                        <div className="relative flex items-center justify-center">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                          </div>
                          <span className="relative px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 bg-[#0d1226] rounded-full">
                            or with email
                          </span>
                        </div>

                        {/* Auth mode tabs */}
                        <div className="flex rounded-xl bg-black/40 p-1 border border-white/10">
                          {(["signin", "signup"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => { setAuthMode(mode); setAuthError(""); }}
                              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${authMode === mode ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
                            >
                              {mode === "signin" ? "Sign In" : "Create Account"}
                            </button>
                          ))}
                        </div>

                        {/* Auth error */}
                        {authError && (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-left flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{authError}</span>
                          </div>
                        )}

                        {/* Auth form */}
                        <form onSubmit={handleAuthSubmit} className="space-y-3 text-left">
                          {authMode === "signup" && (
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                Your Name
                              </label>
                              <input
                                type="text"
                                value={authName}
                                onChange={(e) => setAuthName(e.target.value)}
                                placeholder="e.g. Abrar or Maya"
                                className="w-full px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                                required
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                              Email Address
                            </label>
                            <input
                              type="email"
                              value={authEmail}
                              onChange={(e) => setAuthEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="w-full px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                              Password
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? "text" : "password"}
                                value={authPassword}
                                onChange={(e) => setAuthPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4 text-cyan-400" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>

                          <div className="pt-2 flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => setView("library")}
                              className="px-4 py-2.5 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isAuthSubmitting}
                              className="flex-1 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                            >
                              {isAuthSubmitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /><span>Authenticating…</span></>
                              ) : authMode === "signup" ? (
                                <><UserPlus className="w-4 h-4" /><span>Sign Up & Continue</span></>
                              ) : (
                                <><LogIn className="w-4 h-4" /><span>Sign In & Continue</span></>
                              )}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : (
                    /* ── MEMORY FORM ────────────────────────────────────── */
                    <form onSubmit={handleFormSubmit} className="space-y-4 sm:space-y-5">

                      {/* Author bar */}
                      <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <User className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="text-slate-400">Author:</span>
                          <span className="font-semibold text-white truncate">{session.user.name || session.user.email}</span>
                          {currentUserRole && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ml-1 ${
                                currentUserRole === "admin"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : currentUserRole === "moderator"
                                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                  : "bg-white/10 text-slate-300 border-white/10"
                              }`}
                            >
                              <Shield className="w-2.5 h-2.5" />
                              {currentUserRole === "admin"
                                ? "Admin"
                                : currentUserRole === "moderator"
                                ? "Moderator"
                                : "Member"}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={async () => { await authClient.signOut(); await refetchSession(); }}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors ml-2 shrink-0 cursor-pointer"
                          title="Sign Out"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>Sign out</span>
                        </button>
                      </div>

                      {/* Feedback */}
                      <AnimatePresence>
                        {formError && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{formError}</span>
                          </motion.div>
                        )}
                        {formSuccess && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{formSuccess}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Title */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Title <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          placeholder="e.g. Midnight Sparks with Loved Ones"
                          maxLength={80}
                          className="w-full px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                          required
                        />
                      </div>

                      {/* Story */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                          Story or Reflection <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          value={formStory}
                          onChange={(e) => setFormStory(e.target.value)}
                          placeholder="Describe the moment, reflections, or gratitude you want to preserve…"
                          rows={4}
                          maxLength={1000}
                          className="w-full px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 resize-none transition-colors"
                          required
                        />
                        <div className="text-right text-[10px] text-slate-500 mt-0.5">{formStory.length}/1000</div>
                      </div>

                      {/* Year + Visibility */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                            Year <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="number"
                            value={formYear}
                            onChange={(e) => setFormYear(Number(e.target.value))}
                            min={2020} max={2100}
                            className="w-full px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                            Visibility
                          </label>
                          <div className="grid grid-cols-2 gap-2 h-[42px]">
                            <button
                              type="button"
                              onClick={() => setFormVisibility("public")}
                              className={`h-full rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                formVisibility === "public"
                                  ? "border-cyan-400 text-cyan-300 bg-cyan-500/15"
                                  : "border-white/10 text-slate-400 glass-card hover:border-white/25"
                              }`}
                            >
                              <Globe className="w-3.5 h-3.5" /><span>Public</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormVisibility("private")}
                              className={`h-full rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                formVisibility === "private"
                                  ? "border-amber-400 text-amber-300 bg-amber-500/15"
                                  : "border-white/10 text-slate-400 glass-card hover:border-white/25"
                              }`}
                            >
                              <Lock className="w-3.5 h-3.5" /><span>Private</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Collection */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Collection
                          </label>
                          <button
                            type="button"
                            onClick={() => { setEditingCollection(null); setNewCollectionName(""); setShowCreateCollectionModal(true); }}
                            className="text-[11px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />New
                          </button>
                        </div>
                        <select
                          value={formCollectionId}
                          onChange={(e) => setFormCollectionId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 bg-[#070914] cursor-pointer transition-colors"
                        >
                          <option value="">Uncategorized</option>
                          {collections.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                      </div>

                      {/* Image */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Image Snapshot <span className="text-rose-400">*</span>
                          </label>
                          <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-lg border border-white/10">
                            <button
                              type="button"
                              onClick={() => setImageMode("upload")}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${imageMode === "upload" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
                            >
                              <Upload className="w-3 h-3" />Device
                            </button>
                            <button
                              type="button"
                              onClick={() => setImageMode("url")}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${imageMode === "url" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"}`}
                            >
                              <LinkIcon className="w-3 h-3" />URL
                            </button>
                          </div>
                        </div>

                        {imageMode === "upload" ? (
                          <div>
                            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                            {!selectedFileBase64 && !directImageUrl ? (
                              <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-white/20 hover:border-cyan-400/50 rounded-2xl p-6 text-center cursor-pointer transition-colors glass-card flex flex-col items-center gap-1.5 group"
                              >
                                <Upload className="w-6 h-6 text-cyan-400 group-hover:scale-110 transition-transform" />
                                <p className="text-xs font-semibold text-slate-200">Select photo from device</p>
                                <p className="text-[10px] text-slate-500">PNG, JPG or WebP · up to 10MB</p>
                              </div>
                            ) : (
                              <div className="rounded-2xl overflow-hidden glass-card border border-cyan-500/40 p-2.5 flex items-center gap-3">
                                <img
                                  src={selectedFileBase64 || directImageUrl}
                                  alt="Preview"
                                  className="w-16 h-16 rounded-xl object-cover shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-white truncate">{selectedFileName || "Image selected"}</p>
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-[11px] text-cyan-300 hover:underline cursor-pointer mt-1"
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
                              placeholder="https://…"
                              className="w-full px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                            />
                            {directImageUrl.trim() && (
                              <div className="mt-2 rounded-xl overflow-hidden w-full glass-card border border-white/10 bg-[#07090f] flex items-center justify-center">
                                <img src={directImageUrl} alt="URL preview" className="w-full max-h-36 object-contain" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Form actions */}
                      <div className="pt-1 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          disabled={isFormSubmitting}
                          onClick={() => { setView("library"); resetForm(); }}
                          className="px-4 py-2.5 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isFormSubmitting}
                          className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isFormSubmitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /><span>{view === "edit" ? "Updating…" : "Sealing…"}</span></>
                          ) : (
                            <><Sparkles className="w-4 h-4 text-cyan-200" /><span>{view === "edit" ? "Save Changes" : "Seal in Vault"}</span></>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ══ MEMORY DETAIL LIGHTBOX ════════════════════════════════════ */}
        <AnimatePresence>
          {selectedMemory && (
            <div
              className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-lg"
              onClick={() => setSelectedMemory(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="relative w-full max-w-2xl sm:max-h-[90vh] h-[92dvh] sm:h-auto glass-panel rounded-t-3xl sm:rounded-3xl border border-white/20 overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag handle – mobile */}
                <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Close */}
                <button
                  type="button"
                  onClick={() => setSelectedMemory(null)}
                  aria-label="Close"
                  className="absolute top-4 right-4 z-10 p-2 rounded-full text-white/80 hover:text-white bg-black/60 backdrop-blur-md border border-white/20 transition-colors cursor-pointer active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Cover image */}
                {selectedMemory.imageUrl && (
                  <div className="relative w-full overflow-hidden bg-[#07090f] shrink-0 flex items-center justify-center">
                    <img
                      src={selectedMemory.imageUrl}
                      alt={selectedMemory.title}
                      onClick={() => setLightboxSrc(selectedMemory.imageUrl)}
                      className="w-full max-h-72 sm:max-h-80 object-contain cursor-zoom-in"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d1d] via-transparent to-transparent pointer-events-none" />
                  </div>
                )}

                {/* Detail content */}
                <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-5 sm:p-6">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <Badge className="bg-cyan-500/20 border-cyan-500/30 text-cyan-300">
                      {selectedMemory.year} Horizon
                    </Badge>
                    {selectedMemory.visibility === "private" ? (
                      <Badge className="bg-amber-500/20 border-amber-500/30 text-amber-300">
                        <Lock className="w-2.5 h-2.5" /> Private
                      </Badge>
                    ) : (
                      <Badge className="bg-cyan-500/10 border-cyan-500/25 text-cyan-300">
                        <Globe className="w-2.5 h-2.5" /> Public
                      </Badge>
                    )}
                    {isStaff && selectedMemory.visibility !== "private" && (
                      <Badge
                        className={
                          selectedMemory.isApproved === false
                            ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                            : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                        }
                      >
                        {selectedMemory.isApproved === false ? (
                          <>
                            <EyeOff className="w-2.5 h-2.5" /> Unapproved
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                          </>
                        )}
                      </Badge>
                    )}
                    {selectedMemory.createdAt && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {new Date(selectedMemory.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-2xl font-extrabold text-white leading-tight">{selectedMemory.title}</h3>

                  <div className="flex items-center gap-2 mt-2 mb-4 text-xs text-slate-300">
                    <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-medium">{selectedMemory.authorName || "Anonymous"}</span>
                  </div>

                  <div className="glass-card rounded-2xl p-4 sm:p-5 border border-white/10 relative">
                    <span className="text-2xl font-serif text-cyan-400/30 absolute top-2 left-3">"</span>
                    <p className="text-slate-200 text-sm leading-relaxed pl-5 font-light whitespace-pre-line">
                      {selectedMemory.story}
                    </p>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {canManageMemory(selectedMemory) && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(selectedMemory)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-card text-xs font-semibold text-cyan-300 hover:text-white border border-cyan-500/30 hover:border-cyan-400/60 transition-colors cursor-pointer active:scale-95"
                          >
                            <Edit2 className="w-3.5 h-3.5" />Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setMemoryToDelete(selectedMemory)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass-card text-xs font-semibold text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-400/60 transition-colors cursor-pointer active:scale-95"
                          >
                            <Trash2 className="w-3.5 h-3.5" />Delete
                          </button>
                        </>
                      )}
                      {isStaff && selectedMemory.visibility !== "private" && (
                        <button
                          type="button"
                          disabled={isUpdatingApproval}
                          onClick={() => handleToggleApproval(selectedMemory)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                            selectedMemory.isApproved === false
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                              : "glass-card text-amber-300 hover:text-white border-amber-500/30 hover:border-amber-400/60"
                          }`}
                        >
                          {isUpdatingApproval ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : selectedMemory.isApproved === false ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span>{selectedMemory.isApproved === false ? "Approve" : "Unapprove"}</span>
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMemory(null)}
                      className="ml-auto px-5 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer active:scale-95"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ══ DELETE CONFIRMATION ═══════════════════════════════════════ */}
        <AnimatePresence>
          {memoryToDelete && (
            <div
              className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setMemoryToDelete(null)}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 320 }}
                className="w-full max-w-sm glass-panel rounded-2xl border border-rose-500/25 p-6 shadow-2xl text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-11 h-11 mx-auto rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h4 className="text-base font-bold text-white">Delete Memory?</h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Are you sure you want to remove <span className="text-white font-semibold">"{memoryToDelete.title}"</span> from the vault? This cannot be undone.
                </p>
                <div className="mt-5 flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setMemoryToDelete(null)}
                    className="flex-1 py-2.5 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-white/25 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Deleting…</> : "Delete Memory"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ══ COLLECTION CREATE / RENAME ════════════════════════════════ */}
        <AnimatePresence>
          {showCreateCollectionModal && (
            <div
              className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setShowCreateCollectionModal(false)}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 320 }}
                className="w-full max-w-sm glass-panel rounded-2xl border border-white/20 p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">
                      {editingCollection ? "Rename Collection" : "New Collection"}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateCollectionModal(false)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleSaveCollection} className="space-y-4">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="e.g. Family, Midnight Celebrations…"
                    maxLength={40}
                    className="w-full px-3.5 py-2.5 rounded-xl glass-card border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400/50 transition-colors"
                    autoFocus
                    required
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateCollectionModal(false)}
                      className="px-4 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer"
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

      {/* ── Full-screen image lightbox ──────────────────────────────────── */}
      <ImageLightbox
        src={lightboxSrc ?? ""}
        alt="Memory image"
        isOpen={lightboxSrc !== null}
        onClose={() => setLightboxSrc(null)}
      />
    </>
  );
}
