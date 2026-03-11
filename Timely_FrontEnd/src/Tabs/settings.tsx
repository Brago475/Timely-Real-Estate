// src/Tabs/settings.tsx
import React, { useState, useEffect } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import {
    Shield,
    User,
    Bell,
    Eye,
    History,
    Users,
    FileText,
    Trash2,
    Lock,
    Mail,
    Phone,
    Building,
    X,
    AlertTriangle,
    Moon,
    Sun,
    Globe,
    MapPin,
    Download,
    Upload,
    Edit2,
    Save,
    Smartphone,
    Monitor,
    RefreshCw,
    CheckCircle,
    XCircle,
    MessageSquare,
    Info,
    Calendar,
} from 'lucide-react';

const API_BASE = 'http://localhost:4000/api';

const safeFetch = async (url: string) => {
    try {
        const r = await fetch(url);
        if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null;
        return await r.json();
    } catch {
        return null;
    }
};

// Custom EyeOff icon since lucide might not have it
const EyeOff = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

type UserRole = 'admin' | 'consultant' | 'client';
type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface UserProfile {
    customerId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    companyName?: string;
    preferredContact?: 'email' | 'phone';
    role?: string;
    tempPassword?: string;
    photoUrl?: string;
    calendarLink?: string;
}

interface Consultant {
    consultantId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    role?: string;
    calendarLink?: string;
}

interface LoginActivity {
    id: string;
    date: string;
    time: string;
    device: string;
    location: string;
    ip: string;
    current: boolean;
}

interface Document {
    id: string;
    name: string;
    type: string;
    uploadDate: string;
    size: string;
}

const SettingsPage: React.FC = () => {
    const { toggleTheme, isDark } = useTheme();

    // Theme-aware styles
    const s = {
        bg: isDark ? 'bg-slate-950' : 'bg-gray-50',
        text: isDark ? 'text-white' : 'text-gray-900',
        textMuted: isDark ? 'text-slate-400' : 'text-gray-600',
        textSubtle: isDark ? 'text-slate-500' : 'text-gray-400',
        card: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200',
        cardInner: isDark ? 'bg-slate-800' : 'bg-gray-100',
        input: isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900',
        button: isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
        divider: isDark ? 'border-slate-700' : 'border-gray-200',
        menuActive: isDark ? 'bg-slate-800 border-blue-500' : 'bg-blue-50 border-blue-500',
        menuHover: isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50',
        warning: isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800',
        danger: isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200',
        dangerText: 'text-red-500',
    };

    // Toast notifications
    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (message: string, type: ToastType = 'success') => {
        const id = `t_${Date.now()}`;
        setToasts((p) => [...p, { id, message, type }]);
        setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
    };

    const ToastIcon = ({ type }: { type: ToastType }) =>
        type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
        ) : type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
        ) : (
            <Info className="w-5 h-5 text-blue-400" />
        );

    // User data
    const [userRole, setUserRole] = useState<UserRole>('client');
    const [profile, setProfile] = useState<UserProfile>({
        customerId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        companyName: '',
        preferredContact: 'email',
    });
    const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
    const [consultant, setConsultant] = useState<Consultant | null>(null);

    // UI state
    const [activeSection, setActiveSection] = useState('security');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Password form
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
    const [isUsingTempPassword, setIsUsingTempPassword] = useState(false);

    // Notifications
    const [notifications, setNotifications] = useState({
        emailNotifications: true,
        propertyRecommendations: true,
        appointmentReminders: true,
        marketUpdates: false,
        smsNotifications: false,
    });

    // Display preferences
    const [displayPrefs, setDisplayPrefs] = useState({
        language: 'en',
        region: 'us',
    });

    // Login history
    const [loginHistory, setLoginHistory] = useState<LoginActivity[]>([]);

    // Documents
    const [documents, setDocuments] = useState<Document[]>([]);

    // Delete account
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Role checks
    const isAdmin = userRole === 'admin';
    const isConsultant = userRole === 'consultant';
    const isClient = userRole === 'client';

    // Load all data on mount
    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        await loadUserData();
        loadPreferences();
        loadLoginHistory();
        loadDocuments();
        setLoading(false);
    };

    const loadUserData = async () => {
        const userData = localStorage.getItem('timely_user');
        if (!userData) return;

        const user = JSON.parse(userData);
        const role = (user.role || 'client').toLowerCase() as UserRole;
        setUserRole(role === 'admin' || role === 'consultant' || role === 'client' ? role : 'client');

        // Fetch from API
        const apiData = await safeFetch(`${API_BASE}/users-report`);
        const fullUserData = apiData?.data?.find(
            (u: any) => u.email === user.email || u.customerId === user.customerId
        );

        // Get extended data from localStorage
        const extendedData = localStorage.getItem('timely_clients_extended');
        const extendedUserData = extendedData ? JSON.parse(extendedData)[user.customerId] : null;

        const nameParts = (user.name || '').split(' ');
        const loadedProfile: UserProfile = {
            customerId: user.customerId || fullUserData?.customerId || '',
            firstName: fullUserData?.firstName || extendedUserData?.firstName || nameParts[0] || '',
            lastName: fullUserData?.lastName || extendedUserData?.lastName || nameParts[nameParts.length - 1] || '',
            email: user.email || fullUserData?.email || '',
            phone: fullUserData?.phone || extendedUserData?.phone || '',
            companyName: extendedUserData?.companyName || '',
            preferredContact: extendedUserData?.preferredContact || 'email',
            role: user.role,
            tempPassword: fullUserData?.tempPassword || user.tempPassword,
            photoUrl: extendedUserData?.photoUrl || '',
            calendarLink: extendedUserData?.calendarLink || '',
        };

        setProfile(loadedProfile);
        setOriginalProfile(loadedProfile);

        if (loadedProfile.tempPassword) {
            setIsUsingTempPassword(true);
        }

        // Load assigned consultant for clients
        if (role === 'client') {
            await loadAssignedConsultant(loadedProfile.customerId);
        }
    };

    const loadAssignedConsultant = async (customerId: string) => {
        // Try API first
        const data = await safeFetch(`${API_BASE}/client-consultants`);
        if (data?.data) {
            const assignment = data.data.find((a: any) => a.clientId === customerId);
            if (assignment) {
                const consultantsData = await safeFetch(`${API_BASE}/consultants`);
                const found = consultantsData?.data?.find(
                    (c: any) => c.consultantId === assignment.consultantId
                );
                if (found) {
                    setConsultant(found);
                    return;
                }
            }
        }

        // Fallback to localStorage
        const stored = localStorage.getItem('timely_my_consultant');
        if (stored) {
            try {
                setConsultant(JSON.parse(stored));
            } catch {
                setConsultant(null);
            }
        }
    };

    const loadPreferences = () => {
        const savedNotifs = localStorage.getItem('timely_notifications');
        const savedDisplay = localStorage.getItem('timely_display');

        if (savedNotifs) {
            try {
                setNotifications(JSON.parse(savedNotifs));
            } catch { }
        }

        if (savedDisplay) {
            try {
                const prefs = JSON.parse(savedDisplay);
                setDisplayPrefs({
                    language: prefs.language || 'en',
                    region: prefs.region || 'us',
                });
            } catch { }
        }
    };

    const loadLoginHistory = () => {
        const stored = localStorage.getItem('timely_login_history');
        if (stored) {
            try {
                setLoginHistory(JSON.parse(stored));
            } catch { }
        } else {
            const current: LoginActivity = {
                id: Date.now().toString(),
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                }),
                device: detectDevice(),
                location: 'Current Location',
                ip: '***.***.*.***',
                current: true,
            };
            setLoginHistory([current]);
            localStorage.setItem('timely_login_history', JSON.stringify([current]));
        }
    };

    const detectDevice = () => {
        const ua = navigator.userAgent;
        if (/iPhone|iPad/.test(ua)) return 'Safari on iPhone';
        if (/Android/.test(ua)) return 'Chrome on Android';
        if (/Mac/.test(ua)) return /Chrome/.test(ua) ? 'Chrome on MacOS' : 'Safari on MacOS';
        if (/Windows/.test(ua)) return /Chrome/.test(ua) ? 'Chrome on Windows' : 'Edge on Windows';
        return 'Unknown Device';
    };

    const loadDocuments = () => {
        const key = `timely_documents_${profile.customerId || 'anonymous'}`;
        const stored = localStorage.getItem(key) || localStorage.getItem('timely_documents');
        if (stored) {
            try {
                setDocuments(JSON.parse(stored));
            } catch { }
        }
    };

    // Password validation
    const validatePassword = (password: string) => {
        const errors: string[] = [];
        if (password.length < 8) errors.push('8+ characters');
        if (!/[A-Z]/.test(password)) errors.push('Uppercase');
        if (!/[a-z]/.test(password)) errors.push('Lowercase');
        if (!/[0-9]/.test(password)) errors.push('Number');
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Special char');
        return errors;
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPasswordForm((prev) => ({ ...prev, [name]: value }));
        if (name === 'newPassword') {
            setPasswordErrors(validatePassword(value));
        }
    };

    const handleUpdatePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        if (passwordErrors.length > 0) {
            showToast('Please meet all password requirements', 'error');
            return;
        }

        setSaving(true);

        // Update user data to remove temp password flag
        const userData = localStorage.getItem('timely_user');
        if (userData) {
            const user = JSON.parse(userData);
            user.tempPassword = null;
            localStorage.setItem('timely_user', JSON.stringify(user));
        }

        showToast('Password updated successfully', 'success');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setIsUsingTempPassword(false);
        setSaving(false);
    };

    const handleSaveProfile = async () => {
        setSaving(true);

        // Update main user data
        const userData = localStorage.getItem('timely_user');
        if (userData) {
            const user = JSON.parse(userData);
            user.name = `${profile.firstName} ${profile.lastName}`.trim();
            user.email = profile.email;
            localStorage.setItem('timely_user', JSON.stringify(user));
        }

        // Update extended data
        const extendedData = localStorage.getItem('timely_clients_extended') || '{}';
        const extended = JSON.parse(extendedData);
        extended[profile.customerId] = {
            ...extended[profile.customerId],
            ...profile,
        };
        localStorage.setItem('timely_clients_extended', JSON.stringify(extended));

        setOriginalProfile(profile);
        setIsEditing(false);
        showToast('Profile updated successfully', 'success');
        setSaving(false);
    };

    const handleSaveNotifications = () => {
        localStorage.setItem('timely_notifications', JSON.stringify(notifications));
        showToast('Notification preferences saved', 'success');
    };

    const handleSaveDisplay = () => {
        localStorage.setItem('timely_display', JSON.stringify({ ...displayPrefs, darkMode: isDark }));
        showToast('Display preferences saved', 'success');
    };

    const handleUploadDocument = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const newDoc: Document = {
                    id: Date.now().toString(),
                    name: file.name,
                    type: file.type.includes('pdf')
                        ? 'PDF'
                        : file.type.includes('image')
                            ? 'Image'
                            : 'Document',
                    uploadDate: new Date().toISOString().split('T')[0],
                    size:
                        file.size < 1024 * 1024
                            ? (file.size / 1024).toFixed(1) + ' KB'
                            : (file.size / (1024 * 1024)).toFixed(1) + ' MB',
                };
                const updated = [...documents, newDoc];
                setDocuments(updated);
                const key = `timely_documents_${profile.customerId || 'anonymous'}`;
                localStorage.setItem(key, JSON.stringify(updated));
                showToast('Document uploaded', 'success');
            }
        };
        input.click();
    };

    const handleDeleteDocument = (docId: string) => {
        const updated = documents.filter((d) => d.id !== docId);
        setDocuments(updated);
        const key = `timely_documents_${profile.customerId || 'anonymous'}`;
        localStorage.setItem(key, JSON.stringify(updated));
        showToast('Document deleted', 'success');
    };

    const handleDeleteAccount = () => {
        if (deleteConfirmText !== 'DELETE') {
            showToast('Type DELETE to confirm', 'error');
            return;
        }
        localStorage.clear();
        window.location.reload();
    };

    // Menu items - different based on role
    const menuItems = [
        { id: 'security', label: 'Account Security', icon: Shield, color: 'text-red-500', visible: true },
        { id: 'profile', label: 'Profile Information', icon: User, color: 'text-blue-500', visible: true },
        { id: 'preferences', label: 'Preferences', icon: Bell, color: 'text-purple-500', visible: true },
        { id: 'display', label: 'Display Settings', icon: Eye, color: 'text-amber-500', visible: true },
        { id: 'activity', label: 'Login History', icon: History, color: 'text-orange-500', visible: true },
        { id: 'consultant', label: 'My Consultant', icon: Users, color: 'text-emerald-500', visible: isClient },
        { id: 'documents', label: 'Documents', icon: FileText, color: 'text-cyan-500', visible: true },
        { id: 'account', label: 'Account Management', icon: Trash2, color: 'text-gray-500', visible: true },
    ].filter((item) => item.visible);

    // Loading state
    if (loading) {
        return (
            <div className={`min-h-screen ${s.bg} flex items-center justify-center`}>
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${s.bg}`}>
            {/* Toast notifications */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${s.card}`}
                    >
                        <ToastIcon type={t.type} />
                        <span className={s.text}>{t.message}</span>
                        <button
                            onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
                            className={s.textMuted}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className={`text-3xl font-bold ${s.text}`}>Settings</h1>
                    <p className={s.textMuted}>Manage your account settings and preferences</p>
                </div>

                {/* Temp password warning */}
                {isUsingTempPassword && activeSection !== 'security' && (
                    <div
                        className={`mb-6 p-4 ${s.warning} border rounded-xl flex items-center justify-between`}
                    >
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5" />
                            <div>
                                <p className="font-medium">Security Alert</p>
                                <p className="text-sm opacity-80">
                                    Please update your temporary password.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveSection('security')}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
                        >
                            Update Password
                        </button>
                    </div>
                )}

                <div className="flex gap-6">
                    {/* Sidebar Menu */}
                    <div className="w-64 flex-shrink-0">
                        <div className={`${s.card} border rounded-xl overflow-hidden`}>
                            {menuItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={`w-full px-4 py-3 flex items-center gap-3 border-l-2 transition-colors ${activeSection === item.id
                                            ? s.menuActive
                                            : `${s.menuHover} border-transparent`
                                        }`}
                                >
                                    <item.icon className={`w-5 h-5 ${item.color}`} />
                                    <span
                                        className={`text-sm ${activeSection === item.id ? s.text : s.textMuted
                                            }`}
                                    >
                                        {item.label}
                                    </span>
                                    {item.id === 'security' && isUsingTempPassword && (
                                        <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1">
                        {/* Security Section */}
                        {activeSection === 'security' && (
                            <div className={`${s.card} border rounded-xl p-6`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <Lock className="w-6 h-6 text-red-500" />
                                    <div>
                                        <h2 className={`text-xl font-semibold ${s.text}`}>
                                            Change Password
                                        </h2>
                                        <p className={s.textMuted}>Keep your account secure</p>
                                    </div>
                                </div>

                                {isUsingTempPassword && (
                                    <div
                                        className={`mb-6 p-4 ${s.warning} border rounded-lg flex items-start gap-3`}
                                    >
                                        <AlertTriangle className="w-5 h-5 mt-0.5" />
                                        <div>
                                            <p className="font-medium">Temporary Password</p>
                                            <p className="text-sm opacity-80">
                                                Please change your password immediately for security.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4 max-w-md">
                                    {/* Current Password */}
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            Current Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showCurrentPassword ? 'text' : 'password'}
                                                name="currentPassword"
                                                value={passwordForm.currentPassword}
                                                onChange={handlePasswordChange}
                                                className={`w-full px-4 py-3 pr-12 ${s.input} border rounded-lg focus:outline-none focus:border-blue-500`}
                                                placeholder="Enter current password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className={`absolute right-4 top-1/2 -translate-y-1/2 ${s.textMuted}`}
                                            >
                                                {showCurrentPassword ? (
                                                    <EyeOff className="w-5 h-5" />
                                                ) : (
                                                    <Eye className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* New Password */}
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                name="newPassword"
                                                value={passwordForm.newPassword}
                                                onChange={handlePasswordChange}
                                                className={`w-full px-4 py-3 pr-12 ${s.input} border rounded-lg focus:outline-none focus:border-blue-500`}
                                                placeholder="Enter new password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className={`absolute right-4 top-1/2 -translate-y-1/2 ${s.textMuted}`}
                                            >
                                                {showNewPassword ? (
                                                    <EyeOff className="w-5 h-5" />
                                                ) : (
                                                    <Eye className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Password Requirements */}
                                    {passwordForm.newPassword && (
                                        <div className={`p-4 ${s.cardInner} rounded-lg grid grid-cols-3 gap-2`}>
                                            {[
                                                { met: passwordForm.newPassword.length >= 8, t: '8+ chars' },
                                                { met: /[A-Z]/.test(passwordForm.newPassword), t: 'Uppercase' },
                                                { met: /[a-z]/.test(passwordForm.newPassword), t: 'Lowercase' },
                                                { met: /[0-9]/.test(passwordForm.newPassword), t: 'Number' },
                                                {
                                                    met: /[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPassword),
                                                    t: 'Special',
                                                },
                                            ].map((r, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex items-center gap-2 text-sm ${r.met ? 'text-emerald-500' : s.textSubtle
                                                        }`}
                                                >
                                                    {r.met ? (
                                                        <CheckCircle className="w-4 h-4" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4" />
                                                    )}
                                                    {r.t}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Confirm Password */}
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            Confirm New Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                name="confirmPassword"
                                                value={passwordForm.confirmPassword}
                                                onChange={handlePasswordChange}
                                                className={`w-full px-4 py-3 pr-12 ${s.input} border rounded-lg focus:outline-none ${passwordForm.confirmPassword &&
                                                        passwordForm.confirmPassword !== passwordForm.newPassword
                                                        ? 'border-red-500'
                                                        : passwordForm.confirmPassword ===
                                                            passwordForm.newPassword && passwordForm.confirmPassword
                                                            ? 'border-emerald-500'
                                                            : 'focus:border-blue-500'
                                                    }`}
                                                placeholder="Confirm new password"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className={`absolute right-4 top-1/2 -translate-y-1/2 ${s.textMuted}`}
                                            >
                                                {showConfirmPassword ? (
                                                    <EyeOff className="w-5 h-5" />
                                                ) : (
                                                    <Eye className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                        {passwordForm.confirmPassword &&
                                            passwordForm.confirmPassword !== passwordForm.newPassword && (
                                                <p className="text-red-500 text-sm mt-2">
                                                    Passwords do not match
                                                </p>
                                            )}
                                    </div>

                                    <button
                                        onClick={handleUpdatePassword}
                                        disabled={
                                            saving ||
                                            passwordErrors.length > 0 ||
                                            !passwordForm.currentPassword ||
                                            passwordForm.newPassword !== passwordForm.confirmPassword
                                        }
                                        className={`w-full mt-4 px-6 py-3 ${s.buttonPrimary} rounded-lg disabled:opacity-50 font-medium`}
                                    >
                                        {saving ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Profile Section */}
                        {activeSection === 'profile' && (
                            <div className={`${s.card} border rounded-xl p-6`}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-semibold">
                                            {profile.firstName?.[0]}
                                            {profile.lastName?.[0]}
                                        </div>
                                        <div>
                                            <h2 className={`text-xl font-semibold ${s.text}`}>
                                                Profile Information
                                            </h2>
                                            <p className={s.textMuted}>
                                                Manage your personal details
                                                {(isConsultant || isAdmin) && ' and public profile'}
                                            </p>
                                        </div>
                                    </div>
                                    {!isEditing ? (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className={`px-4 py-2 ${s.button} rounded-lg flex items-center gap-2`}
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Edit
                                        </button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    if (originalProfile) setProfile(originalProfile);
                                                    setIsEditing(false);
                                                }}
                                                className={`px-4 py-2 ${s.button} rounded-lg`}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveProfile}
                                                disabled={saving}
                                                className={`px-4 py-2 ${s.buttonPrimary} rounded-lg flex items-center gap-2`}
                                            >
                                                <Save className="w-4 h-4" />
                                                {saving ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            First Name
                                        </label>
                                        <input
                                            type="text"
                                            value={profile.firstName}
                                            onChange={(e) =>
                                                setProfile({ ...profile, firstName: e.target.value })
                                            }
                                            disabled={!isEditing}
                                            className={`w-full px-4 py-3 ${s.input} border rounded-lg disabled:opacity-60`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            Last Name
                                        </label>
                                        <input
                                            type="text"
                                            value={profile.lastName}
                                            onChange={(e) =>
                                                setProfile({ ...profile, lastName: e.target.value })
                                            }
                                            disabled={!isEditing}
                                            className={`w-full px-4 py-3 ${s.input} border rounded-lg disabled:opacity-60`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            Email
                                        </label>
                                        <div className="relative">
                                            <Mail
                                                className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${s.textSubtle}`}
                                            />
                                            <input
                                                type="email"
                                                value={profile.email}
                                                onChange={(e) =>
                                                    setProfile({ ...profile, email: e.target.value })
                                                }
                                                disabled={!isEditing}
                                                className={`w-full pl-12 pr-4 py-3 ${s.input} border rounded-lg disabled:opacity-60`}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            Phone
                                        </label>
                                        <div className="relative">
                                            <Phone
                                                className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${s.textSubtle}`}
                                            />
                                            <input
                                                type="tel"
                                                value={profile.phone}
                                                onChange={(e) =>
                                                    setProfile({ ...profile, phone: e.target.value })
                                                }
                                                disabled={!isEditing}
                                                placeholder="(555) 123-4567"
                                                className={`w-full pl-12 pr-4 py-3 ${s.input} border rounded-lg disabled:opacity-60`}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            Company
                                        </label>
                                        <div className="relative">
                                            <Building
                                                className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${s.textSubtle}`}
                                            />
                                            <input
                                                type="text"
                                                value={profile.companyName || ''}
                                                onChange={(e) =>
                                                    setProfile({ ...profile, companyName: e.target.value })
                                                }
                                                disabled={!isEditing}
                                                className={`w-full pl-12 pr-4 py-3 ${s.input} border rounded-lg disabled:opacity-60`}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`${s.textMuted} text-sm mb-2 block`}>
                                            Preferred Contact
                                        </label>
                                        <select
                                            value={profile.preferredContact}
                                            onChange={(e) =>
                                                setProfile({
                                                    ...profile,
                                                    preferredContact: e.target.value as 'email' | 'phone',
                                                })
                                            }
                                            disabled={!isEditing}
                                            className={`w-full px-4 py-3 ${s.input} border rounded-lg disabled:opacity-60`}
                                        >
                                            <option value="email">Email</option>
                                            <option value="phone">Phone</option>
                                        </select>
                                    </div>

                                    {/* Consultant/Admin only fields */}
                                    {(isConsultant || isAdmin) && (
                                        <>
                                            <div>
                                                <label className={`${s.textMuted} text-sm mb-2 block`}>
                                                    Profile Photo URL
                                                </label>
                                                <input
                                                    type="text"
                                                    value={profile.photoUrl || ''}
                                                    onChange={(e) =>
                                                        setProfile({ ...profile, photoUrl: e.target.value })
                                                    }
                                                    disabled={!isEditing}
                                                    placeholder="https://..."
                                                    className={`w-full px-4 py-3 ${s.input} border rounded-lg disabled:opacity-60`}
                                                />
                                            </div>
                                            <div>
                                                <label className={`${s.textMuted} text-sm mb-2 block`}>
                                                    Calendar Link
                                                </label>
                                                <div className="relative">
                                                    <Calendar
                                                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${s.textSubtle}`}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={profile.calendarLink || ''}
                                                        onChange={(e) =>
                                                            setProfile({
                                                                ...profile,
                                                                calendarLink: e.target.value,
                                                            })
                                                        }
                                                        disabled={!isEditing}
                                                        placeholder="Calendly, Cal.com link..."
                                                        className={`w-full pl-12 pr-4 py-3 ${s.input} border rounded-lg disabled:opacity-60`}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Preferences Section */}
                        {activeSection === 'preferences' && (
                            <div className={`${s.card} border rounded-xl p-6`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <Bell className="w-6 h-6 text-purple-500" />
                                    <div>
                                        <h2 className={`text-xl font-semibold ${s.text}`}>
                                            Notification Preferences
                                        </h2>
                                        <p className={s.textMuted}>Choose how Timely contacts you</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        {
                                            key: 'emailNotifications',
                                            label: 'Email Notifications',
                                            desc: 'Receive account updates via email',
                                        },
                                        {
                                            key: 'smsNotifications',
                                            label: 'SMS Notifications',
                                            desc: 'Receive text message alerts',
                                        },
                                        {
                                            key: 'propertyRecommendations',
                                            label: 'Property Recommendations',
                                            desc: 'Get notified about new matching properties',
                                        },
                                        {
                                            key: 'appointmentReminders',
                                            label: 'Appointment Reminders',
                                            desc: 'Reminders before scheduled meetings',
                                        },
                                        {
                                            key: 'marketUpdates',
                                            label: 'Market Updates',
                                            desc: 'Weekly market trends and insights',
                                        },
                                    ].map((item) => (
                                        <div
                                            key={item.key}
                                            className={`flex items-center justify-between p-4 ${s.cardInner} rounded-lg`}
                                        >
                                            <div>
                                                <p className={`${s.text} font-medium`}>{item.label}</p>
                                                <p className={`${s.textSubtle} text-sm`}>{item.desc}</p>
                                            </div>
                                            <button
                                                onClick={() =>
                                                    setNotifications({
                                                        ...notifications,
                                                        [item.key]:
                                                            !notifications[item.key as keyof typeof notifications],
                                                    })
                                                }
                                                className={`w-12 h-7 rounded-full relative transition-colors ${notifications[item.key as keyof typeof notifications]
                                                        ? 'bg-blue-600'
                                                        : isDark
                                                            ? 'bg-slate-600'
                                                            : 'bg-gray-300'
                                                    }`}
                                            >
                                                <div
                                                    className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${notifications[item.key as keyof typeof notifications]
                                                            ? 'left-6'
                                                            : 'left-1'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleSaveNotifications}
                                    className={`mt-6 px-6 py-3 ${s.buttonPrimary} rounded-lg font-medium`}
                                >
                                    Save Notifications
                                </button>
                            </div>
                        )}

                        {/* Display Settings Section */}
                        {activeSection === 'display' && (
                            <div className={`${s.card} border rounded-xl p-6`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <Eye className="w-6 h-6 text-amber-500" />
                                    <div>
                                        <h2 className={`text-xl font-semibold ${s.text}`}>
                                            Display Settings
                                        </h2>
                                        <p className={s.textMuted}>Customize your viewing experience</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Theme Toggle */}
                                    <div
                                        className={`flex items-center justify-between p-4 ${s.cardInner} rounded-lg`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {isDark ? (
                                                <Moon className="w-5 h-5 text-slate-400" />
                                            ) : (
                                                <Sun className="w-5 h-5 text-amber-500" />
                                            )}
                                            <div>
                                                <p className={`${s.text} font-medium`}>
                                                    {isDark ? 'Dark Mode' : 'Light Mode'}
                                                </p>
                                                <p className={`${s.textSubtle} text-sm`}>
                                                    Toggle between light and dark theme
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={toggleTheme}
                                            className={`w-12 h-7 rounded-full relative bg-blue-600`}
                                        >
                                            <div
                                                className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${isDark ? 'left-6' : 'left-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Language */}
                                    <div className={`p-4 ${s.cardInner} rounded-lg`}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <Globe className={`w-5 h-5 ${s.textMuted}`} />
                                            <p className={`${s.text} font-medium`}>Language</p>
                                        </div>
                                        <select
                                            value={displayPrefs.language}
                                            onChange={(e) =>
                                                setDisplayPrefs({ ...displayPrefs, language: e.target.value })
                                            }
                                            className={`w-full px-4 py-3 ${s.input} border rounded-lg`}
                                        >
                                            <option value="en">English</option>
                                            <option value="es">Spanish</option>
                                            <option value="fr">French</option>
                                        </select>
                                    </div>

                                    {/* Region */}
                                    <div className={`p-4 ${s.cardInner} rounded-lg`}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <MapPin className={`w-5 h-5 ${s.textMuted}`} />
                                            <p className={`${s.text} font-medium`}>Region</p>
                                        </div>
                                        <select
                                            value={displayPrefs.region}
                                            onChange={(e) =>
                                                setDisplayPrefs({ ...displayPrefs, region: e.target.value })
                                            }
                                            className={`w-full px-4 py-3 ${s.input} border rounded-lg`}
                                        >
                                            <option value="us">United States</option>
                                            <option value="ca">Canada</option>
                                            <option value="uk">United Kingdom</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSaveDisplay}
                                    className={`mt-6 px-6 py-3 ${s.buttonPrimary} rounded-lg font-medium`}
                                >
                                    Save Display Settings
                                </button>
                            </div>
                        )}

                        {/* Login History Section */}
                        {activeSection === 'activity' && (
                            <div className={`${s.card} border rounded-xl p-6`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <History className="w-6 h-6 text-orange-500" />
                                    <div>
                                        <h2 className={`text-xl font-semibold ${s.text}`}>Login History</h2>
                                        <p className={s.textMuted}>Recent account activity</p>
                                    </div>
                                </div>

                                {loginHistory.length === 0 ? (
                                    <div className="text-center py-12">
                                        <History className={`w-12 h-12 ${s.textSubtle} mx-auto mb-4`} />
                                        <p className={s.textMuted}>No login history available</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {loginHistory.map((activity) => (
                                            <div
                                                key={activity.id}
                                                className={`p-4 rounded-lg border ${activity.current
                                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                                        : `${s.cardInner} ${s.divider}`
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        {activity.device.includes('iPhone') ||
                                                            activity.device.includes('Android') ? (
                                                            <Smartphone className="w-5 h-5 text-purple-500" />
                                                        ) : (
                                                            <Monitor className="w-5 h-5 text-blue-500" />
                                                        )}
                                                        <div>
                                                            <p
                                                                className={`${s.text} font-medium flex items-center gap-2`}
                                                            >
                                                                {activity.device}
                                                                {activity.current && (
                                                                    <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                                                                        Current
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className={`${s.textSubtle} text-sm`}>
                                                                {activity.location} • IP: {activity.ip}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`${s.textMuted} text-sm`}>
                                                            {activity.date}
                                                        </p>
                                                        <p className={`${s.textSubtle} text-sm`}>
                                                            {activity.time}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div
                                    className={`mt-6 p-4 ${s.warning} border rounded-lg flex items-start gap-3`}
                                >
                                    <AlertTriangle className="w-5 h-5 mt-0.5" />
                                    <div>
                                        <p className="font-medium">Don't recognize a login?</p>
                                        <p className="text-sm opacity-80">
                                            If you see suspicious activity, change your password immediately.
                                        </p>
                                        <button
                                            onClick={() => setActiveSection('security')}
                                            className="mt-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
                                        >
                                            Reset Password
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* My Consultant Section (Client only) */}
                        {activeSection === 'consultant' && isClient && (
                            <div className={`${s.card} border rounded-xl p-6`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <Users className="w-6 h-6 text-emerald-500" />
                                    <div>
                                        <h2 className={`text-xl font-semibold ${s.text}`}>
                                            Your Consultant
                                        </h2>
                                        <p className={s.textMuted}>Your dedicated point of contact</p>
                                    </div>
                                </div>

                                {consultant ? (
                                    <div className={`${s.cardInner} rounded-lg p-6`}>
                                        <div className="flex items-start gap-6">
                                            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                                                {consultant.firstName?.[0]}
                                                {consultant.lastName?.[0]}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className={`text-xl font-bold ${s.text}`}>
                                                    {consultant.firstName} {consultant.lastName}
                                                </h3>
                                                {consultant.role && (
                                                    <p className="text-blue-500">{consultant.role}</p>
                                                )}
                                                <div className="mt-4 space-y-2">
                                                    {consultant.email && (
                                                        <div className="flex items-center gap-3">
                                                            <Mail className={`w-5 h-5 ${s.textSubtle}`} />
                                                            <a
                                                                href={`mailto:${consultant.email}`}
                                                                className={`${s.textMuted} hover:text-blue-500`}
                                                            >
                                                                {consultant.email}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {consultant.phone && (
                                                        <div className="flex items-center gap-3">
                                                            <Phone className={`w-5 h-5 ${s.textSubtle}`} />
                                                            <a
                                                                href={`tel:${consultant.phone}`}
                                                                className={`${s.textMuted} hover:text-blue-500`}
                                                            >
                                                                {consultant.phone}
                                                            </a>
                                                        </div>
                                                    )}
                                                    {consultant.calendarLink && (
                                                        <div className="flex items-center gap-3">
                                                            <Calendar className={`w-5 h-5 ${s.textSubtle}`} />
                                                            <a
                                                                href={consultant.calendarLink}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-blue-500 hover:underline"
                                                            >
                                                                Schedule a meeting
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-6 flex gap-3">
                                                    {consultant.email && (
                                                        <a
                                                            href={`mailto:${consultant.email}`}
                                                            className={`px-6 py-3 ${s.buttonPrimary} rounded-lg flex items-center gap-2`}
                                                        >
                                                            <MessageSquare className="w-5 h-5" />
                                                            Contact
                                                        </a>
                                                    )}
                                                    <button className={`px-6 py-3 ${s.button} rounded-lg`}>
                                                        Request Change
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 border border-dashed rounded-xl">
                                        <Users className={`w-12 h-12 ${s.textSubtle} mx-auto mb-4`} />
                                        <p className={s.textMuted}>No consultant assigned yet</p>
                                        <p className={`${s.textSubtle} text-sm mt-1`}>
                                            Once assigned, their contact info will appear here.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Documents Section */}
                        {activeSection === 'documents' && (
                            <div className={`${s.card} border rounded-xl p-6`}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-6 h-6 text-cyan-500" />
                                        <div>
                                            <h2 className={`text-xl font-semibold ${s.text}`}>Documents</h2>
                                            <p className={s.textMuted}>
                                                {isClient
                                                    ? 'Upload documents for your consultant'
                                                    : 'Manage your uploaded files'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleUploadDocument}
                                        className={`px-4 py-2 ${s.buttonPrimary} rounded-lg flex items-center gap-2`}
                                    >
                                        <Upload className="w-4 h-4" />
                                        Upload
                                    </button>
                                </div>

                                {documents.length === 0 ? (
                                    <div className="text-center py-12 border border-dashed rounded-xl">
                                        <FileText className={`w-12 h-12 ${s.textSubtle} mx-auto mb-4`} />
                                        <p className={s.textMuted}>No documents uploaded</p>
                                        <p className={`${s.textSubtle} text-sm mt-1`}>
                                            Click Upload to add files
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {documents.map((doc) => (
                                            <div
                                                key={doc.id}
                                                className={`p-4 ${s.cardInner} rounded-lg flex items-center justify-between`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <FileText className="w-6 h-6 text-cyan-500" />
                                                    <div>
                                                        <p className={`${s.text} font-medium`}>{doc.name}</p>
                                                        <p className={`${s.textSubtle} text-sm`}>
                                                            {doc.type} • {doc.size} • {doc.uploadDate}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button className={`p-2 ${s.button} rounded-lg`}>
                                                        <Download className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                        className="p-2 hover:bg-red-500/20 rounded-lg"
                                                    >
                                                        <Trash2 className="w-5 h-5 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Account Management Section */}
                        {activeSection === 'account' && (
                            <div className={`${s.card} border rounded-xl p-6`}>
                                <div className="flex items-center gap-3 mb-6">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                    <div>
                                        <h2 className={`text-xl font-semibold ${s.text}`}>
                                            Account Management
                                        </h2>
                                        <p className={s.textMuted}>Manage your account status</p>
                                    </div>
                                </div>

                                <div className={`p-6 ${s.danger} border rounded-lg`}>
                                    <h3 className={`${s.dangerText} font-bold text-lg mb-2`}>
                                        Danger Zone
                                    </h3>
                                    <p className={`${s.textMuted} mb-4`}>
                                        {isAdmin
                                            ? 'Deleting your admin account should only be done in exceptional cases.'
                                            : isConsultant
                                                ? 'This will remove your access to Timely and all associated data.'
                                                : 'Deleting your account will remove your access. Your projects remain linked to the admin.'}
                                    </p>
                                    <button
                                        onClick={() => setShowDeleteModal(true)}
                                        className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                                    >
                                        Delete Account
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${s.card} border rounded-xl max-w-md w-full`}>
                        <div className={`p-6 border-b ${s.divider} flex items-center gap-3`}>
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                            <div>
                                <h2 className={`text-xl font-bold ${s.text}`}>Delete Account</h2>
                                <p className={s.textMuted}>This action cannot be undone</p>
                            </div>
                        </div>
                        <div className="p-6">
                            <p className={`${s.textMuted} mb-4`}>
                                All your data will be permanently deleted:
                            </p>
                            <ul className={`${s.textMuted} text-sm space-y-2 mb-6`}>
                                {[
                                    'Profile information',
                                    'Saved properties',
                                    'Documents',
                                    'Communication history',
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <X className="w-4 h-4 text-red-500" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <div className="mb-6">
                                <label className={`${s.textMuted} text-sm mb-2 block`}>
                                    Type <span className="text-red-500 font-mono">DELETE</span> to
                                    confirm
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    className={`w-full px-4 py-3 ${s.input} border rounded-lg`}
                                    placeholder="DELETE"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setDeleteConfirmText('');
                                    }}
                                    className={`flex-1 px-6 py-3 ${s.button} rounded-lg`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleteConfirmText !== 'DELETE'}
                                    className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;