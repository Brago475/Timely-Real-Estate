import React, { useMemo, useState } from "react";
import { useTheme } from '../Views_Layouts/ThemeContext';
import { User, Briefcase, Mail, Key, Link2, Copy, Send, Save, Trash2, CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const API_BASE = "http://localhost:4000";

type AccountType = "client" | "consultant";
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

const EmailGenerator: React.FC = () => {
    const { isDark } = useTheme();
    const styles = {
        bg: isDark ? 'bg-slate-950' : 'bg-gray-50',
        text: isDark ? 'text-white' : 'text-gray-900',
        textMuted: isDark ? 'text-slate-400' : 'text-gray-600',
        textSubtle: isDark ? 'text-slate-500' : 'text-gray-400',
        card: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200',
        cardHover: isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50',
        cardInner: isDark ? 'bg-slate-800' : 'bg-gray-50',
        input: isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900',
        inputFocus: isDark ? 'focus:border-blue-500' : 'focus:border-blue-500',
        button: isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
        buttonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white',
        divider: isDark ? 'border-slate-700' : 'border-gray-200',
        accent: isDark ? 'text-blue-400' : 'text-blue-600',
    };

    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        const id = `toast_${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };
    const ToastIcon = ({ type }: { type: string }) => {
        if (type === 'success') return <CheckCircle className="w-5 h-5 text-emerald-400" />;
        if (type === 'error') return <AlertCircle className="w-5 h-5 text-red-400" />;
        return <Info className="w-5 h-5 text-blue-400" />;
    };

    const [accountType, setAccountType] = useState<AccountType>("client");
    const [firstName, setFirstName] = useState("");
    const [middleName, setMiddleName] = useState("");
    const [lastName, setLastName] = useState("");
    const [personalEmail, setPersonalEmail] = useState("");
    const [consultantRole, setConsultantRole] = useState("");
    const [tempPassword, setTempPassword] = useState("");
    const [inviteLink, setInviteLink] = useState("");
    const [saving, setSaving] = useState(false);

    const companyEmail = useMemo(() => {
        const f = firstName.trim(), l = lastName.trim();
        if (!f || !l) return "";
        return `${l.replace(/\s+/g, "").toLowerCase()}${f[0].toLowerCase()}@timely.com`;
    }, [firstName, lastName]);

    const copyToClipboard = (value: string, label: string) => {
        if (!value) { showToast(`Nothing to copy for ${label}`, 'error'); return; }
        navigator.clipboard.writeText(value).then(
            () => showToast(`${label} copied`, 'success'),
            () => showToast("Could not copy to clipboard", 'error')
        );
    };

    const generateStrongPassword = () => {
        const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ", lower = "abcdefghijkmnopqrstuvwxyz", digits = "23456789", symbols = "!@$%^&*?";
        const all = upper + lower + digits + symbols;
        const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
        let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
        while (pwd.length < 12) pwd += pick(all);
        setTempPassword(pwd.split("").sort(() => Math.random() - 0.5).join(""));
        showToast("Password generated", 'success');
    };

    const createInviteLink = () => {
        if (!companyEmail || !personalEmail.trim()) { showToast("Company email and personal email required", 'error'); return; }
        const token = Math.random().toString(36).slice(2, 12);
        setInviteLink(`https://timely.example.com/invite?email=${encodeURIComponent(companyEmail)}&token=${token}`);
        showToast("Invite link generated", 'success');
    };

    const sendMailtoInvite = () => {
        if (!personalEmail.trim()) { showToast("Personal email required", 'error'); return; }
        const fullName = `${firstName} ${middleName ? middleName + " " : ""}${lastName}`.trim();
        const typeLabel = accountType === "client" ? "Client" : "Consultant";
        const subject = `Your Timely ${typeLabel} Account Information`;
        const bodyLines = [
            fullName ? `Hello ${fullName},` : "Hello,", "",
            `Your Timely ${typeLabel.toLowerCase()} account has been created.`, "",
            companyEmail ? `Login email: ${companyEmail}` : "",
            tempPassword ? `Temporary password: ${tempPassword}` : "", "",
            accountType === "consultant" && consultantRole ? `Role: ${consultantRole}` : "",
            inviteLink ? `Invite link: ${inviteLink}` : "", "",
            "Please change your password after first login.", "", "Best regards,", "Timely Admin",
        ].filter(Boolean);
        window.location.href = `mailto:${encodeURIComponent(personalEmail.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    };

    const clearForm = () => {
        setFirstName(""); setMiddleName(""); setLastName(""); setPersonalEmail("");
        setConsultantRole(""); setTempPassword(""); setInviteLink("");
        showToast("Form cleared", 'info');
    };

    const saveToDatabase = async () => {
        if (!firstName.trim() || !lastName.trim()) { showToast("First and last name required", 'error'); return; }
        if (!companyEmail) { showToast("Company email missing", 'error'); return; }
        if (!tempPassword) { showToast("Generate a password first", 'error'); return; }

        setSaving(true);
        try {
            let performedBy = 'admin';
            try { const stored = localStorage.getItem("timely_user"); if (stored) { const u = JSON.parse(stored); if (u?.email) performedBy = u.email; } } catch { }

            if (accountType === "client") {
                const response = await fetch(`${API_BASE}/api/users-csv`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ firstName: firstName.trim(), middleName: middleName.trim(), lastName: lastName.trim(), email: companyEmail, tempPassword, performedBy })
                });
                if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Failed to save client"); }
                const data = await response.json();
                showToast(`Client created: ${data.clientCode} - Welcome email sent!`, 'success');
            } else {
                const response = await fetch(`${API_BASE}/api/consultants`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: companyEmail, tempPassword, role: consultantRole.trim() || "Consultant", performedBy })
                });
                if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Failed to save consultant"); }
                const data = await response.json();
                showToast(`Consultant created: ${data.consultantCode} - Welcome email sent!`, 'success');
            }
            clearForm();
        } catch (err: any) { showToast(err.message || `Error saving ${accountType}`, 'error'); } finally { setSaving(false); }
    };

    return (
        <div className={`min-h-screen ${styles.bg}`}>
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(toast => (
                    <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                        <ToastIcon type={toast.type} /><span className={styles.text}>{toast.message}</span>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className={styles.textMuted}><X className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>

            <div className="max-w-2xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h1 className={`text-4xl font-bold ${styles.text} mb-2`}>Create Account</h1>
                    <p className={styles.textMuted}>Register a new client or consultant account</p>
                </div>

                <div className={`${styles.card} border rounded-lg overflow-hidden`}>
                    <div className="p-6 space-y-6">
                        <div>
                            <label className={`${styles.textMuted} text-sm block mb-2`}>Account Type</label>
                            <div className={`flex rounded-lg border ${styles.divider} overflow-hidden`}>
                                <button onClick={() => setAccountType("client")} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${accountType === "client" ? styles.buttonPrimary : styles.button}`}>
                                    <User className="w-4 h-4" />Client
                                </button>
                                <button onClick={() => setAccountType("consultant")} className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-l ${styles.divider} transition-colors ${accountType === "consultant" ? styles.buttonPrimary : styles.button}`}>
                                    <Briefcase className="w-4 h-4" />Consultant
                                </button>
                            </div>
                            <p className={`${styles.textSubtle} text-xs mt-2`}>{accountType === "client" ? "Clients can view their own projects and data" : "Consultants have access to the staff dashboard"}</p>
                        </div>

                        <div className={`border-t ${styles.divider}`} />

                        <div>
                            <h2 className={`${styles.text} font-semibold mb-4 flex items-center gap-2`}><User className={`w-5 h-5 ${styles.accent}`} />Personal Information</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className={`${styles.textMuted} text-sm block mb-1`}>First Name *</label><input type="text" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`} /></div>
                                <div><label className={`${styles.textMuted} text-sm block mb-1`}>Last Name *</label><input type="text" placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`} /></div>
                            </div>
                            {accountType === "client" && (
                                <div className="mt-4"><label className={`${styles.textMuted} text-sm block mb-1`}>Middle Name</label><input type="text" placeholder="Optional" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`} /></div>
                            )}
                            {accountType === "consultant" && (
                                <div className="mt-4"><label className={`${styles.textMuted} text-sm block mb-1`}>Role / Title</label><input type="text" placeholder="e.g. Senior Consultant" value={consultantRole} onChange={(e) => setConsultantRole(e.target.value)} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`} /></div>
                            )}
                            <div className="mt-4"><label className={`${styles.textMuted} text-sm block mb-1`}>Personal Email (optional)</label><input type="email" placeholder="personal@example.com" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`} /><p className={`${styles.textSubtle} text-xs mt-1`}>Used for manual invite - welcome email goes to company email automatically</p></div>
                        </div>

                        <div className={`border-t ${styles.divider}`} />

                        <div>
                            <h2 className={`${styles.text} font-semibold mb-4 flex items-center gap-2`}><Key className={`w-5 h-5 ${styles.accent}`} />Account Credentials</h2>
                            <div className="mb-4"><label className={`${styles.textMuted} text-sm block mb-1`}>Company Email</label><div className={`px-4 py-2.5 ${styles.cardInner} border ${styles.divider} rounded-lg ${styles.textMuted}`}>{companyEmail || "Enter first and last name"}</div></div>
                            <div>
                                <label className={`${styles.textMuted} text-sm block mb-1`}>Temporary Password *</label>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Click Generate" value={tempPassword} readOnly className={`flex-1 px-4 py-2.5 ${styles.input} border rounded-lg font-mono`} />
                                    <button onClick={generateStrongPassword} className={`px-4 py-2.5 ${styles.buttonPrimary} rounded-lg`}>Generate</button>
                                    <button onClick={() => copyToClipboard(tempPassword, "Password")} className={`px-4 py-2.5 ${styles.button} rounded-lg`}><Copy className="w-4 h-4" /></button>
                                </div>
                            </div>
                        </div>

                        <div className={`border-t ${styles.divider}`} />

                        <div>
                            <h2 className={`${styles.text} font-semibold mb-4 flex items-center gap-2`}><Link2 className={`w-5 h-5 ${styles.accent}`} />Invitation (Optional)</h2>
                            <div>
                                <label className={`${styles.textMuted} text-sm block mb-1`}>Invite Link</label>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Click Create to generate" value={inviteLink} readOnly className={`flex-1 px-4 py-2.5 ${styles.input} border rounded-lg text-sm`} />
                                    <button onClick={createInviteLink} className={`px-4 py-2.5 ${styles.button} rounded-lg`}>Create</button>
                                    <button onClick={() => copyToClipboard(inviteLink, "Invite link")} className={`px-4 py-2.5 ${styles.button} rounded-lg`}><Copy className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-blue-900/30 border-blue-800' : 'bg-blue-50 border-blue-200'} border`}>
                                <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                                    <strong>Automatic Email:</strong> When you save the account, a welcome email with login credentials will be automatically sent to the company email address and saved to the Email Outbox.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={`px-6 py-4 ${styles.cardInner} border-t ${styles.divider} flex flex-wrap items-center justify-between gap-3`}>
                        <div className="flex gap-2">
                            <button onClick={clearForm} className={`px-4 py-2.5 ${styles.button} rounded-lg flex items-center gap-2`}><Trash2 className="w-4 h-4" />Clear</button>
                            <button onClick={() => copyToClipboard(companyEmail, "Company email")} className={`px-4 py-2.5 ${styles.button} rounded-lg flex items-center gap-2`}><Mail className="w-4 h-4" />Copy Email</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={sendMailtoInvite} className={`px-4 py-2.5 ${styles.button} rounded-lg flex items-center gap-2`}><Send className="w-4 h-4" />Send Invite</button>
                            <button onClick={saveToDatabase} disabled={saving} className={`px-5 py-2.5 ${styles.buttonPrimary} rounded-lg flex items-center gap-2 disabled:opacity-50`}><Save className="w-4 h-4" />{saving ? "Saving..." : "Save Account"}</button>
                        </div>
                    </div>
                </div>

                <p className={`${styles.textSubtle} text-xs mt-4 text-center`}>
                    {accountType === "client" ? "Client accounts stored in users.csv - Welcome email sent automatically" : "Consultant accounts stored in consultants.csv - Welcome email sent automatically"}
                </p>
            </div>
        </div>
    );
};

export default EmailGenerator;