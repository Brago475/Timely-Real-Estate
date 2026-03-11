// src/Views_Layouts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

// Helper to get current user ID
const getCurrentUserId = (): string | null => {
    try {
        const userStr = localStorage.getItem('timely_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            return user.customerId || user.consultantId || user.email || null;
        }
    } catch {
        // Ignore parse errors
    }
    return null;
};

// Helper to get theme storage key for current user
const getThemeKey = (userId: string | null): string => {
    if (userId) {
        return `timely_theme_${userId}`;
    }
    return 'timely_theme_guest';
};

// Helper to get user's saved theme
const getUserTheme = (userId: string | null): Theme | null => {
    const key = getThemeKey(userId);
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') {
        return saved;
    }
    return null;
};

// Helper to save user's theme
const saveUserTheme = (userId: string | null, theme: Theme): void => {
    const key = getThemeKey(userId);
    localStorage.setItem(key, theme);
};

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const userId = getCurrentUserId();

        // Check user-specific theme first
        const userTheme = getUserTheme(userId);
        if (userTheme) return userTheme;

        // Check system preference
        if (typeof window !== 'undefined' && window.matchMedia) {
            if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                return 'light';
            }
        }

        // Default to dark
        return 'dark';
    });

    // Listen for user login/logout changes
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'timely_user') {
                // User logged in or out, load their theme preference
                const userId = getCurrentUserId();
                const userTheme = getUserTheme(userId);
                if (userTheme) {
                    setThemeState(userTheme);
                }
            }
        };

        // Also check periodically for login changes (same tab)
        const checkUserChange = () => {
            const userId = getCurrentUserId();
            const userTheme = getUserTheme(userId);
            if (userTheme && userTheme !== theme) {
                setThemeState(userTheme);
            }
        };

        // Check on focus (when user comes back to tab after login)
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('focus', checkUserChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('focus', checkUserChange);
        };
    }, [theme]);

    // Save theme when it changes
    useEffect(() => {
        const userId = getCurrentUserId();
        saveUserTheme(userId, theme);

        // Apply theme class to document for global CSS access
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        } else {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark: theme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Hook to refresh theme after login
export const useRefreshThemeOnLogin = () => {
    const { setTheme } = useTheme();

    const refreshTheme = () => {
        const userId = getCurrentUserId();
        const userTheme = getUserTheme(userId);
        if (userTheme) {
            setTheme(userTheme);
        }
    };

    return refreshTheme;
};

export default ThemeContext;