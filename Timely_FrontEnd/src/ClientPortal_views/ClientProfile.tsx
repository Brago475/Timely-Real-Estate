// src/ClientPortal_views/ClientProfile.tsx
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../Views_Layouts/ThemeContext";
import {
    User,
    Mail,
    Phone,
    MapPin,
    Building,
    Calendar,
    Edit3,
    Save,
    X,
    Camera,
    Upload,
    Trash2,
    CheckCircle,
    AlertCircle,
    Shield,
    Clock,
    FolderOpen,
    Info,
    Briefcase,
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

type ClientProfileProps = {
    userName?: string;
    userEmail?: string;
    customerId?: string;
    onProfileUpdate?: (data: ProfileData) => void;
};

interface ProfileData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    bio: string;
    avatar: string | null;
}

interface Toast {
    id: string;
    message: string;
    type: "success" | "error" | "info";
}

const STORAGE_KEY = "timely_client_profile";

const ClientProfile: React.FC<ClientProfileProps> = ({
    userName = "",
    userEmail = "",
    customerId = "",
    onProfileUpdate,
}) => {
    const { isDark } = useTheme();

    const s = {
        bg: isDark ? "bg-slate-950" : "bg-gray-50",
        card: isDark ? "bg-slate-900 border-slate-800" : "bg-white border-gray-200",
        cardHover: isDark ? "hover:bg-slate-800/80" : "hover:bg-gray-50",
        cardInner: isDark ? "bg-slate-800" : "bg-gray-100",
        text: isDark ? "text-white" : "text-gray-900",
        textMuted: isDark ? "text-slate-400" : "text-gray-600",
        textSubtle: isDark ? "text-slate-500" : "text-gray-400",
        divider: isDark ? "border-slate-800" : "border-gray-200",
        button: isDark ? "bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white" : "bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-800",
        buttonPrimary: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white",
        buttonDanger: "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white",
        input: isDark
            ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
            : "bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500",
        label: isDark ? "text-slate-300" : "text-gray-700",
    };

    // Parse name into first/last
    const nameParts = userName.split(" ");
    const defaultFirstName = nameParts[0] || "";
    const defaultLastName = nameParts.slice(1).join(" ") || "";

    const defaultProfile: ProfileData = {
        firstName: defaultFirstName,
        lastName: defaultLastName,
        email: userEmail,
        phone: "",
        company: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
        bio: "",
        avatar: null,
    };

    const [profile, setProfile] = useState<ProfileData>(defaultProfile);
    const [editMode, setEditMode] = useState(false);
    const [editedProfile, setEditedProfile] = useState<ProfileData>(defaultProfile);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [stats, setStats] = useState({ projects: 0, totalHours: 0, memberSince: "" });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load profile from localStorage and API
    useEffect(() => {
        loadProfile();
        loadStats();
    }, [customerId]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            // Try loading from localStorage first
            const saved = localStorage.getItem(`${STORAGE_KEY}_${customerId}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                setProfile({ ...defaultProfile, ...parsed });
                setEditedProfile({ ...defaultProfile, ...parsed });
                if (parsed.avatar) {
                    setAvatarPreview(parsed.avatar);
                }
            }

            // Also try to fetch from API for latest data
            if (customerId) {
                const response = await fetch(`${API_BASE}/clients/${customerId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.data) {
                        const apiProfile = {
                            firstName: data.data.firstName || defaultFirstName,
                            lastName: data.data.lastName || defaultLastName,
                            email: data.data.email || userEmail,
                            phone: data.data.phone || "",
                            company: data.data.companyName || "",
                            address: data.data.address || "",
                            city: data.data.city || "",
                            state: data.data.state || "",
                            zipCode: data.data.zipCode || "",
                            country: data.data.country || "",
                            bio: data.data.bio || "",
                            avatar: null,
                        };
                        // Merge with saved avatar
                        const savedData = saved ? JSON.parse(saved) : {};
                        const mergedProfile = { ...apiProfile, avatar: savedData.avatar || null };
                        setProfile(mergedProfile);
                        setEditedProfile(mergedProfile);
                        if (savedData.avatar) {
                            setAvatarPreview(savedData.avatar);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Error loading profile:", e);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            // Get projects count from API
            const projectClientsRes = await fetch(`${API_BASE}/project-clients`);
            let clientProjectIds: string[] = [];

            if (projectClientsRes.ok) {
                const pcData = await projectClientsRes.json();
                clientProjectIds = (pcData.data || [])
                    .filter((pc: any) => String(pc.clientId) === String(customerId))
                    .map((pc: any) => String(pc.projectId));
            } else {
                // Fallback to localStorage
                const projectClients = JSON.parse(localStorage.getItem("timely_project_clients") || "[]");
                clientProjectIds = projectClients
                    .filter((pc: any) => String(pc.clientId) === String(customerId))
                    .map((pc: any) => String(pc.projectId));
            }

            // Get hours from API
            const hoursRes = await fetch(`${API_BASE}/hours-logs`);
            let totalHours = 0;
            if (hoursRes.ok) {
                const hoursData = await hoursRes.json();
                if (hoursData.data) {
                    totalHours = hoursData.data
                        .filter((h: any) => clientProjectIds.includes(String(h.projectId)))
                        .reduce((sum: number, h: any) => sum + (parseFloat(h.hours) || 0), 0);
                }
            }

            // Get member since from client data
            let memberSince = "";
            if (customerId) {
                const clientRes = await fetch(`${API_BASE}/clients/${customerId}`);
                if (clientRes.ok) {
                    const clientData = await clientRes.json();
                    memberSince = clientData.data?.createdAt || clientData.data?.dateAdded || "";
                }
            }

            setStats({
                projects: clientProjectIds.length,
                totalHours,
                memberSince,
            });
        } catch (e) {
            console.error("Could not load stats:", e);
        }
    };

    // Toast notification
    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        const id = `toast_${Date.now()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };

    // Get initials
    const getInitials = (first: string, last: string) => {
        return `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "?";
    };

    // Handle avatar upload
    const handleAvatarClick = () => {
        if (editMode) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                showToast("Image must be less than 5MB", "error");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setAvatarPreview(base64);
                setEditedProfile((prev) => ({ ...prev, avatar: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveAvatar = () => {
        setAvatarPreview(null);
        setEditedProfile((prev) => ({ ...prev, avatar: null }));
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Handle input change
    const handleChange = (field: keyof ProfileData, value: string) => {
        setEditedProfile((prev) => ({ ...prev, [field]: value }));
    };

    // Save profile
    const handleSave = async () => {
        setSaving(true);
        try {
            // Save to localStorage
            localStorage.setItem(`${STORAGE_KEY}_${customerId}`, JSON.stringify(editedProfile));

            // Try to update via API as well
            if (customerId) {
                await fetch(`${API_BASE}/clients/${customerId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        firstName: editedProfile.firstName,
                        lastName: editedProfile.lastName,
                        phone: editedProfile.phone,
                        companyName: editedProfile.company,
                        address: editedProfile.address,
                        city: editedProfile.city,
                        state: editedProfile.state,
                        zipCode: editedProfile.zipCode,
                        country: editedProfile.country,
                    }),
                }).catch(() => { }); // Silently fail API update
            }

            setProfile(editedProfile);
            setEditMode(false);
            showToast("Profile saved successfully", "success");

            if (onProfileUpdate) {
                onProfileUpdate(editedProfile);
            }
        } catch (e) {
            showToast("Failed to save profile", "error");
        } finally {
            setSaving(false);
        }
    };

    // Cancel edit
    const handleCancel = () => {
        setEditedProfile(profile);
        setAvatarPreview(profile.avatar);
        setEditMode(false);
    };

    // Format date
    const formatDate = (d: string) => {
        if (!d) return "N/A";
        const date = new Date(d);
        if (isNaN(date.getTime())) return "N/A";
        return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    };

    // Format hours
    const formatHours = (h: number) => {
        if (!h || h === 0) return "0h";
        const hr = Math.floor(h);
        const mn = Math.round((h - hr) * 60);
        return mn === 0 ? `${hr}h` : `${hr}h ${mn}m`;
    };

    // Input field component with animations
    const InputField = ({
        label,
        field,
        type = "text",
        placeholder = "",
        icon: Icon,
        disabled = false,
    }: {
        label: string;
        field: keyof ProfileData;
        type?: string;
        placeholder?: string;
        icon?: React.ElementType;
        disabled?: boolean;
    }) => (
        <div className="group">
            <label className={`block text-sm font-semibold ${s.label} mb-2`}>{label}</label>
            <div className="relative">
                {Icon && (
                    <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${s.textMuted} group-focus-within:text-blue-500 transition-colors`} />
                )}
                <input
                    type={type}
                    value={editedProfile[field] as string}
                    onChange={(e) => handleChange(field, e.target.value)}
                    placeholder={placeholder}
                    disabled={!editMode || disabled}
                    className={`w-full ${Icon ? "pl-10" : "pl-4"} pr-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${!editMode || disabled ? "opacity-60 cursor-not-allowed" : "hover:border-blue-500/50"
                        }`}
                />
            </div>
        </div>
    );

    // Section header component
    const SectionHeader = ({ icon: Icon, title, gradient }: { icon: React.ElementType; title: string; gradient: string }) => (
        <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
            </div>
            <h3 className={`text-lg font-bold ${s.text}`}>{title}</h3>
        </div>
    );

    if (loading) {
        return (
            <div className={`${s.bg} min-h-full flex items-center justify-center`}>
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className={s.textMuted}>Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`${s.bg} min-h-full`}>
            {/* Toast Notifications */}
            <div className="fixed top-20 right-4 z-[10000] space-y-2">
                {toasts.map((toast, index) => (
                    <div
                        key={toast.id}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border ${s.card} animate-in slide-in-from-right duration-300`}
                    >
                        {toast.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                        {toast.type === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {toast.type === "info" && <Info className="w-5 h-5 text-blue-500" />}
                        <span className={s.text}>{toast.message}</span>
                        <button
                            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                            className={`ml-2 ${s.textMuted} hover:${s.text} transition-colors`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className={`text-2xl font-bold ${s.text}`}>Profile</h1>
                        <p className={`text-sm ${s.textMuted} mt-1`}>Manage your personal information</p>
                    </div>
                    {!editMode ? (
                        <button
                            onClick={() => setEditMode(true)}
                            className={`${s.buttonPrimary} px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0`}
                        >
                            <Edit3 className="w-4 h-4" />
                            Edit Profile
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCancel}
                                className={`${s.button} px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-95`}
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`${s.buttonPrimary} px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70`}
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Profile Card */}
                <div className={`${s.card} border rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl`}>
                    {/* Banner */}
                    <div className="h-36 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 relative overflow-hidden">
                        <div className="absolute inset-0 bg-black/10" />
                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>

                    {/* Avatar & Basic Info */}
                    <div className="px-6 pb-6">
                        <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16">
                            {/* Avatar */}
                            <div className="relative group">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <div
                                    onClick={handleAvatarClick}
                                    className={`w-32 h-32 rounded-2xl border-4 ${isDark ? "border-slate-900" : "border-white"} shadow-2xl overflow-hidden transition-all duration-300 ${editMode ? "cursor-pointer hover:scale-105" : ""
                                        }`}
                                >
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-purple-500/30">
                                            {getInitials(editedProfile.firstName, editedProfile.lastName)}
                                        </div>
                                    )}
                                    {editMode && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-2xl">
                                            <Camera className="w-8 h-8 text-white" />
                                        </div>
                                    )}
                                </div>
                                {editMode && avatarPreview && (
                                    <button
                                        onClick={handleRemoveAvatar}
                                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all duration-200 shadow-lg hover:scale-110 active:scale-95"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Name & Role */}
                            <div className="flex-1 md:mb-2">
                                <h2 className={`text-2xl font-bold ${s.text}`}>
                                    {profile.firstName || profile.lastName
                                        ? `${profile.firstName} ${profile.lastName}`.trim()
                                        : "No Name Set"}
                                </h2>
                                <p className={s.textMuted}>{profile.email || "No email"}</p>
                                <div className="flex items-center gap-3 mt-3 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-400 font-semibold">
                                        <User className="w-3.5 h-3.5" />
                                        Client
                                    </span>
                                    {stats.memberSince && (
                                        <span className={`text-xs ${s.textSubtle} flex items-center gap-1`}>
                                            <Calendar className="w-3.5 h-3.5" />
                                            Member since {formatDate(stats.memberSince)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex gap-6 md:mb-2">
                                <div className="text-center group cursor-default">
                                    <p className={`text-2xl font-bold ${s.text} group-hover:text-blue-500 transition-colors`}>{stats.projects}</p>
                                    <p className={`text-xs ${s.textMuted}`}>Projects</p>
                                </div>
                                <div className="text-center group cursor-default">
                                    <p className={`text-2xl font-bold ${s.text} group-hover:text-emerald-500 transition-colors`}>{formatHours(stats.totalHours)}</p>
                                    <p className={`text-xs ${s.textMuted}`}>Hours</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Personal Information */}
                <div className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={User} title="Personal Information" gradient="from-blue-500 to-blue-600" />

                    <div className="grid gap-5 md:grid-cols-2">
                        <InputField label="First Name" field="firstName" placeholder="Enter first name" icon={User} />
                        <InputField label="Last Name" field="lastName" placeholder="Enter last name" icon={User} />
                        <InputField label="Email" field="email" type="email" placeholder="Enter email" icon={Mail} disabled />
                        <InputField label="Phone" field="phone" type="tel" placeholder="Enter phone number" icon={Phone} />
                        <div className="md:col-span-2">
                            <label className={`block text-sm font-semibold ${s.label} mb-2`}>Bio</label>
                            <textarea
                                value={editedProfile.bio}
                                onChange={(e) => handleChange("bio", e.target.value)}
                                placeholder="Tell us a little about yourself..."
                                disabled={!editMode}
                                rows={3}
                                className={`w-full px-4 py-3 rounded-xl border ${s.input} focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 resize-none ${!editMode ? "opacity-60 cursor-not-allowed" : "hover:border-blue-500/50"
                                    }`}
                            />
                        </div>
                    </div>
                </div>

                {/* Company & Address */}
                <div className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={Building} title="Company & Address" gradient="from-emerald-500 to-emerald-600" />

                    <div className="grid gap-5 md:grid-cols-2">
                        <InputField label="Company" field="company" placeholder="Enter company name" icon={Building} />
                        <div /> {/* Spacer */}
                        <div className="md:col-span-2">
                            <InputField label="Street Address" field="address" placeholder="Enter street address" icon={MapPin} />
                        </div>
                        <InputField label="City" field="city" placeholder="Enter city" />
                        <InputField label="State / Province" field="state" placeholder="Enter state" />
                        <InputField label="ZIP / Postal Code" field="zipCode" placeholder="Enter ZIP code" />
                        <InputField label="Country" field="country" placeholder="Enter country" />
                    </div>
                </div>

                {/* Account Information (Read-only) */}
                <div className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={Shield} title="Account Information" gradient="from-purple-500 to-purple-600" />

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className={`p-4 ${s.cardInner} rounded-xl transition-all duration-200 hover:shadow-md group`}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                                <p className={`text-xs font-medium ${s.textSubtle} uppercase tracking-wider`}>Customer ID</p>
                            </div>
                            <p className={`font-mono text-sm ${s.text}`}>{customerId || "N/A"}</p>
                        </div>
                        <div className={`p-4 ${s.cardInner} rounded-xl transition-all duration-200 hover:shadow-md group`}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                    <Calendar className="w-4 h-4 text-white" />
                                </div>
                                <p className={`text-xs font-medium ${s.textSubtle} uppercase tracking-wider`}>Member Since</p>
                            </div>
                            <p className={`text-sm ${s.text}`}>{formatDate(stats.memberSince)}</p>
                        </div>
                        <div className={`p-4 ${s.cardInner} rounded-xl transition-all duration-200 hover:shadow-md group`}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                                    <Shield className="w-4 h-4 text-white" />
                                </div>
                                <p className={`text-xs font-medium ${s.textSubtle} uppercase tracking-wider`}>Account Type</p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-400 text-sm font-semibold">
                                <Briefcase className="w-3.5 h-3.5" />
                                Client
                            </span>
                        </div>
                    </div>

                    <p className={`text-xs ${s.textMuted} mt-5 p-3 ${s.cardInner} rounded-xl flex items-center gap-2`}>
                        <Info className="w-4 h-4 text-blue-500 shrink-0" />
                        To change your email or account type, please contact your consultant or support.
                    </p>
                </div>

                {/* Activity Summary */}
                <div className={`${s.card} border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg`}>
                    <SectionHeader icon={Clock} title="Activity Summary" gradient="from-amber-500 to-amber-600" />

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className={`p-5 ${s.cardInner} rounded-xl flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-1 cursor-default group`}>
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                <FolderOpen className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${s.text}`}>{stats.projects}</p>
                                <p className={`text-sm ${s.textMuted}`}>Active Projects</p>
                            </div>
                        </div>
                        <div className={`p-5 ${s.cardInner} rounded-xl flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-1 cursor-default group`}>
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                <Clock className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${s.text}`}>{formatHours(stats.totalHours)}</p>
                                <p className={`text-sm ${s.textMuted}`}>Total Hours</p>
                            </div>
                        </div>
                        <div className={`p-5 ${s.cardInner} rounded-xl flex items-center gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-1 cursor-default group`}>
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                <Calendar className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${s.text}`}>
                                    {stats.memberSince ? formatDate(stats.memberSince).split(" ")[0] : "N/A"}
                                </p>
                                <p className={`text-sm ${s.textMuted}`}>Member Since</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientProfile;