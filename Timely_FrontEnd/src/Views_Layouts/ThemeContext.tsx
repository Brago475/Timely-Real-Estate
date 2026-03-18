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

const getCurrentUserId = (): string | null => {
    try {
        // Check sessionStorage first (where AuthContext stores it), then localStorage
        const userStr = sessionStorage.getItem('timely_user') || localStorage.getItem('timely_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            return user.customerId || user.email || null;
        }
    } catch {}
    return null;
};

const getThemeKey = (userId: string | null): string => {
    return userId ? `timely_theme_${userId}` : 'timely_theme_guest';
};

const getUserTheme = (userId: string | null): Theme | null => {
    const saved = localStorage.getItem(getThemeKey(userId));
    if (saved === 'light' || saved === 'dark') return saved;
    return null;
};

const saveUserTheme = (userId: string | null, theme: Theme): void => {
    localStorage.setItem(getThemeKey(userId), theme);
};

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const userId = getCurrentUserId();
        const userTheme = getUserTheme(userId);
        if (userTheme) return userTheme;

        // Default to light
        return 'light';
    });

    useEffect(() => {
        const userId = getCurrentUserId();
        saveUserTheme(userId, theme);

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

export const useRefreshThemeOnLogin = () => {
    const { setTheme } = useTheme();

    const refreshTheme = () => {
        const userId = getCurrentUserId();
        const userTheme = getUserTheme(userId);
        if (userTheme) setTheme(userTheme);
    };

    return refreshTheme;
};

export default ThemeContext;