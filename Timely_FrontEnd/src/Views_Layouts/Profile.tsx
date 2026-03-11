// src/Views_Layouts/profile.tsx
// user profile page - displays and allows editing of user information
// shows different fields based on user role (admin, consultant, client)

import React, { useState, useEffect } from "react";
import { useTheme } from "./ThemeContext";
import {
    User,
    Mail,
    Phone,
    Shield,
    Camera,
    Save,
    Key,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    Info,
    X,
    Briefcase,
    Calendar,
    Clock
} from "lucide-react";

// TASK: move to environment config
const API_BASE = "http://localhost:4000";

type UserRole = "admin" | "consultant" | "client";

interface UserData {
    customerId: string;
    email: string;
    name: string;
    role: UserRole;
    firstName?: string;
    lastName?: string;
    phone?: string;
    joinDate?: string;
    consultantId?: string;
    consultantCode?: string;
}

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

const TOAST_DURATION_MS = 3000;


const ProfilePage: React.FC = () => {
    const { isDark } = useTheme();

    const styles = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        card: isDark ? "bg-slate-900 border-slate-700" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:bg-slate-800" : "hover:bg-gray-50",
        cardInner: isDark ? "bg-slate-800" : "bg-gray-50",
        input: isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-300 text-gray-900",
        inputFocus: "focus:border-blue-500",
        button: isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-800",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
        divider: isDark ? "border-slate-700" : "border-gray-200",
        accent: isDark ? "text-blue-400" : "text-blue-600",
    };

    const [toasts, setToasts] = useState<Toast[]>([]);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // form fields
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    // password change fields
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // stats for consultants
    const [hoursLogged, setHoursLogged] = useState(0);
    const [projectsAssigned, setProjectsAssigned] = useState(0);

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        const id = `toast_${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, TOAST_DURATION_MS);
    };

    const dismissToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const ToastIcon = ({ type }: { type: string }) => {
        if (type === "success") return <CheckCircle className="w-5 h-5 text-emerald-400" />;
        if (type === "error") return <AlertCircle className="w-5 h-5 text-red-400" />;
        return <Info className="w-5 h-5 text-blue-400" />;
    };

    const getUserInitials = (name: string): string => {
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const getRoleLabel = (role: UserRole): string => {
        const labels: Record<UserRole, string> = {
            admin: "Administrator",
            consultant: "Consultant",
            client: "Client",
        };
        return labels[role] || role;
    };

    const getRoleBadgeColor = (role: UserRole): string => {
        const colors: Record<UserRole, string> = {
            admin: isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-600",
            consultant: isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600",
            client: isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600",
        };
        return colors[role] || "";
    };

    // load user data from localStorage
    useEffect(() => {
        const loadUserData = async () => {
            setIsLoading(true);

            try {
                const stored = localStorage.getItem("timely_user");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    const nameParts = (parsed.name || "").split(" ");

                    const user: UserData = {
                        customerId: parsed.customerId || "",
                        email: parsed.email || "",
                        name: parsed.name || "",
                        role: parsed.role || "client",
                        firstName: nameParts[0] || "",
                        lastName: nameParts.slice(1).join(" ") || "",
                        phone: parsed.phone || "",
                        joinDate: parsed.joinDate || new Date().toISOString(),
                        consultantId: parsed.consultantId,
                        consultantCode: parsed.consultantCode,
                    };

                    setUserData(user);
                    setFirstName(user.firstName || "");
                    setLastName(user.lastName || "");
                    setPhone(user.phone || "");

                    // load consultant stats if applicable
                    if (user.role === "consultant" && user.consultantId) {
                        await loadConsultantStats(user.consultantId);
                    }
                }
            } catch (error) {
                console.error("Error loading user data:", error);
                showToast("Failed to load profile data", "error");
            } finally {
                setIsLoading(false);
            }
        };

        loadUserData();
    }, []);

    // TASK: these stats should come from a dedicated api endpoint
    // currently calculating client-side which is inefficient
    const loadConsultantStats = async (consultantId: string) => {
        try {
            // load hours
            const hoursResponse = await fetch(`${API_BASE}/api/hours-logs`);
            const hoursData = await hoursResponse.json();
            if (hoursData.data) {
                const consultantHours = hoursData.data
                    .filter((log: any) => log.consultantId === consultantId)
                    .reduce((sum: number, log: any) => sum + (log.hours || 0), 0);
                setHoursLogged(consultantHours);
            }

            // load projects
            const projectsResponse = await fetch(`${API_BASE}/api/project-consultants`);
            const projectsData = await projectsResponse.json();
            if (projectsData.data) {
                const assignedCount = projectsData.data.filter(
                    (pc: any) => pc.consultantId === consultantId
                ).length;
                setProjectsAssigned(assignedCount);
            }
        } catch (error) {
            console.log("Could not load consultant stats");
        }
    };

    const handleSaveProfile = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            showToast("First and last name are required", "error");
            return;
        }

        setIsSaving(true);

        try {
            // update localStorage
            const stored = localStorage.getItem("timely_user");
            if (stored) {
                const parsed = JSON.parse(stored);
                const updated = {
                    ...parsed,
                    name: `${firstName.trim()} ${lastName.trim()}`,
                    phone: phone.trim(),
                };
                localStorage.setItem("timely_user", JSON.stringify(updated));

                setUserData(prev => prev ? {
                    ...prev,
                    name: updated.name,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phone: phone.trim(),
                } : null);
            }

            // TASK: send update to server api
            // currently only updating localStorage
            // need to create PUT /api/users/:id endpoint

            showToast("Profile updated successfully", "success");
        } catch (error) {
            showToast("Failed to update profile", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword) {
            showToast("Current password is required", "error");
            return;
        }
        if (!newPassword) {
            showToast("New password is required", "error");
            return;
        }
        if (newPassword.length < 8) {
            showToast("Password must be at least 8 characters", "error");
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast("Passwords do not match", "error");
            return;
        }

        setIsSaving(true);

        try {
            // TASK: implement password change api
            // need to create POST /api/users/change-password endpoint
            // should verify current password before allowing change

            // simulating api call
            await new Promise(resolve => setTimeout(resolve, 1000));

            showToast("Password changed successfully", "success");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setShowPasswordSection(false);
        } catch (error) {
            showToast("Failed to change password", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className={`min-h-screen ${styles.bg} flex items-center justify-center`}>
                <div className={`${styles.textMuted}`}>Loading profile...</div>
            </div>
        );
    }

    if (!userData) {
        return (
            <div className={`min-h-screen ${styles.bg} flex items-center justify-center`}>
                <div className={`${styles.textMuted}`}>No user data found. Please log in again.</div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${styles.bg}`}>
            {/* toast notifications */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(toast => (
                    <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${styles.card}`}>
                        <ToastIcon type={toast.type} />
                        <span className={styles.text}>{toast.message}</span>
                        <button onClick={() => dismissToast(toast.id)} className={styles.textMuted}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* page header */}
            <div className="mb-6">
                <h1 className={`text-2xl font-semibold ${styles.text}`}>Profile</h1>
                <p className={styles.textMuted}>Manage your account settings and preferences</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* left column - profile card */}
                <div className="lg:col-span-1">
                    <div className={`${styles.card} border rounded-xl p-6`}>
                        {/* avatar */}
                        <div className="flex flex-col items-center mb-6">
                            <div className="relative">
                                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                                    {getUserInitials(userData.name)}
                                </div>
                                <button className={`absolute bottom-0 right-0 p-2 ${styles.card} border rounded-full ${styles.cardHover}`}>
                                    <Camera className="w-4 h-4" />
                                </button>
                            </div>
                            <h2 className={`${styles.text} text-xl font-semibold mt-4`}>{userData.name}</h2>
                            <p className={styles.textMuted}>{userData.email}</p>
                            <span className={`mt-2 px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(userData.role)}`}>
                                {getRoleLabel(userData.role)}
                            </span>
                        </div>

                        {/* quick stats for consultants */}
                        {userData.role === "consultant" && (
                            <div className={`border-t ${styles.divider} pt-4 space-y-3`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock className={`w-4 h-4 ${styles.textMuted}`} />
                                        <span className={styles.textMuted}>Hours Logged</span>
                                    </div>
                                    <span className={`${styles.text} font-semibold`}>{hoursLogged}h</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className={`w-4 h-4 ${styles.textMuted}`} />
                                        <span className={styles.textMuted}>Projects</span>
                                    </div>
                                    <span className={`${styles.text} font-semibold`}>{projectsAssigned}</span>
                                </div>
                                {userData.consultantCode && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Shield className={`w-4 h-4 ${styles.textMuted}`} />
                                            <span className={styles.textMuted}>Code</span>
                                        </div>
                                        <span className={`${styles.text} font-mono text-sm`}>{userData.consultantCode}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* member since */}
                        <div className={`border-t ${styles.divider} pt-4 mt-4`}>
                            <div className="flex items-center gap-2">
                                <Calendar className={`w-4 h-4 ${styles.textMuted}`} />
                                <span className={styles.textMuted}>Member since</span>
                            </div>
                            <p className={`${styles.text} mt-1`}>
                                {userData.joinDate
                                    ? new Date(userData.joinDate).toLocaleDateString("en-US", {
                                        month: "long",
                                        year: "numeric",
                                    })
                                    : "N/A"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* right column - edit forms */}
                <div className="lg:col-span-2 space-y-6">
                    {/* personal information */}
                    <div className={`${styles.card} border rounded-xl p-6`}>
                        <h3 className={`${styles.text} font-semibold mb-4 flex items-center gap-2`}>
                            <User className={`w-5 h-5 ${styles.accent}`} />
                            Personal Information
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`${styles.textMuted} text-sm block mb-1`}>First Name</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={e => setFirstName(e.target.value)}
                                    className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`}
                                />
                            </div>
                            <div>
                                <label className={`${styles.textMuted} text-sm block mb-1`}>Last Name</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={e => setLastName(e.target.value)}
                                    className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`}
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className={`${styles.textMuted} text-sm block mb-1`}>Email Address</label>
                            <div className="flex gap-2">
                                <div className={`flex-1 px-4 py-2.5 ${styles.cardInner} border ${styles.divider} rounded-lg ${styles.textMuted} flex items-center gap-2`}>
                                    <Mail className="w-4 h-4" />
                                    {userData.email}
                                </div>
                            </div>
                            <p className={`${styles.textSubtle} text-xs mt-1`}>
                                Email cannot be changed. Contact support if needed.
                            </p>
                        </div>

                        <div className="mt-4">
                            <label className={`${styles.textMuted} text-sm block mb-1`}>Phone Number</label>
                            <div className="relative">
                                <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${styles.textMuted}`} />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="Enter phone number"
                                    className={`w-full pl-10 pr-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`}
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className={`px-5 py-2.5 ${styles.buttonPrimary} rounded-lg flex items-center gap-2 disabled:opacity-50`}
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>

                    {/* security section */}
                    <div className={`${styles.card} border rounded-xl p-6`}>
                        <h3 className={`${styles.text} font-semibold mb-4 flex items-center gap-2`}>
                            <Key className={`w-5 h-5 ${styles.accent}`} />
                            Security
                        </h3>

                        {!showPasswordSection ? (
                            <button
                                onClick={() => setShowPasswordSection(true)}
                                className={`px-4 py-2.5 ${styles.button} rounded-lg flex items-center gap-2`}
                            >
                                <Key className="w-4 h-4" />
                                Change Password
                            </button>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className={`${styles.textMuted} text-sm block mb-1`}>Current Password</label>
                                    <div className="relative">
                                        <input
                                            type={showCurrentPassword ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            className={`w-full px-4 py-2.5 pr-10 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className={`absolute right-3 top-1/2 -translate-y-1/2 ${styles.textMuted}`}
                                        >
                                            {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className={`${styles.textMuted} text-sm block mb-1`}>New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className={`w-full px-4 py-2.5 pr-10 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className={`absolute right-3 top-1/2 -translate-y-1/2 ${styles.textMuted}`}
                                        >
                                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className={`${styles.textSubtle} text-xs mt-1`}>
                                        Must be at least 8 characters
                                    </p>
                                </div>

                                <div>
                                    <label className={`${styles.textMuted} text-sm block mb-1`}>Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`}
                                    />
                                </div>

                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => {
                                            setShowPasswordSection(false);
                                            setCurrentPassword("");
                                            setNewPassword("");
                                            setConfirmPassword("");
                                        }}
                                        className={`px-4 py-2.5 ${styles.button} rounded-lg`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleChangePassword}
                                        disabled={isSaving}
                                        className={`px-5 py-2.5 ${styles.buttonPrimary} rounded-lg flex items-center gap-2 disabled:opacity-50`}
                                    >
                                        <Key className="w-4 h-4" />
                                        {isSaving ? "Changing..." : "Change Password"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* role information - read only */}
                    <div className={`${styles.card} border rounded-xl p-6`}>
                        <h3 className={`${styles.text} font-semibold mb-4 flex items-center gap-2`}>
                            <Shield className={`w-5 h-5 ${styles.accent}`} />
                            Account Information
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`${styles.textMuted} text-sm block mb-1`}>Account Type</label>
                                <div className={`px-4 py-2.5 ${styles.cardInner} border ${styles.divider} rounded-lg`}>
                                    <span className={`px-2 py-1 rounded text-sm font-medium ${getRoleBadgeColor(userData.role)}`}>
                                        {getRoleLabel(userData.role)}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className={`${styles.textMuted} text-sm block mb-1`}>Account ID</label>
                                <div className={`px-4 py-2.5 ${styles.cardInner} border ${styles.divider} rounded-lg ${styles.textMuted} font-mono text-sm`}>
                                    {userData.customerId || userData.consultantId || "N/A"}
                                </div>
                            </div>
                        </div>

                        <p className={`${styles.textSubtle} text-xs mt-4`}>
                            Account type and ID cannot be changed. Contact an administrator for assistance.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;