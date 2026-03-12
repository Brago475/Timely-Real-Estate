import React from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";

// Apple-style skeleton shimmer animation
// Use these components anywhere data is loading

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { isDark } = useTheme();
  return (
    <div
      className={`animate-pulse rounded-lg ${
        isDark ? "bg-slate-800" : "bg-gray-200"
      } ${className}`}
    />
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = "",
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-4 ${i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"}`}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC = () => {
  const { isDark } = useTheme();
  return (
    <div
      className={`rounded-xl border p-5 ${
        isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-16 h-8" />
      </div>
      <Skeleton className="w-24 h-4 mb-1" />
      <Skeleton className="w-16 h-3" />
    </div>
  );
};

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="w-32 h-4 mb-1" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>
    ))}
  </div>
);

// Fade-in wrapper — content fades in when it mounts
export const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = "" }) => (
  <div
    className={`animate-fadeIn ${className}`}
    style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
  >
    {children}
  </div>
);