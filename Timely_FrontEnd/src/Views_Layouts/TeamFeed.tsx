import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "./ThemeContext";
import { getGradient } from "../Style_Components/Navbar";
import { Heart, Trash2, Send, RefreshCw, AlertCircle, X, AlertTriangle } from "lucide-react";

const API_BASE = "/api";

interface Post {
    postId: string;
    authorName: string;
    authorEmail: string;
    authorRole: string;
    content: string;
    createdAt: string;
    likes: number;
    likedByUser: boolean;
}

interface TeamFeedProps {
    userName: string;
    userEmail: string;
    userRole?: "admin" | "consultant" | "client";
    maxPosts?: number;
    compact?: boolean;
    className?: string;
}

const TeamFeed: React.FC<TeamFeedProps> = ({
    userName,
    userEmail,
    userRole = "consultant",
    maxPosts = 20,
    compact = false,
    className = "",
}) => {
    const { isDark } = useTheme();

    const hover = isDark ? "hover:bg-blue-500/10" : "hover:bg-blue-50";
    const gb = isDark ? "group-hover:text-blue-400" : "group-hover:text-blue-600";

    const n = {
        text: isDark ? "text-white" : "text-gray-900",
        secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-400" : "text-gray-500",
        label: isDark ? "text-blue-400" : "text-blue-600",
        link: isDark ? "text-blue-400" : "text-blue-600",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat",
        inset: isDark ? "neu-dark-inset" : "neu-light-inset",
        card: isDark ? "neu-dark" : "neu-light",
        input: isDark
            ? "bg-transparent border-gray-800 text-white placeholder-gray-600"
            : "bg-transparent border-gray-300 text-gray-900 placeholder-gray-400",
        divider: isDark ? "border-gray-800" : "border-gray-200",
        modal: isDark ? "bg-[#111111] border-gray-800" : "bg-white border-gray-200",
    };

    const [posts, setPosts] = useState<Post[]>([]);
    const [newPost, setNewPost] = useState("");
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchPosts = useCallback(async () => {
        try {
            setError(null);
            const res = await fetch(`${API_BASE}/team-feed?limit=${maxPosts}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const result = await res.json();
            setPosts(result.data || []);
        } catch (err) {
            console.error("Error fetching team feed:", err);
            setError("Failed to load posts");
        } finally {
            setLoading(false);
        }
    }, [maxPosts]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const handlePost = async () => {
        if (!newPost.trim() || posting) return;
        setPosting(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/team-feed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newPost.trim() }),
            });
            if (!res.ok) throw new Error("Failed to post");
            const result = await res.json();
            if (result.post) setPosts((prev) => [result.post, ...prev]);
            else await fetchPosts();
            setNewPost("");
        } catch (err) {
            console.error("Error creating post:", err);
            setError("Failed to create post");
        } finally {
            setPosting(false);
        }
    };

    const handleLike = async (postId: string, liked: boolean) => {
        try {
            const res = await fetch(`${API_BASE}/team-feed/${postId}/${liked ? "unlike" : "like"}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) throw new Error("Failed");
            const result = await res.json();
            setPosts((prev) =>
                prev.map((p) =>
                    p.postId === postId
                        ? { ...p, likes: result.likes ?? (liked ? p.likes - 1 : p.likes + 1), likedByUser: !liked }
                        : p
                )
            );
        } catch (err) {
            console.error("Error toggling like:", err);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`${API_BASE}/team-feed/${deleteTarget.postId}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) throw new Error("Failed");
            setPosts((prev) => prev.filter((p) => p.postId !== deleteTarget.postId));
            setDeleteTarget(null);
        } catch (err: any) {
            console.error("Error deleting:", err);
            setError("Failed to delete post");
            setDeleteTarget(null);
        } finally {
            setDeleting(false);
        }
    };

    const fmtTime = (ts: string) => {
        if (!ts) return "";
        const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    };

    const initials = (name: string) =>
        name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

    return (
        <div className={className}>
            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={() => !deleting && setDeleteTarget(null)}>
                    <div className={`${n.modal} border rounded-2xl w-full max-w-sm animate-fadeIn`} onClick={e => e.stopPropagation()}>
                        {/* Icon */}
                        <div className="pt-6 pb-2 flex justify-center">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? "bg-red-500/15" : "bg-red-50"}`}>
                                <Trash2 className={`w-5 h-5 ${isDark ? "text-red-400" : "text-red-500"}`} />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-6 pb-2 text-center">
                            <h3 className={`text-lg font-semibold ${n.text} mb-1`}>Delete Post</h3>
                            <p className={`text-sm ${n.secondary}`}>
                                This will permanently remove this post from the team feed. This action cannot be undone.
                            </p>
                        </div>

                        {/* Preview */}
                        <div className={`mx-6 my-3 p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-gray-50"} border ${n.divider}`}>
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className={`w-5 h-5 bg-gradient-to-br ${getGradient(deleteTarget.authorName, deleteTarget.authorEmail)} rounded-full flex items-center justify-center text-[7px] font-semibold text-white`}>
                                    {initials(deleteTarget.authorName)}
                                </div>
                                <span className={`text-xs font-medium ${n.text}`}>{deleteTarget.authorName}</span>
                                <span className={`text-[10px] ${n.tertiary}`}>{fmtTime(deleteTarget.createdAt)}</span>
                            </div>
                            <p className={`text-xs ${n.secondary} line-clamp-2`}>{deleteTarget.content}</p>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 pt-2 flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isDark ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-800"} disabled:opacity-50`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 text-red-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
                </div>
            )}

            {/* Compose */}
            <div className={`flex gap-3 pb-5 mb-5 border-b ${n.divider}`}>
                <div className={`w-8 h-8 bg-gradient-to-br ${getGradient(userName, userEmail)} rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0`}>
                    {initials(userName)}
                </div>
                <div className="flex-1">
                    <textarea
                        value={newPost}
                        onChange={(e) => setNewPost(e.target.value)}
                        placeholder="Share an update..."
                        className={`w-full ${n.input} border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-blue-500/40 transition-colors`}
                        rows={2}
                        disabled={posting}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost();
                        }}
                    />
                    <div className="flex justify-between items-center mt-2">
                        <span className={`text-[10px] ${n.tertiary}`}>⌘ + Enter to post</span>
                        <button
                            onClick={handlePost}
                            disabled={!newPost.trim() || posting}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                                ${newPost.trim()
                                    ? `${n.link} ${hover}`
                                    : `${n.tertiary} cursor-not-allowed`}`}
                        >
                            {posting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Post
                        </button>
                    </div>
                </div>
            </div>

            {/* Posts */}
            {loading && posts.length === 0 ? (
                <div className="flex justify-center py-8">
                    <RefreshCw className={`w-5 h-5 ${n.tertiary} animate-spin`} />
                </div>
            ) : posts.length === 0 ? (
                <div className={`text-center py-8 ${n.secondary}`}>
                    <p className="text-xs">No posts yet. Be the first to share.</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {posts.map((post) => (
                        <div
                            key={post.postId}
                            className={`${n.flat} ${hover} group p-4 transition-all duration-200 rounded-xl`}
                        >
                            <div className="flex gap-3">
                                <div className={`w-8 h-8 bg-gradient-to-br ${getGradient(post.authorName, post.authorEmail)} rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0`}>
                                    {initials(post.authorName)}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-medium ${n.text} ${gb} transition-colors`}>
                                            {post.authorName}
                                        </span>
                                        {post.authorRole === "admin" && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-100 text-blue-700"}`}>
                                                Admin
                                            </span>
                                        )}
                                        <span className={`text-[11px] ${n.tertiary}`}>
                                            {fmtTime(post.createdAt)}
                                        </span>
                                    </div>

                                    <p className={`text-sm mt-1.5 ${n.secondary} whitespace-pre-wrap break-words leading-relaxed`}>
                                        {post.content}
                                    </p>

                                    <div className="flex items-center gap-4 mt-2.5">
                                        <button
                                            onClick={() => handleLike(post.postId, post.likedByUser)}
                                            className={`flex items-center gap-1 text-[11px] transition-colors
                                                ${post.likedByUser
                                                    ? "text-pink-500"
                                                    : `${n.tertiary} hover:text-pink-500`}`}
                                        >
                                            <Heart className={`w-3.5 h-3.5 ${post.likedByUser ? "fill-current" : ""}`} />
                                            {post.likes > 0 && <span>{post.likes}</span>}
                                        </button>

                                        {(post.authorEmail === userEmail || userRole === "admin") && (
                                            <button
                                                onClick={() => setDeleteTarget(post)}
                                                className={`text-[11px] ${n.tertiary} hover:text-red-400 transition-colors`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TeamFeed;