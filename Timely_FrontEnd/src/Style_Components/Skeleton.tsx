// src/Style_Components/Skeletons.tsx (or wherever this lives)
import React from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
    const { isDark } = useTheme();
    return <div className={`animate-pulse rounded-lg ${isDark ? "bg-[#161616]" : "bg-[#d4d4d4]"} ${className}`} />;
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 1, className = "" }) => (
    <div className={`space-y-2 ${className}`}>{Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={`h-4 ${i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"}`} />)}</div>
);

export const SkeletonCard: React.FC = () => {
    const { isDark } = useTheme();
    return (
        <div className={isDark ? "neu-dark" : "neu-light"}><div className="p-5"><div className="flex items-center justify-between mb-3"><Skeleton className="w-10 h-10 rounded-xl" /><Skeleton className="w-16 h-8" /></div><Skeleton className="w-24 h-4 mb-1" /><Skeleton className="w-16 h-3" /></div></div>
    );
};

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
    const { isDark } = useTheme();
    return (
        <div className="space-y-1.5">{Array.from({ length: rows }).map((_, i) => (
            <div key={i} className={`${isDark ? "neu-dark-flat" : "neu-light-flat"} flex items-center gap-3 p-3`}><Skeleton className="w-8 h-8 rounded-full flex-shrink-0" /><div className="flex-1"><Skeleton className="w-32 h-4 mb-1" /><Skeleton className="w-20 h-3" /></div></div>
        ))}</div>
    );
};

export const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = "" }) => (
    <div className={`animate-fadeIn ${className}`} style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}>{children}</div>
);