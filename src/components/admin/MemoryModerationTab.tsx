"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Search,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User as UserIcon,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Filter,
} from "lucide-react";
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

interface MemoriesApiResponse {
  memories: MemoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  message?: string;
}

interface MemoryModerationTabProps {
  onShowToast: (text: string, type?: "success" | "error") => void;
}

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

export default function MemoryModerationTab({ onShowToast }: MemoryModerationTabProps) {
  // Memories & State
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [totalMemories, setTotalMemories] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState<"all" | "approved" | "unapproved">("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modals & Action States
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<MemoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch Public Memories
  const fetchMemories = useCallback(
    async (targetPage = page, isManualRefresh = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams();
        // Strictly request public memories only — never private
        params.append("visibility", "public");
        params.append("page", String(targetPage));
        params.append("limit", String(limit));

        if (debouncedSearch) {
          params.append("search", debouncedSearch);
        }

        if (filterStatus === "approved") {
          params.append("isApproved", "true");
        } else if (filterStatus === "unapproved") {
          params.append("isApproved", "false");
        }

        const res = await fetch(`${SERVER_URL}/api/memories?${params.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (res.status === 401 || res.status === 403) {
          throw new Error("You are not authorized to moderate memories. Administrator role required.");
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.message || `Failed to fetch memories (HTTP ${res.status})`);
        }

        const data: MemoriesApiResponse = await res.json();
        setMemories(data.memories || []);
        setTotalMemories(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || targetPage);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load memories";
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, limit, debouncedSearch, filterStatus]
  );

  // Trigger fetch when filter or debounced search changes
  useEffect(() => {
    fetchMemories(page);
  }, [fetchMemories, page]);

  // Handle Approve / Unapprove Toggle
  const handleToggleApproval = async (memory: MemoryItem) => {
    const nextApproved = memory.isApproved === false;
    setUpdatingId(memory._id);

    try {
      const res = await fetch(`${SERVER_URL}/api/memories/${memory._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ isApproved: nextApproved }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to update memory approval status");
      }

      const updatedDoc: MemoryItem = await res.json();

      // Update in memory list
      setMemories((prev) =>
        prev.map((m) =>
          m._id === memory._id ? { ...m, isApproved: updatedDoc.isApproved } : m
        )
      );

      // If active in detail view, update detail state as well
      if (selectedMemory && selectedMemory._id === memory._id) {
        setSelectedMemory((prev) =>
          prev ? { ...prev, isApproved: updatedDoc.isApproved } : null
        );
      }

      onShowToast(
        nextApproved
          ? `Memory "${memory.title}" approved successfully.`
          : `Memory "${memory.title}" unapproved.`,
        "success"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update approval";
      onShowToast(msg, "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    if (!memoryToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`${SERVER_URL}/api/memories/${memoryToDelete._id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to delete memory");
      }

      // Remove from state
      setMemories((prev) => prev.filter((m) => m._id !== memoryToDelete._id));
      setTotalMemories((prev) => Math.max(0, prev - 1));

      // If selected memory was the one deleted, close detail modal
      if (selectedMemory?._id === memoryToDelete._id) {
        setSelectedMemory(null);
      }

      onShowToast(`Memory "${memoryToDelete.title}" deleted permanently.`, "success");
      setMemoryToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete memory";
      onShowToast(msg, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper date formatter
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* ── SUBHEADER & ACTION BAR ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Memory Moderation
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
              {totalMemories} {totalMemories === 1 ? "Memory" : "Memories"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review community public memories, manage approval status, and curate memory content.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            disabled={isRefreshing || isLoading}
            onClick={() => fetchMemories(page, true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-amber-400/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh Memory List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ───────────────────────────────────── */}
      <div className="w-full glass-panel rounded-2xl p-3 sm:p-4 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or author name…"
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50 transition-colors"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400 hover:text-white p-0.5 cursor-pointer"
              title="Clear Search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills: All / Approved / Unapproved */}
        <div className="flex items-center gap-1.5 w-full md:w-auto bg-black/40 p-1 rounded-xl border border-white/10 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setFilterStatus("all");
              setPage(1);
            }}
            className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === "all"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All Public
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterStatus("approved");
              setPage(1);
            }}
            className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === "approved"
                ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Approved</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterStatus("unapproved");
              setPage(1);
            }}
            className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              filterStatus === "unapproved"
                ? "bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <EyeOff className="w-3 h-3 text-rose-400" />
            <span>Unapproved</span>
          </button>
        </div>
      </div>

      {/* ── ERROR STATE ───────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Failed to load memories</p>
              <p className="mt-0.5 text-xs text-rose-300/80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchMemories(page, true)}
            className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── LOADING SKELETON ──────────────────────────────────────────── */}
      {isLoading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="glass-card rounded-2xl p-3.5 border border-white/10 animate-pulse flex flex-col gap-3"
            >
              <div className="w-full aspect-video rounded-xl bg-white/10" />
              <div className="space-y-2">
                <div className="w-3/4 h-4 rounded bg-white/10" />
                <div className="w-full h-3 rounded bg-white/5" />
                <div className="w-1/2 h-3 rounded bg-white/5" />
              </div>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <div className="w-20 h-5 rounded-full bg-white/10" />
                <div className="w-16 h-7 rounded-lg bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EMPTY STATES ──────────────────────────────────────────────── */}
      {!isLoading && !error && memories.length === 0 && (
        <div className="glass-panel rounded-3xl p-8 sm:p-12 text-center border border-white/10 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center">
            <Compass className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white">
            {debouncedSearch
              ? "No matching memories found"
              : filterStatus !== "all"
              ? `No ${filterStatus} public memories`
              : "No public memories"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
            {debouncedSearch
              ? `No public memories matched "${debouncedSearch}". Try a different title or author.`
              : filterStatus !== "all"
              ? `There are currently no public memories with status "${filterStatus}".`
              : "No community public memories have been shared yet."}
          </p>
          {(debouncedSearch || filterStatus !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setDebouncedSearch("");
                setFilterStatus("all");
                setPage(1);
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* ── MEMORY CARD GRID (Mobile Cards First & Responsive Desktop Grid) ── */}
      {!isLoading && !error && memories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {memories.map((memory) => {
            const isUpdating = updatingId === memory._id;
            const isApproved = memory.isApproved !== false;

            return (
              <div
                key={memory._id}
                className="glass-card rounded-2xl p-3.5 sm:p-4 border border-white/10 hover:border-amber-400/30 transition-all flex flex-col justify-between gap-3 group"
              >
                {/* Image Thumbnail & Overlay Badges */}
                <div
                  onClick={() => setSelectedMemory(memory)}
                  className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#07090f] border border-white/10 cursor-pointer group-hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-shadow"
                >
                  <img
                    src={memory.imageUrl}
                    alt={memory.title}
                    onError={(e) => {
                      // Fallback icon styling on broken URL
                      e.currentTarget.style.display = "none";
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxSrc(memory.imageUrl);
                    }}
                    className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300 cursor-zoom-in"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Status Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    {isApproved ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/80 text-white backdrop-blur-md border border-emerald-400/50 flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Approved
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/80 text-white backdrop-blur-md border border-rose-400/50 flex items-center gap-1 shadow-sm">
                        <EyeOff className="w-2.5 h-2.5" />
                        Unapproved
                      </span>
                    )}
                  </div>

                  {/* Target Year Pill */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                      {memory.year}
                    </span>
                  </div>

                  {/* Quick View Pill on Hover */}
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-black/80 text-white border border-white/20 flex items-center gap-1 backdrop-blur-md">
                      <Eye className="w-3 h-3 text-cyan-300" />
                      View
                    </span>
                  </div>
                </div>

                {/* Content Snippet */}
                <div className="flex-1 min-w-0">
                  <h3
                    onClick={() => setSelectedMemory(memory)}
                    className="text-sm sm:text-base font-bold text-white line-clamp-1 hover:text-amber-300 cursor-pointer transition-colors"
                    title={memory.title}
                  >
                    {memory.title}
                  </h3>

                  <p className="text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                    {memory.story}
                  </p>

                  <div className="flex items-center gap-2 mt-2.5 text-[11px] text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1 text-slate-300 font-medium truncate max-w-[140px]">
                      <UserIcon className="w-3 h-3 text-amber-400 shrink-0" />
                      {memory.authorName || "Anonymous"}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      {formatDate(memory.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMemory(memory)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-cyan-400/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Details</span>
                  </button>

                  {/* Toggle Approval Button */}
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleToggleApproval(memory)}
                    title={isApproved ? "Click to Unapprove" : "Click to Approve"}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 ${
                      isApproved
                        ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 hover:border-amber-400/60"
                        : "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:border-emerald-400"
                    }`}
                  >
                    {isUpdating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isApproved ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden xs:inline">Unapprove</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden xs:inline">Approve</span>
                      </>
                    )}
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => setMemoryToDelete(memory)}
                    title="Delete Memory"
                    className="p-2 rounded-xl glass-card text-slate-400 hover:text-rose-300 hover:border-rose-500/40 border border-white/10 transition-colors cursor-pointer active:scale-95 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PAGINATION TOOLBAR ─────────────────────────────────────────── */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="w-full glass-panel rounded-2xl p-3 sm:p-4 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing{" "}
            <span className="text-white font-semibold">
              {(page - 1) * limit + 1}
            </span>{" "}
            to{" "}
            <span className="text-white font-semibold">
              {Math.min(page * limit, totalMemories)}
            </span>{" "}
            of <span className="text-white font-semibold">{totalMemories}</span> memories
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="p-2 rounded-xl glass-card border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer active:scale-95"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="p-2 rounded-xl glass-card border border-white/10 text-slate-300 hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer active:scale-95"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── MEMORY DETAILS MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {selectedMemory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl max-h-[90vh] glass-panel rounded-3xl border border-white/15 p-4 sm:p-6 flex flex-col gap-4 shadow-2xl overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg glass-card flex items-center justify-center text-amber-400 border border-amber-500/30">
                    <Compass className="w-4 h-4" />
                  </span>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1">
                      {selectedMemory.title}
                    </h2>
                    <span className="text-[11px] text-slate-400">
                      Target Year {selectedMemory.year}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMemory(null)}
                  className="p-1.5 rounded-lg glass-card text-slate-400 hover:text-white border border-white/10 cursor-pointer"
                  title="Close Details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Full Image Display */}
              <div className="relative w-full rounded-2xl overflow-hidden bg-black/50 border border-white/10 max-h-72 sm:max-h-80 flex items-center justify-center">
                <img
                  src={selectedMemory.imageUrl}
                  alt={selectedMemory.title}
                  onClick={() => setLightboxSrc(selectedMemory.imageUrl)}
                  className="w-full h-full object-contain max-h-72 sm:max-h-80 cursor-zoom-in"
                />
              </div>

              {/* Memory Story Content */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 font-medium flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                      {selectedMemory.authorName || "Anonymous"}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(selectedMemory.createdAt)}
                    </span>
                  </div>

                  {selectedMemory.isApproved !== false ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Approved
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                      <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                      Unapproved
                    </span>
                  )}
                </div>

                <div className="bg-black/40 rounded-2xl p-4 border border-white/10 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {selectedMemory.story}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMemoryToDelete(selectedMemory);
                  }}
                  className="px-3.5 py-2 rounded-xl glass-card text-xs font-semibold text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Memory</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={updatingId === selectedMemory._id}
                    onClick={() => handleToggleApproval(selectedMemory)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      selectedMemory.isApproved !== false
                        ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40"
                        : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/40"
                    }`}
                  >
                    {updatingId === selectedMemory._id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : selectedMemory.isApproved !== false ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                        <span>Unapprove</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Approve</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMemory(null)}
                    className="px-4 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DELETE CONFIRMATION MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {memoryToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-panel rounded-3xl border border-rose-500/30 p-5 sm:p-6 flex flex-col gap-4 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center border border-rose-500/40 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Delete Public Memory?
                  </h3>
                  <p className="text-xs text-rose-300/80">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>

              <div className="bg-black/40 rounded-2xl p-3.5 border border-white/10 text-xs text-slate-300 space-y-1">
                <p>
                  <strong className="text-white">Title:</strong> {memoryToDelete.title}
                </p>
                <p>
                  <strong className="text-white">Author:</strong> {memoryToDelete.authorName || "Anonymous"}
                </p>
                <p>
                  <strong className="text-white">Target Year:</strong> {memoryToDelete.year}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setMemoryToDelete(null)}
                  className="px-4 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(225,29,72,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Permanently</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Full-screen image lightbox ──────────────────────────────────── */}
      <ImageLightbox
        src={lightboxSrc ?? ""}
        alt="Memory image"
        isOpen={lightboxSrc !== null}
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  );
}
