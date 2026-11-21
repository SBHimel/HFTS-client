"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  User as UserIcon,
  Search,
  X,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Loader2,
  Lock,
  LogOut,
  Sparkles,
  Compass,
} from "lucide-react";
import { authClient } from "@/lib/authClient";
import StarryBackground from "@/components/ui/StarryBackground";
import MemoryModerationTab from "@/components/admin/MemoryModerationTab";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "moderator" | "admin";
  image: string | null;
  createdAt?: string;
}

interface UsersApiResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  message?: string;
}

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:5000";

export default function AdminDashboardPage() {
  // Authentication & Session
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const currentUserRole = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = currentUserRole === "admin";

  // State
  const [activeTab, setActiveTab] = useState<"users" | "memories">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Role Confirmation Dialog
  const [roleModalTarget, setRoleModalTarget] = useState<{
    user: AdminUser;
    targetRole: "user" | "moderator";
  } | null>(null);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Toast Feedback
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1); // Reset to page 1 on new search
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch users function
  const fetchUsers = useCallback(
    async (targetPage: number = 1, showRefreshSpinner = false) => {
      if (showRefreshSpinner) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          page: String(targetPage),
          limit: String(limit),
        });

        if (debouncedSearch) {
          queryParams.set("search", debouncedSearch);
        }

        const res = await fetch(`${SERVER_URL}/api/admin/users?${queryParams.toString()}`, {
          credentials: "include",
        });

        if (res.status === 401) {
          throw new Error("Authentication required. Please sign in as an Administrator.");
        }
        if (res.status === 403) {
          throw new Error("Forbidden: You do not have administrator permissions to view this resource.");
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Server returned error (${res.status})`);
        }

        const data: UsersApiResponse = await res.json();
        setUsers(data.users || []);
        setTotalUsers(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setHasMore(Boolean(data.hasMore));
        setPage(data.page || targetPage);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError(err instanceof Error ? err.message : "Failed to load users from server.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [limit, debouncedSearch]
  );

  // Initial fetch and on search change
  useEffect(() => {
    if (isAdmin) {
      fetchUsers(page, false);
    }
  }, [isAdmin, debouncedSearch, page, fetchUsers]);

  // Handle role update
  const handleConfirmRoleChange = async () => {
    if (!roleModalTarget) return;
    const { user, targetRole } = roleModalTarget;

    try {
      setIsSubmittingRole(true);

      const res = await fetch(`${SERVER_URL}/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ role: targetRole }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to update user role");
      }

      showToast(
        `Successfully updated ${user.name || user.email}'s role to ${targetRole.toUpperCase()}`,
        "success"
      );
      setRoleModalTarget(null);
      // Refresh current page
      await fetchUsers(page, true);
    } catch (err) {
      console.error("Error updating role:", err);
      showToast(err instanceof Error ? err.message : "Failed to update role", "error");
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // ── Render: Session Loading ────────────────────────────────────────────────
  if (isSessionLoading) {
    return (
      <main className="min-h-screen relative flex items-center justify-center p-4">
        <StarryBackground />
        <div className="relative z-10 glass-panel rounded-2xl p-8 border border-white/10 text-center max-w-sm mx-auto shadow-2xl flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-sm font-semibold text-slate-200">Verifying Admin Credentials…</p>
        </div>
      </main>
    );
  }

  // ── Render: Unauthorized / Access Denied ───────────────────────────────────
  if (!session?.user || !isAdmin) {
    return (
      <main className="min-h-screen relative flex items-center justify-center p-4">
        <StarryBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 glass-panel rounded-3xl p-6 sm:p-8 border border-rose-500/30 text-center max-w-md mx-auto shadow-2xl"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">Access Restricted</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            {!session?.user
              ? "You must be signed in with an administrator account to access the Admin Control Center."
              : `Signed in as ${session.user.email} (${currentUserRole || "user"}), which lacks administrator clearance.`}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link
              href="/"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Horizon</span>
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  // ── Render: Admin Dashboard ────────────────────────────────────────────────
  return (
    <main className="min-h-screen relative text-slate-100 flex flex-col overflow-x-hidden">
      <StarryBackground />

      {/* ── TOP HEADER BAR ──────────────────────────────────────────────── */}
      <header className="relative z-20 w-full px-4 py-3.5 sm:px-6 sm:py-4 border-b border-white/10 glass-panel shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Brand + Admin Pill */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <Link
              href="/"
              title="Exit to Horizon"
              className="p-2 rounded-xl glass-card text-slate-300 hover:text-white border border-white/10 hover:border-amber-400/40 transition-colors shrink-0 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl glass-card flex items-center justify-center text-amber-400 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-cyan-200 truncate">
                  HFTS HORIZON
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Admin Control
                </span>
              </div>
            </div>
          </div>

          {/* Right: Authenticated Admin Profile & Sign Out */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl glass-card border border-white/10 text-xs">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold border border-amber-500/40">
                {session.user.name ? session.user.name[0]?.toUpperCase() : "A"}
              </div>
              <span className="text-slate-300 font-medium truncate max-w-[140px]">
                {session.user.name || session.user.email}
              </span>
            </div>

            <button
              type="button"
              onClick={async () => {
                await authClient.signOut();
                window.location.href = "/";
              }}
              title="Sign Out"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl glass-card text-xs font-semibold text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ──────────────────────────────────────── */}
      <div className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 py-5 sm:px-6 sm:py-8 flex flex-col gap-5 sm:gap-6">

        {/* ── SECTION NAVIGATION TABS ───────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeTab === "users"
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                : "text-slate-400 hover:text-white glass-card border border-white/5"
            }`}
          >
            <UserIcon className="w-4 h-4 text-cyan-400" />
            <span>User Management</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("memories")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeTab === "memories"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                : "text-slate-400 hover:text-white glass-card border border-white/5"
            }`}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            <span>Memory Moderation</span>
          </button>
        </div>

        {/* ── TOAST ALERT ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg ${
                toast.type === "success"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                  : "bg-rose-500/15 border-rose-500/30 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {toast.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-medium truncate">{toast.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-white shrink-0 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === "users" ? (
          <>
            {/* Page Title & Subtitle Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    User Management
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                    {totalUsers} {totalUsers === 1 ? "User" : "Users"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Browse registered accounts, audit permissions, and manage moderator privileges.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={isRefreshing || isLoading}
                  onClick={() => fetchUsers(page, true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-cyan-400/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Refresh User List"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

        {/* ── SEARCH TOOLBAR ────────────────────────────────────────────── */}
        <div className="w-full glass-panel rounded-2xl p-3 sm:p-4 border border-white/10 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by user name or email address…"
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
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
        </div>

        {/* ── ERROR STATE ───────────────────────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs sm:text-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-300">Failed to load users</p>
                <p className="mt-0.5 text-xs text-rose-300/80">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchUsers(page, true)}
              className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-100 text-xs font-semibold transition-colors shrink-0 cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── LOADING SKELETON ──────────────────────────────────────────── */}
        {isLoading && !error && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="glass-card rounded-2xl p-4 border border-white/10 animate-pulse flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="w-32 h-4 rounded bg-white/10" />
                    <div className="w-48 h-3 rounded bg-white/5" />
                  </div>
                </div>
                <div className="w-20 h-6 rounded-full bg-white/10 shrink-0" />
                <div className="hidden sm:block w-28 h-8 rounded-xl bg-white/10 shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* ── EMPTY STATES ──────────────────────────────────────────────── */}
        {!isLoading && !error && users.length === 0 && (
          <div className="glass-panel rounded-3xl p-8 sm:p-12 text-center border border-white/10 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center">
              <UserIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {debouncedSearch ? "No matching users found" : "No registered users"}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
              {debouncedSearch
                ? `No accounts matched your search "${debouncedSearch}". Try a different name or email.`
                : "No user accounts have registered on the platform yet."}
            </p>
            {debouncedSearch && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="mt-2 px-4 py-2 rounded-xl glass-card text-xs font-semibold text-cyan-300 hover:text-white border border-cyan-500/30 transition-colors cursor-pointer"
              >
                Clear Search Query
              </button>
            )}
          </div>
        )}

        {/* ── USER LIST: MOBILE CARDS (< 768px) ─────────────────────────── */}
        {!isLoading && !error && users.length > 0 && (
          <>
            <div className="block md:hidden space-y-3">
              {users.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                const isUserAdmin = user.role === "admin";

                return (
                  <div
                    key={user.id}
                    className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col gap-3 relative overflow-hidden"
                  >
                    {/* Header: Avatar, Name, Email, Role */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name || user.email}
                            className={`w-10 h-10 rounded-full object-cover shrink-0 border ${
                              user.role === "admin"
                                ? "border-amber-400/60"
                                : user.role === "moderator"
                                ? "border-purple-400/60"
                                : "border-white/20"
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                              user.role === "admin"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : user.role === "moderator"
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                : "bg-slate-700/50 text-slate-300 border-white/15"
                            }`}
                          >
                            {user.name ? user.name[0]?.toUpperCase() : user.email[0]?.toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-white truncate leading-tight">
                              {user.name || "Unnamed User"}
                            </h4>
                            {isCurrentUser && (
                              <span className="text-[10px] text-amber-300/80 font-medium">(You)</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
                        </div>
                      </div>

                      {/* Role Badge */}
                      <RoleBadge role={user.role} />
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/5 text-[11px] text-slate-400 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </span>
                      </div>

                      {/* Action Button */}
                      <div className="ml-auto">
                        {isCurrentUser ? (
                          <span className="text-[11px] text-slate-500 italic">Self (Admin)</span>
                        ) : isUserAdmin ? (
                          <span className="text-[11px] text-slate-500 italic flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Protected
                          </span>
                        ) : user.role === "moderator" ? (
                          <button
                            type="button"
                            onClick={() =>
                              setRoleModalTarget({ user, targetRole: "user" })
                            }
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg glass-card text-xs font-semibold text-amber-300 hover:text-white border border-amber-500/30 hover:border-amber-400/60 transition-colors cursor-pointer active:scale-95"
                          >
                            <ArrowDownRight className="w-3 h-3" />
                            <span>Demote to User</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setRoleModalTarget({ user, targetRole: "moderator" })
                            }
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/40 hover:border-purple-400/60 transition-colors cursor-pointer active:scale-95"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            <span>Promote to Mod</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── USER TABLE: DESKTOP (>= 768px) ───────────────────────────── */}
            <div className="hidden md:block glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                      <th className="py-3.5 px-4 sm:px-6">User</th>
                      <th className="py-3.5 px-4">Email</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Joined Date</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((user) => {
                      const isCurrentUser = user.id === currentUserId;
                      const isUserAdmin = user.role === "admin";

                      return (
                        <tr
                          key={user.id}
                          className="hover:bg-white/[0.02] transition-colors group"
                        >
                          {/* User Avatar + Name */}
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              {user.image ? (
                                <img
                                  src={user.image}
                                  alt={user.name || user.email}
                                  className={`w-9 h-9 rounded-full object-cover shrink-0 border ${
                                    user.role === "admin"
                                      ? "border-amber-400/60"
                                      : user.role === "moderator"
                                      ? "border-purple-400/60"
                                      : "border-white/20"
                                  }`}
                                />
                              ) : (
                                <div
                                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border ${
                                    user.role === "admin"
                                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                      : user.role === "moderator"
                                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                      : "bg-slate-700/50 text-slate-300 border-white/15"
                                  }`}
                                >
                                  {user.name ? user.name[0]?.toUpperCase() : user.email[0]?.toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white group-hover:text-cyan-200 transition-colors truncate max-w-[180px]">
                                    {user.name || "Unnamed User"}
                                  </span>
                                  {isCurrentUser && (
                                    <span className="text-[10px] text-amber-300/80 font-medium shrink-0">
                                      (You)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-3.5 px-4 text-slate-300 truncate max-w-[220px]">
                            {user.email}
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-4">
                            <RoleBadge role={user.role} />
                          </td>

                          {/* Joined Date */}
                          <td className="py-3.5 px-4 text-slate-400 text-xs">
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 sm:px-6 text-right">
                            {isCurrentUser ? (
                              <span className="text-xs text-slate-500 italic">Self</span>
                            ) : isUserAdmin ? (
                              <span className="text-xs text-slate-500 italic inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Protected
                              </span>
                            ) : user.role === "moderator" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setRoleModalTarget({ user, targetRole: "user" })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card text-xs font-semibold text-amber-300 hover:text-white border border-amber-500/30 hover:border-amber-400/60 transition-colors cursor-pointer active:scale-95"
                              >
                                <ArrowDownRight className="w-3.5 h-3.5" />
                                <span>Demote to User</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setRoleModalTarget({ user, targetRole: "moderator" })
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/40 hover:border-purple-400/60 transition-colors cursor-pointer active:scale-95"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                <span>Promote to Mod</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── PAGINATION CONTROLS ─────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 pt-2 pb-6 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing page <span className="text-white font-semibold">{page}</span> of{" "}
                <span className="text-white font-semibold">{totalPages}</span> ({totalUsers} total)
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-white/25 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden xs:inline">Previous</span>
                </button>

                <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white">
                  {page} / {totalPages}
                </div>

                <button
                  type="button"
                  disabled={page >= totalPages || !hasMore || isLoading}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:border-white/25 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="hidden xs:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </>
    ) : (
      <MemoryModerationTab onShowToast={showToast} />
    )}
  </div>

      {/* ── ROLE CHANGE CONFIRMATION MODAL ──────────────────────────────── */}
      <AnimatePresence>
        {roleModalTarget && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md"
            onClick={() => {
              if (!isSubmittingRole) setRoleModalTarget(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="relative w-full max-w-md glass-panel rounded-t-3xl sm:rounded-3xl border border-white/20 p-6 sm:p-7 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                disabled={isSubmittingRole}
                onClick={() => setRoleModalTarget(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white glass-card rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Icon & Title */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-md shrink-0 ${
                    roleModalTarget.targetRole === "moderator"
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {roleModalTarget.targetRole === "moderator" ? (
                    <ArrowUpRight className="w-6 h-6 text-purple-400" />
                  ) : (
                    <ArrowDownRight className="w-6 h-6 text-amber-400" />
                  )}
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    {roleModalTarget.targetRole === "moderator"
                      ? "Promote to Moderator"
                      : "Demote to Standard User"}
                  </h3>
                  <p className="text-xs text-slate-400">Confirm role modification</p>
                </div>
              </div>

              {/* Target User Details */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 mb-4 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Target User:</span>
                  <span className="font-bold text-white truncate max-w-[200px]">
                    {roleModalTarget.user.name || "Unnamed User"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-300 truncate max-w-[200px]">
                    {roleModalTarget.user.email}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-white/5">
                  <span className="text-slate-400">Transition:</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="uppercase text-slate-400">
                      {roleModalTarget.user.role}
                    </span>
                    <span className="text-cyan-400">&rarr;</span>
                    <span
                      className={`uppercase ${
                        roleModalTarget.targetRole === "moderator"
                          ? "text-purple-300"
                          : "text-slate-300"
                      }`}
                    >
                      {roleModalTarget.targetRole}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanatory note */}
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                {roleModalTarget.targetRole === "moderator"
                  ? "Moderators can hide/unhide public sky lanterns and approve/unapprove memories, but cannot delete lanterns or view private memories."
                  : "This user will lose moderation privileges and be returned to ordinary user permissions."}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSubmittingRole}
                  onClick={() => setRoleModalTarget(null)}
                  className="flex-1 py-2.5 rounded-xl glass-card text-xs font-semibold text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingRole}
                  onClick={handleConfirmRoleChange}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                    roleModalTarget.targetRole === "moderator"
                      ? "bg-purple-600 hover:bg-purple-500 shadow-purple-600/30"
                      : "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30"
                  }`}
                >
                  {isSubmittingRole ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating…</span>
                    </>
                  ) : (
                    <span>Confirm Role Change</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ── Shared Role Badge Component ──────────────────────────────────────────────
function RoleBadge({ role }: { role: "user" | "moderator" | "admin" }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)] shrink-0">
        <Shield className="w-2.5 h-2.5 text-amber-400" />
        <span>Admin</span>
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)] shrink-0">
        <ShieldCheck className="w-2.5 h-2.5 text-purple-400" />
        <span>Moderator</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-700/40 text-slate-300 border border-white/10 shrink-0">
      <UserIcon className="w-2.5 h-2.5 text-slate-400" />
      <span>User</span>
    </span>
  );
}
