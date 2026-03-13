// src/Tabs/settings.tsx
import React, { useState, useEffect } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import { Shield, User, Bell, Eye, History, Users, FileText, Trash2, Lock, Mail, Phone, Building, X, AlertTriangle, Moon, Sun, Globe, MapPin, Download, Upload, Edit2, Save, Smartphone, Monitor, RefreshCw, CheckCircle, XCircle, MessageSquare, Info, Calendar } from 'lucide-react';

const API_BASE = '/api';
const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null; return await r.json(); } catch { return null; } };

const EyeOff = ({ className }: { className?: string }) => (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>);

type UserRole = 'admin' | 'consultant' | 'client';
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }
interface UserProfile { customerId: string; firstName: string; lastName: string; email: string; phone: string; companyName?: string; preferredContact?: 'email' | 'phone'; role?: string; tempPassword?: string; photoUrl?: string; calendarLink?: string; }
interface ConsultantInfo { consultantId: string; firstName: string; lastName: string; email: string; phone?: string; role?: string; calendarLink?: string; }
interface LoginActivity { id: string; date: string; time: string; device: string; location: string; ip: string; current: boolean; }
interface Document { id: string; name: string; type: string; uploadDate: string; size: string; }

const SettingsPage: React.FC = () => {
    const { toggleTheme, isDark } = useTheme();

    const n = {
        bg: isDark ? 'neu-bg-dark' : 'neu-bg-light', card: isDark ? 'neu-dark' : 'neu-light',
        flat: isDark ? 'neu-dark-flat' : 'neu-light-flat', inset: isDark ? 'neu-dark-inset' : 'neu-light-inset',
        pressed: isDark ? 'neu-dark-pressed' : 'neu-light-pressed',
        text: isDark ? 'text-white' : 'text-gray-900', secondary: isDark ? 'text-gray-300' : 'text-gray-600',
        tertiary: isDark ? 'text-gray-500' : 'text-gray-400', strong: isDark ? 'text-white' : 'text-black',
        label: isDark ? 'text-blue-400' : 'text-blue-600', link: isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500',
        badge: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700',
        input: isDark ? 'bg-transparent border-gray-700 text-white' : 'bg-transparent border-gray-300 text-gray-900',
        modal: isDark ? 'bg-[#111111] border-gray-800' : 'bg-[#f0f0f0] border-gray-300',
        modalHead: isDark ? 'bg-[#111111]' : 'bg-[#f0f0f0]',
        btnPrimary: 'bg-blue-600 hover:bg-blue-500 text-white', btnSecondary: isDark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
        btnDanger: 'bg-red-600 hover:bg-red-500 text-white', divider: isDark ? 'border-gray-800' : 'border-gray-200',
        edgeHover: isDark ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.3),6px_6px_14px_rgba(0,0,0,0.7),-6px_-6px_14px_rgba(40,40,40,0.12)]' : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),6px_6px_14px_rgba(0,0,0,0.1),-6px_-6px_14px_rgba(255,255,255,0.95)]',
        edgeHoverFlat: isDark ? 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(40,40,40,0.1)]' : 'hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)]',
    };

    const [toasts, setToasts] = useState<Toast[]>([]);
    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => { const id = `t_${Date.now()}`; setToasts(p => [...p, { id, message: msg, type }]); setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000); };

    const [userRole, setUserRole] = useState<UserRole>('client');
    const [profile, setProfile] = useState<UserProfile>({ customerId: '', firstName: '', lastName: '', email: '', phone: '', companyName: '', preferredContact: 'email' });
    const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
    const [consultant, setConsultant] = useState<ConsultantInfo | null>(null);
    const [activeSection, setActiveSection] = useState('security');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [showCurPw, setShowCurPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConPw, setShowConPw] = useState(false);
    const [pwErrors, setPwErrors] = useState<string[]>([]);
    const [isTemp, setIsTemp] = useState(false);
    const [notifications, setNotifications] = useState({ emailNotifications: true, propertyRecommendations: true, appointmentReminders: true, marketUpdates: false, smsNotifications: false });
    const [displayPrefs, setDisplayPrefs] = useState({ language: 'en', region: 'us' });
    const [loginHistory, setLoginHistory] = useState<LoginActivity[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteText, setDeleteText] = useState('');

    const isAdmin = userRole === 'admin'; const isConsultant = userRole === 'consultant'; const isClient = userRole === 'client';

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => { setLoading(true); await loadUser(); loadPrefs(); loadHistory(); loadDocs(); setLoading(false); };

    const loadUser = async () => {
        const raw = localStorage.getItem('timely_user'); if (!raw) return;
        const user = JSON.parse(raw);
        const role = (user.role || 'client').toLowerCase() as UserRole;
        setUserRole(role === 'admin' || role === 'consultant' || role === 'client' ? role : 'client');
        const api = await safeFetch(`${API_BASE}/users-report`);
        const full = api?.data?.find((u: any) => u.email === user.email || u.customerId === user.customerId);
        const ext = JSON.parse(localStorage.getItem('timely_clients_extended') || '{}')[user.customerId] || {};
        const names = (user.name || '').split(' ');
        const p: UserProfile = { customerId: user.customerId || full?.customerId || '', firstName: full?.firstName || ext.firstName || names[0] || '', lastName: full?.lastName || ext.lastName || names[names.length - 1] || '', email: user.email || full?.email || '', phone: full?.phone || ext.phone || '', companyName: ext.companyName || '', preferredContact: ext.preferredContact || 'email', role: user.role, tempPassword: full?.tempPassword || user.tempPassword, photoUrl: ext.photoUrl || '', calendarLink: ext.calendarLink || '' };
        setProfile(p); setOriginalProfile(p);
        if (p.tempPassword) setIsTemp(true);
        if (role === 'client') loadConsultant(p.customerId);
    };

    const loadConsultant = async (cid: string) => {
        const d = await safeFetch(`${API_BASE}/client-consultants`);
        if (d?.data) { const a = d.data.find((x: any) => x.clientId === cid); if (a) { const cd = await safeFetch(`${API_BASE}/consultants`); const f = cd?.data?.find((c: any) => c.consultantId === a.consultantId); if (f) { setConsultant(f); return; } } }
        const s = localStorage.getItem('timely_my_consultant'); if (s) try { setConsultant(JSON.parse(s)); } catch {}
    };

    const loadPrefs = () => { try { const n = localStorage.getItem('timely_notifications'); if (n) setNotifications(JSON.parse(n)); } catch {} try { const d = localStorage.getItem('timely_display'); if (d) { const p = JSON.parse(d); setDisplayPrefs({ language: p.language || 'en', region: p.region || 'us' }); } } catch {} };
    const loadHistory = () => { const s = localStorage.getItem('timely_login_history'); if (s) try { setLoginHistory(JSON.parse(s)); } catch {} else { const c: LoginActivity = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }), device: detectDevice(), location: 'Current Location', ip: '***.***.*.***', current: true }; setLoginHistory([c]); localStorage.setItem('timely_login_history', JSON.stringify([c])); } };
    const detectDevice = () => { const ua = navigator.userAgent; if (/iPhone|iPad/.test(ua)) return 'Safari on iPhone'; if (/Android/.test(ua)) return 'Chrome on Android'; if (/Mac/.test(ua)) return /Chrome/.test(ua) ? 'Chrome on MacOS' : 'Safari on MacOS'; if (/Windows/.test(ua)) return /Chrome/.test(ua) ? 'Chrome on Windows' : 'Edge on Windows'; return 'Unknown'; };
    const loadDocs = () => { const k = `timely_documents_${profile.customerId || 'anon'}`; const s = localStorage.getItem(k) || localStorage.getItem('timely_documents'); if (s) try { setDocuments(JSON.parse(s)); } catch {} };

    const validatePw = (pw: string) => { const e: string[] = []; if (pw.length < 8) e.push('8+ chars'); if (!/[A-Z]/.test(pw)) e.push('Uppercase'); if (!/[a-z]/.test(pw)) e.push('Lowercase'); if (!/[0-9]/.test(pw)) e.push('Number'); if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) e.push('Special'); return e; };
    const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; setPasswordForm(p => ({ ...p, [name]: value })); if (name === 'newPassword') setPwErrors(validatePw(value)); };

    const updatePassword = () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) { showToast('Passwords do not match', 'error'); return; }
        if (pwErrors.length > 0) { showToast('Meet all requirements', 'error'); return; }
        setSaving(true);
        const raw = localStorage.getItem('timely_user'); if (raw) { const u = JSON.parse(raw); u.tempPassword = null; localStorage.setItem('timely_user', JSON.stringify(u)); }
        showToast('Password updated'); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setIsTemp(false); setSaving(false);
    };

    const saveProfile = () => {
        setSaving(true);
        const raw = localStorage.getItem('timely_user'); if (raw) { const u = JSON.parse(raw); u.name = `${profile.firstName} ${profile.lastName}`.trim(); u.email = profile.email; localStorage.setItem('timely_user', JSON.stringify(u)); }
        const ext = JSON.parse(localStorage.getItem('timely_clients_extended') || '{}'); ext[profile.customerId] = { ...ext[profile.customerId], ...profile }; localStorage.setItem('timely_clients_extended', JSON.stringify(ext));
        setOriginalProfile(profile); setIsEditing(false); showToast('Profile saved'); setSaving(false);
    };

    const saveNotifs = () => { localStorage.setItem('timely_notifications', JSON.stringify(notifications)); showToast('Notifications saved'); };
    const saveDisplay = () => { localStorage.setItem('timely_display', JSON.stringify({ ...displayPrefs, darkMode: isDark })); showToast('Display saved'); };

    const uploadDoc = () => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
        input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) { const d: Document = { id: Date.now().toString(), name: f.name, type: f.type.includes('pdf') ? 'PDF' : f.type.includes('image') ? 'Image' : 'Document', uploadDate: new Date().toISOString().split('T')[0], size: f.size < 1024 * 1024 ? (f.size / 1024).toFixed(1) + ' KB' : (f.size / (1024 * 1024)).toFixed(1) + ' MB' }; const u = [...documents, d]; setDocuments(u); localStorage.setItem(`timely_documents_${profile.customerId || 'anon'}`, JSON.stringify(u)); showToast('Uploaded'); } };
        input.click();
    };
    const deleteDoc = (id: string) => { const u = documents.filter(d => d.id !== id); setDocuments(u); localStorage.setItem(`timely_documents_${profile.customerId || 'anon'}`, JSON.stringify(u)); showToast('Deleted'); };
    const deleteAccount = () => { if (deleteText !== 'DELETE') { showToast('Type DELETE', 'error'); return; } localStorage.clear(); window.location.reload(); };

    const menuItems = [
        { id: 'security', label: 'Account Security', icon: Shield, color: 'text-red-400', visible: true },
        { id: 'profile', label: 'Profile', icon: User, color: n.label, visible: true },
        { id: 'preferences', label: 'Notifications', icon: Bell, color: 'text-purple-400', visible: true },
        { id: 'display', label: 'Display', icon: Eye, color: 'text-amber-400', visible: true },
        { id: 'activity', label: 'Login History', icon: History, color: 'text-orange-400', visible: true },
        { id: 'consultant', label: 'My Consultant', icon: Users, color: 'text-emerald-400', visible: isClient },
        { id: 'documents', label: 'Documents', icon: FileText, color: 'text-cyan-400', visible: true },
        { id: 'account', label: 'Delete Account', icon: Trash2, color: 'text-red-400', visible: true },
    ].filter(i => i.visible);

    // Toggle helper
    const Toggle: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
        <button onClick={onToggle} className={`w-11 h-6 rounded-full relative transition-colors ${on ? 'bg-blue-600' : isDark ? 'bg-gray-700' : 'bg-gray-300'}`}><div className={`w-4.5 h-4.5 bg-white rounded-full absolute top-[3px] transition-all ${on ? 'left-[22px]' : 'left-[3px]'}`} style={{ width: 18, height: 18 }} /></button>
    );

    // Password field helper
    const PwField: React.FC<{ label: string; name: string; value: string; show: boolean; setShow: (v: boolean) => void; extra?: string }> = ({ label, name, value, show, setShow, extra }) => (
        <div><label className={`${n.label} text-[11px] block mb-1`}>{label}</label><div className="relative"><input type={show ? 'text' : 'password'} name={name} value={value} onChange={handlePwChange} placeholder={`Enter ${label.toLowerCase()}`} className={`w-full px-3 py-2.5 pr-10 ${n.input} border rounded-xl text-sm focus:outline-none focus:border-blue-500 ${extra || ''}`} /><button type="button" onClick={() => setShow(!show)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${n.tertiary}`}>{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
    );

    if (loading) return (<div className={`min-h-screen ${n.bg} flex items-center justify-center`}><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>);

    return (
        <div className={`min-h-screen ${n.bg} ${n.text}`}>
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">{toasts.map(t => (<div key={t.id} className={`${n.card} flex items-center gap-3 px-4 py-3 rounded-xl text-sm animate-fadeIn`}>{t.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : t.type === 'error' ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Info className="w-4 h-4 text-blue-400" />}<span>{t.message}</span><button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className={n.tertiary}><X className="w-3.5 h-3.5" /></button></div>))}</div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="mb-8"><h1 className={`text-2xl font-semibold tracking-tight ${n.strong} mb-1`}>Settings</h1><p className={`text-sm ${n.secondary}`}>Manage your account and preferences</p></div>

                {/* Temp pw warning */}
                {isTemp && activeSection !== 'security' && (
                    <div className={`mb-6 ${n.card} p-4 flex items-center justify-between`}>
                        <div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-amber-400" /><div><p className={`${n.text} font-medium text-sm`}>Security Alert</p><p className={`${n.tertiary} text-xs`}>Update your temporary password</p></div></div>
                        <button onClick={() => setActiveSection('security')} className={`px-4 py-2 ${n.btnPrimary} rounded-xl text-sm`}>Update</button>
                    </div>
                )}

                <div className="flex gap-6">
                    {/* Sidebar */}
                    <div className="w-56 flex-shrink-0">
                        <div className={`${n.card} p-1.5 space-y-1`}>
                            {menuItems.map(item => (
                                <button key={item.id} onClick={() => setActiveSection(item.id)} className={`w-full px-4 py-3 flex items-center gap-3 transition-all duration-200 ${activeSection === item.id ? `${n.pressed} ${n.text}` : `${n.edgeHoverFlat} ${n.secondary}`}`}>
                                    <item.icon className={`w-4 h-4 ${activeSection === item.id ? item.color : n.tertiary}`} />
                                    <span className="text-sm">{item.label}</span>
                                    {item.id === 'security' && isTemp && <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">

                        {/* ═══ SECURITY ═══ */}
                        {activeSection === 'security' && (
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center gap-3 mb-6"><Lock className="w-5 h-5 text-red-400" /><div><h2 className={`text-lg font-semibold ${n.text}`}>Change Password</h2><p className={`text-sm ${n.secondary}`}>Keep your account secure</p></div></div>
                                {isTemp && <div className={`mb-6 ${n.flat} p-4 flex items-start gap-3`}><AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" /><div><p className={`${n.text} font-medium text-sm`}>Temporary Password</p><p className={`${n.tertiary} text-xs`}>Change immediately for security</p></div></div>}
                                <div className="space-y-4 max-w-md">
                                    <PwField label="Current Password" name="currentPassword" value={passwordForm.currentPassword} show={showCurPw} setShow={setShowCurPw} />
                                    <PwField label="New Password" name="newPassword" value={passwordForm.newPassword} show={showNewPw} setShow={setShowNewPw} />
                                    {passwordForm.newPassword && (
                                        <div className={`${n.flat} p-3 grid grid-cols-3 gap-2`}>
                                            {[{ met: passwordForm.newPassword.length >= 8, t: '8+ chars' }, { met: /[A-Z]/.test(passwordForm.newPassword), t: 'Upper' }, { met: /[a-z]/.test(passwordForm.newPassword), t: 'Lower' }, { met: /[0-9]/.test(passwordForm.newPassword), t: 'Number' }, { met: /[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPassword), t: 'Special' }].map((r, i) => (
                                                <div key={i} className={`flex items-center gap-1.5 text-xs ${r.met ? 'text-emerald-400' : n.tertiary}`}>{r.met ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{r.t}</div>
                                            ))}
                                        </div>
                                    )}
                                    <PwField label="Confirm Password" name="confirmPassword" value={passwordForm.confirmPassword} show={showConPw} setShow={setShowConPw} extra={passwordForm.confirmPassword && passwordForm.confirmPassword !== passwordForm.newPassword ? 'border-red-500' : passwordForm.confirmPassword === passwordForm.newPassword && passwordForm.confirmPassword ? 'border-emerald-500' : ''} />
                                    {passwordForm.confirmPassword && passwordForm.confirmPassword !== passwordForm.newPassword && <p className="text-red-400 text-xs">Passwords do not match</p>}
                                    <button onClick={updatePassword} disabled={saving || pwErrors.length > 0 || !passwordForm.currentPassword || passwordForm.newPassword !== passwordForm.confirmPassword} className={`w-full mt-2 px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm disabled:opacity-50`}>{saving ? 'Updating...' : 'Update Password'}</button>
                                </div>
                            </div>
                        )}

                        {/* ═══ PROFILE ═══ */}
                        {activeSection === 'profile' && (
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3"><div className={`w-10 h-10 ${n.inset} rounded-full flex items-center justify-center text-sm font-semibold ${n.secondary}`}>{profile.firstName?.[0]}{profile.lastName?.[0]}</div><div><h2 className={`text-lg font-semibold ${n.text}`}>Profile</h2><p className={`text-sm ${n.secondary}`}>Manage your details</p></div></div>
                                    {!isEditing ? <button onClick={() => setIsEditing(true)} className={`px-4 py-2.5 ${n.flat} ${n.edgeHoverFlat} text-sm flex items-center gap-2 ${n.secondary} transition-all`}><Edit2 className="w-3.5 h-3.5" />Edit</button> : <div className="flex gap-2"><button onClick={() => { if (originalProfile) setProfile(originalProfile); setIsEditing(false); }} className={`px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={saveProfile} disabled={saving} className={`px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}><Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}</button></div>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { l: 'First Name', v: profile.firstName, k: 'firstName', icon: null },
                                        { l: 'Last Name', v: profile.lastName, k: 'lastName', icon: null },
                                        { l: 'Email', v: profile.email, k: 'email', icon: Mail },
                                        { l: 'Phone', v: profile.phone, k: 'phone', icon: Phone },
                                        { l: 'Company', v: profile.companyName || '', k: 'companyName', icon: Building },
                                    ].map((f, i) => (
                                        <div key={i}><label className={`${n.label} text-[11px] block mb-1`}>{f.l}</label><div className="relative">{f.icon && <f.icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${n.tertiary}`} />}<input type="text" value={f.v} onChange={e => setProfile({ ...profile, [f.k]: e.target.value })} disabled={!isEditing} className={`w-full ${f.icon ? 'pl-10' : 'px-3'} py-2.5 ${n.input} border rounded-xl text-sm disabled:opacity-60 focus:outline-none focus:border-blue-500`} /></div></div>
                                    ))}
                                    <div><label className={`${n.label} text-[11px] block mb-1`}>Preferred Contact</label><select value={profile.preferredContact} onChange={e => setProfile({ ...profile, preferredContact: e.target.value as any })} disabled={!isEditing} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm disabled:opacity-60`}><option value="email">Email</option><option value="phone">Phone</option></select></div>
                                    {(isConsultant || isAdmin) && (<><div><label className={`${n.label} text-[11px] block mb-1`}>Photo URL</label><input type="text" value={profile.photoUrl || ''} onChange={e => setProfile({ ...profile, photoUrl: e.target.value })} disabled={!isEditing} placeholder="https://..." className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm disabled:opacity-60`} /></div><div><label className={`${n.label} text-[11px] block mb-1`}>Calendar Link</label><div className="relative"><Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${n.tertiary}`} /><input type="text" value={profile.calendarLink || ''} onChange={e => setProfile({ ...profile, calendarLink: e.target.value })} disabled={!isEditing} placeholder="Calendly..." className={`w-full pl-10 py-2.5 ${n.input} border rounded-xl text-sm disabled:opacity-60`} /></div></div></>)}
                                </div>
                            </div>
                        )}

                        {/* ═══ NOTIFICATIONS ═══ */}
                        {activeSection === 'preferences' && (
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center gap-3 mb-6"><Bell className="w-5 h-5 text-purple-400" /><div><h2 className={`text-lg font-semibold ${n.text}`}>Notifications</h2><p className={`text-sm ${n.secondary}`}>How Timely contacts you</p></div></div>
                                <div className="space-y-1.5">
                                    {[{ k: 'emailNotifications', l: 'Email Notifications', d: 'Account updates via email' }, { k: 'smsNotifications', l: 'SMS', d: 'Text message alerts' }, { k: 'propertyRecommendations', l: 'Property Recs', d: 'New matching properties' }, { k: 'appointmentReminders', l: 'Reminders', d: 'Before scheduled meetings' }, { k: 'marketUpdates', l: 'Market Updates', d: 'Weekly trends' }].map(item => (
                                        <div key={item.k} className={`${n.flat} p-4 flex items-center justify-between`}>
                                            <div><p className={`${n.text} text-sm font-medium`}>{item.l}</p><p className={`${n.tertiary} text-xs`}>{item.d}</p></div>
                                            <Toggle on={notifications[item.k as keyof typeof notifications]} onToggle={() => setNotifications({ ...notifications, [item.k]: !notifications[item.k as keyof typeof notifications] })} />
                                        </div>
                                    ))}
                                </div>
                                <button onClick={saveNotifs} className={`mt-6 px-6 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Save</button>
                            </div>
                        )}

                        {/* ═══ DISPLAY ═══ */}
                        {activeSection === 'display' && (
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center gap-3 mb-6"><Eye className="w-5 h-5 text-amber-400" /><div><h2 className={`text-lg font-semibold ${n.text}`}>Display</h2><p className={`text-sm ${n.secondary}`}>Customize your experience</p></div></div>
                                <div className="space-y-4">
                                    <div className={`${n.flat} p-4 flex items-center justify-between`}><div className="flex items-center gap-3">{isDark ? <Moon className="w-4 h-4 text-gray-400" /> : <Sun className="w-4 h-4 text-amber-400" />}<div><p className={`${n.text} text-sm font-medium`}>{isDark ? 'Dark Mode' : 'Light Mode'}</p><p className={`${n.tertiary} text-xs`}>Toggle theme</p></div></div><Toggle on={isDark} onToggle={toggleTheme} /></div>
                                    <div className={`${n.flat} p-4`}><div className="flex items-center gap-3 mb-3"><Globe className={`w-4 h-4 ${n.tertiary}`} /><span className={`${n.label} text-[11px]`}>Language</span></div><select value={displayPrefs.language} onChange={e => setDisplayPrefs({ ...displayPrefs, language: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option></select></div>
                                    <div className={`${n.flat} p-4`}><div className="flex items-center gap-3 mb-3"><MapPin className={`w-4 h-4 ${n.tertiary}`} /><span className={`${n.label} text-[11px]`}>Region</span></div><select value={displayPrefs.region} onChange={e => setDisplayPrefs({ ...displayPrefs, region: e.target.value })} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`}><option value="us">United States</option><option value="ca">Canada</option><option value="uk">United Kingdom</option></select></div>
                                </div>
                                <button onClick={saveDisplay} className={`mt-6 px-6 py-2.5 ${n.btnPrimary} rounded-xl text-sm`}>Save</button>
                            </div>
                        )}

                        {/* ═══ LOGIN HISTORY ═══ */}
                        {activeSection === 'activity' && (
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center gap-3 mb-6"><History className="w-5 h-5 text-orange-400" /><div><h2 className={`text-lg font-semibold ${n.text}`}>Login History</h2><p className={`text-sm ${n.secondary}`}>Recent activity</p></div></div>
                                {loginHistory.length === 0 ? <div className="text-center py-12"><History className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} /><p className={`text-sm ${n.secondary}`}>No history</p></div> : (
                                    <div className="space-y-1.5">{loginHistory.map(a => (
                                        <div key={a.id} className={`${a.current ? n.pressed : n.flat} p-4 flex items-center justify-between`}>
                                            <div className="flex items-center gap-4">{a.device.includes('iPhone') || a.device.includes('Android') ? <Smartphone className="w-4 h-4 text-purple-400" /> : <Monitor className="w-4 h-4 text-blue-400" />}<div><p className={`${n.text} text-sm font-medium flex items-center gap-2`}>{a.device}{a.current && <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full">Current</span>}</p><p className={`${n.tertiary} text-xs`}>{a.location} · {a.ip}</p></div></div>
                                            <div className="text-right"><p className={`${n.secondary} text-xs`}>{a.date}</p><p className={`${n.tertiary} text-xs`}>{a.time}</p></div>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                        )}

                        {/* ═══ MY CONSULTANT ═══ */}
                        {activeSection === 'consultant' && isClient && (
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center gap-3 mb-6"><Users className="w-5 h-5 text-emerald-400" /><div><h2 className={`text-lg font-semibold ${n.text}`}>Your Consultant</h2><p className={`text-sm ${n.secondary}`}>Dedicated point of contact</p></div></div>
                                {consultant ? (
                                    <div className={`${n.flat} p-6`}>
                                        <div className="flex items-start gap-5">
                                            <div className={`w-14 h-14 ${n.inset} rounded-full flex items-center justify-center text-lg font-semibold ${n.secondary}`}>{consultant.firstName?.[0]}{consultant.lastName?.[0]}</div>
                                            <div className="flex-1">
                                                <h3 className={`text-lg font-semibold ${n.text}`}>{consultant.firstName} {consultant.lastName}</h3>
                                                {consultant.role && <p className={n.label}>{consultant.role}</p>}
                                                <div className="mt-4 space-y-2">
                                                    {consultant.email && <div className="flex items-center gap-3"><Mail className={`w-4 h-4 ${n.tertiary}`} /><a href={`mailto:${consultant.email}`} className={n.link}>{consultant.email}</a></div>}
                                                    {consultant.phone && <div className="flex items-center gap-3"><Phone className={`w-4 h-4 ${n.tertiary}`} /><a href={`tel:${consultant.phone}`} className={n.link}>{consultant.phone}</a></div>}
                                                    {consultant.calendarLink && <div className="flex items-center gap-3"><Calendar className={`w-4 h-4 ${n.tertiary}`} /><a href={consultant.calendarLink} target="_blank" rel="noreferrer" className={n.link}>Schedule a meeting</a></div>}
                                                </div>
                                                <div className="mt-6 flex gap-2">
                                                    {consultant.email && <a href={`mailto:${consultant.email}`} className={`px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}><MessageSquare className="w-3.5 h-3.5" />Contact</a>}
                                                    <button className={`px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Request Change</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`${n.flat} text-center py-12`}><Users className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} /><p className={`${n.secondary} text-sm`}>No consultant assigned yet</p></div>
                                )}
                            </div>
                        )}

                        {/* ═══ DOCUMENTS ═══ */}
                        {activeSection === 'documents' && (
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center justify-between mb-6"><div className="flex items-center gap-3"><FileText className="w-5 h-5 text-cyan-400" /><div><h2 className={`text-lg font-semibold ${n.text}`}>Documents</h2><p className={`text-sm ${n.secondary}`}>Your uploaded files</p></div></div><button onClick={uploadDoc} className={`px-4 py-2.5 ${n.btnPrimary} rounded-xl text-sm flex items-center gap-2`}><Upload className="w-3.5 h-3.5" />Upload</button></div>
                                {documents.length === 0 ? <div className={`${n.flat} text-center py-12`}><FileText className={`w-10 h-10 ${n.tertiary} mx-auto mb-3`} /><p className={`${n.secondary} text-sm`}>No documents</p></div> : (
                                    <div className="space-y-1.5">{documents.map(doc => (
                                        <div key={doc.id} className={`${n.flat} ${n.edgeHoverFlat} p-4 flex items-center justify-between transition-all duration-200`}>
                                            <div className="flex items-center gap-4"><FileText className="w-5 h-5 text-cyan-400" /><div><p className={`${n.text} text-sm font-medium`}>{doc.name}</p><p className={`${n.tertiary} text-xs`}>{doc.type} · {doc.size} · {doc.uploadDate}</p></div></div>
                                            <div className="flex items-center gap-1"><button className={`p-2 ${n.flat} rounded-lg`}><Download className={`w-4 h-4 ${n.secondary}`} /></button><button onClick={() => deleteDoc(doc.id)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button></div>
                                        </div>
                                    ))}</div>
                                )}
                            </div>
                        )}

                        {/* ═══ DELETE ACCOUNT ═══ */}
                        {activeSection === 'account' && (
                            <div className={`${n.card} p-6`}>
                                <div className="flex items-center gap-3 mb-6"><Trash2 className="w-5 h-5 text-red-400" /><div><h2 className={`text-lg font-semibold ${n.text}`}>Account Management</h2><p className={`text-sm ${n.secondary}`}>Manage your account status</p></div></div>
                                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <h3 className="text-red-400 font-bold text-lg mb-2">Danger Zone</h3>
                                    <p className={`${n.secondary} text-sm mb-4`}>{isAdmin ? 'Admin deletion should only be done in exceptional cases.' : 'This removes your access and all associated data.'}</p>
                                    <button onClick={() => setShowDeleteModal(true)} className={`px-6 py-2.5 ${n.btnDanger} rounded-xl text-sm`}>Delete Account</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
                    <div className={`${n.modal} border rounded-2xl max-w-md w-full`}>
                        <div className={`p-5 border-b ${n.divider} flex items-center gap-3`}><AlertTriangle className="w-5 h-5 text-red-400" /><div><h2 className={`text-lg font-semibold ${n.text}`}>Delete Account</h2><p className={`text-sm ${n.secondary}`}>This cannot be undone</p></div></div>
                        <div className="p-5 space-y-4">
                            <p className={`${n.secondary} text-sm`}>All data will be permanently deleted:</p>
                            <div className="space-y-1.5">{['Profile information', 'Saved properties', 'Documents', 'Communication history'].map((item, i) => <div key={i} className={`${n.flat} px-3 py-2 flex items-center gap-2 text-sm ${n.secondary}`}><X className="w-3.5 h-3.5 text-red-400" />{item}</div>)}</div>
                            <div><label className={`${n.label} text-[11px] block mb-1`}>Type <span className="text-red-400 font-mono">DELETE</span> to confirm</label><input type="text" value={deleteText} onChange={e => setDeleteText(e.target.value)} className={`w-full px-3 py-2.5 ${n.input} border rounded-xl text-sm`} placeholder="DELETE" /></div>
                            <div className="flex gap-3"><button onClick={() => { setShowDeleteModal(false); setDeleteText(''); }} className={`flex-1 px-4 py-2.5 ${n.btnSecondary} rounded-xl text-sm`}>Cancel</button><button onClick={deleteAccount} disabled={deleteText !== 'DELETE'} className={`flex-1 px-4 py-2.5 ${n.btnDanger} rounded-xl text-sm disabled:opacity-50`}>Delete</button></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;