// src/Views_Layouts/TeamFeed.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "./ThemeContext";
import {
    MessageSquare,
    Heart,
    Trash2,
    Send,
    RefreshCw,
    AlertCircle,
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

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
    compact?: boolean; // For smaller displays
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

    const s = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        card: isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:bg-slate-800" : "hover:bg-gray-50",
        cardInner: isDark ? "bg-slate-800" : "bg-gray-100",
        input: isDark
            ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400",
        divider: isDark ? "border-slate-700" : "border-gray-200",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
        buttonDanger: "text-red-400 hover:text-red-300 hover:bg-red-500/10",
    };

    const [posts, setPosts] = useState<Post[]>([]);
    const [newPost, setNewPost] = useState("");
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch posts from API
    const fetchPosts = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch(
                `${API_BASE}/team-feed?userEmail=${encodeURIComponent(userEmail)}&limit=${maxPosts}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch posts");
            }

            const result = await response.json();
            setPosts(result.data || []);
        } catch (err) {
            console.error("Error fetching team feed:", err);
            setError("Failed to load posts");
        } finally {
            setLoading(false);
        }
    }, [userEmail, maxPosts]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // Create a new post
    const handlePost = async () => {
        if (!newPost.trim() || posting) return;

        setPosting(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/team-feed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    authorName: userName,
                    authorEmail: userEmail,
                    authorRole: userRole,
                    content: newPost.trim(),
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to create post");
            }

            const result = await response.json();

            // Add new post to the top of the list
            if (result.post) {
                setPosts((prev) => [result.post, ...prev]);
            } else {
                // Refetch if we don't get the post back
                await fetchPosts();
            }

            setNewPost("");
        } catch (err) {
            console.error("Error creating post:", err);
            setError("Failed to create post");
        } finally {
            setPosting(false);
        }
    };

    // Like/unlike a post
    const handleLike = async (postId: string, currentlyLiked: boolean) => {
        try {
            const endpoint = currentlyLiked ? "unlike" : "like";
            const response = await fetch(`${API_BASE}/team-feed/${postId}/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userEmail }),
            });

            if (!response.ok) {
                throw new Error(`Failed to ${endpoint} post`);
            }

            const result = await response.json();

            // Update the post in state
            setPosts((prev) =>
                prev.map((post) =>
                    post.postId === postId
                        ? {
                            ...post,
                            likes: result.likes ?? (currentlyLiked ? post.likes - 1 : post.likes + 1),
                            likedByUser: !currentlyLiked,
                        }
                        : post
                )
            );
        } catch (err) {
            console.error("Error toggling like:", err);
        }
    };

    // Delete a post
    const handleDelete = async (postId: string) => {
        if (!confirm("Are you sure you want to delete this post?")) return;

        try {
            const response = await fetch(`${API_BASE}/team-feed/${postId}/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userEmail, userRole }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete post");
            }

            // Remove from state
            setPosts((prev) => prev.filter((post) => post.postId !== postId));
        } catch (err: any) {
            console.error("Error deleting post:", err);
            setError(err.message || "Failed to delete post");
        }
    };

    // Format timestamp
    const formatTime = (timestamp: string) => {
        if (!timestamp) return "Unknown";
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return date.toLocaleDateString();
    };

    // Get initials for avatar
    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    // Get color for avatar based on role
    const getAvatarColor = (role: string) => {
        switch (role) {
            case "admin":
                return "bg-purple-600";
            case "consultant":
                return "bg-emerald-600";
            default:
                return "bg-blue-600";
        }
    };

    // Role badge
    const getRoleBadge = (role: string) => {
        if (role === "admin") {
            return (
                <span className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
                    Admin
                </span>
            );
        }
        return null;
    };

    return (
        <section className={`${s.card} border rounded-xl ${compact ? "p-4" : "p-5"} ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className={`font-semibold flex items-center gap-2 ${s.text}`}>
                    <MessageSquare className={`w-5 h-5 text-blue-500`} />
                    Team Feed
                </h2>
                <button
                    onClick={fetchPosts}
                    className={`p-1.5 rounded-lg ${s.cardHover} ${s.textMuted} transition-colors`}
                    title="Refresh"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">
                        ×
                    </button>
                </div>
            )}

            {/* New post input */}
            <div className={`flex gap-3 pb-4 border-b ${s.divider}`}>
                <div
                    className={`w-10 h-10 ${getAvatarColor(userRole)} rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}
                >
                    {getInitials(userName)}
                </div>
                <div className="flex-1">
                    <textarea
                        value={newPost}
                        onChange={(e) => setNewPost(e.target.value)}
                        placeholder="Share an update with your team..."
                        className={`w-full ${s.input} border rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                        rows={compact ? 2 : 3}
                        disabled={posting}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                handlePost();
                            }
                        }}
                    />
                    <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs ${s.textSubtle}`}>
                            Press Ctrl+Enter to post
                        </span>
                        <button
                            onClick={handlePost}
                            disabled={!newPost.trim() || posting}
                            className={`flex items-center gap-2 px-4 py-2 ${s.buttonPrimary} rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                        >
                            {posting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Post
                        </button>
                    </div>
                </div>
            </div>

            {/* Posts list */}
            {loading && posts.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                    <RefreshCw className={`w-6 h-6 ${s.textMuted} animate-spin`} />
                </div>
            ) : posts.length === 0 ? (
                <div className={`text-center py-8 ${s.textMuted}`}>
                    <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No posts yet. Be the first to share!</p>
                </div>
            ) : (
                <div className={`divide-y ${s.divider} ${compact ? "max-h-96 overflow-y-auto" : ""}`}>
                    {posts.map((post) => (
                        <div key={post.postId} className="py-4">
                            <div className="flex gap-3">
                                {/* Avatar */}
                                <div
                                    className={`w-10 h-10 ${getAvatarColor(post.authorRole)} rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}
                                >
                                    {getInitials(post.authorName)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    {/* Author info */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`font-medium text-sm ${s.text}`}>
                                            {post.authorName}
                                        </span>
                                        {getRoleBadge(post.authorRole)}
                                        <span className={`text-xs ${s.textSubtle}`}>
                                            {formatTime(post.createdAt)}
                                        </span>
                                    </div>

                                    {/* Post content */}
                                    <p className={`text-sm mt-1 ${s.textMuted} whitespace-pre-wrap break-words`}>
                                        {post.content}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex items-center gap-4 mt-2">
                                        {/* Like button */}
                                        <button
                                            onClick={() => handleLike(post.postId, post.likedByUser)}
                                            className={`flex items-center gap-1 text-xs transition-colors ${post.likedByUser
                                                    ? "text-pink-500"
                                                    : `${s.textSubtle} hover:text-pink-500`
                                                }`}
                                        >
                                            <Heart
                                                className={`w-4 h-4 ${post.likedByUser ? "fill-current" : ""}`}
                                            />
                                            {post.likes > 0 && post.likes}
                                        </button>

                                        {/* Delete button (only for author or admin) */}
                                        {(post.authorEmail === userEmail || userRole === "admin") && (
                                            <button
                                                onClick={() => handleDelete(post.postId)}
                                                className={`flex items-center gap-1 text-xs ${s.buttonDanger} p-1 rounded transition-colors`}
                                                title="Delete post"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default TeamFeed;