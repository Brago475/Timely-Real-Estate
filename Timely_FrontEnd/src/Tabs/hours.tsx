import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../Views_Layouts/ThemeContext';
import { Clock, Play, Pause, Square, Plus, Calendar, User, FolderOpen, Search, Filter, ChevronRight, X, Edit2, Trash2, Timer, TrendingUp, ChevronLeft, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';

const API_BASE = 'http://localhost:4000/api';

type UserRole = 'admin' | 'consultant' | 'client';

type CurrentUser = {
    customerId: string;
    email: string;
    name: string;
    role?: UserRole | string;
    consultantId?: string;
};

const getCurrentUserRole = (): { role: UserRole; email: string; customerId: string; name: string; consultantId: string } => {
    try {
        const raw = localStorage.getItem('timely_user');
        if (!raw) return { role: 'admin', email: '', customerId: '', name: '', consultantId: '' };
        const parsed: CurrentUser = JSON.parse(raw);
        const r = parsed.role;
        const role: UserRole = (r === 'admin' || r === 'consultant' || r === 'client') ? r : 'admin';
        return {
            role,
            email: parsed.email || '',
            customerId: parsed.customerId || '',
            name: parsed.name || '',
            consultantId: (parsed as any).consultantId || '',
        };
    } catch {
        return { role: 'admin', email: '', customerId: '', name: '', consultantId: '' };
    }
};

const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return null; return await r.json(); } catch (e) { return null; } };

interface HoursLog { logId: string; projectId: string; consultantId: string; consultantEmail?: string; date: string; hours: number; description: string; createdAt: string; }
interface Project { projectId: string; projectCode: string; projectName: string; status: string; }
interface Consultant { consultantId: string; consultantCode: string; firstName: string; lastName: string; email: string; }
interface Toast { id: string; message: string; type: 'success' | 'error' | 'info'; }

const HoursPage: React.FC = () => {
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
        modal: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200',
        tableHeader: isDark ? 'bg-slate-800' : 'bg-gray-100',
        tableRow: isDark ? 'border-slate-700 hover:bg-slate-800/50' : 'border-gray-200 hover:bg-gray-50',
        accent: isDark ? 'text-blue-400' : 'text-blue-600',
        warning: isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800',
    };

    // Get current user role
    const { role: userRole, email: currentEmail, consultantId: userConsultantId } = useMemo(() => getCurrentUserRole(), []);
    const isAdmin = userRole === 'admin';
    const isConsultant = userRole === 'consultant';
    const isClient = userRole === 'client';

    // Permission checks
    const canLogHours = isAdmin || isConsultant;
    const canViewAllLogs = isAdmin;
    const canDeleteLogs = isAdmin;
    const canUseTimer = isAdmin || isConsultant;

    // Toast system
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

    const [hoursLogs, setHoursLogs] = useState<HoursLog[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [consultants, setConsultants] = useState<Consultant[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [showLogModal, setShowLogModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<HoursLog | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProject, setFilterProject] = useState('all');
    const [filterConsultant, setFilterConsultant] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'weekly'>('list');
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const now = new Date(); const day = now.getDay(); const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.setDate(diff)).toISOString().split('T')[0];
    });

    // Timer state
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerProject, setTimerProject] = useState('');
    const [timerDescription, setTimerDescription] = useState('');

    const [logForm, setLogForm] = useState({ projectId: '', consultantId: '', date: new Date().toISOString().split('T')[0], hours: '', minutes: '', description: '' });

    useEffect(() => { loadAllData(); }, []);
    useEffect(() => { let interval: NodeJS.Timeout; if (isTimerRunning) { interval = setInterval(() => setTimerSeconds(prev => prev + 1), 1000); } return () => clearInterval(interval); }, [isTimerRunning]);

    // Auto-set consultant for consultants logging their own hours
    useEffect(() => {
        if (isConsultant && userConsultantId && !logForm.consultantId) {
            setLogForm(prev => ({ ...prev, consultantId: userConsultantId }));
        }
    }, [isConsultant, userConsultantId, logForm.consultantId]);

    const loadAllData = async () => { setRefreshing(true); await Promise.all([loadHoursLogs(), loadProjects(), loadConsultants()]); loadLocalHoursLogs(); setRefreshing(false); };
    const loadHoursLogs = async () => { const d = await safeFetch(`${API_BASE}/hours-logs`); if (d?.data) setHoursLogs(d.data); };
    const loadLocalHoursLogs = () => { try { const s = localStorage.getItem('timely_hours_logs'); if (s) { const local = JSON.parse(s); setHoursLogs(prev => { const apiIds = prev.map(l => l.logId); return [...prev, ...local.filter((l: HoursLog) => !apiIds.includes(l.logId))]; }); } } catch (e) { console.error(e); } };
    const loadProjects = async () => { const d = await safeFetch(`${API_BASE}/projects`); const local = JSON.parse(localStorage.getItem('timely_projects') || '[]'); if (d?.data) { setProjects([...d.data, ...local.filter((l: Project) => !d.data.find((a: Project) => a.projectId === l.projectId))]); } else { setProjects(local); } };
    const loadConsultants = async () => { const d = await safeFetch(`${API_BASE}/consultants`); if (d?.data) setConsultants(d.data); };

    // Get current consultant from email if consultantId not set
    const getCurrentConsultantId = () => {
        if (userConsultantId) return userConsultantId;
        if (currentEmail) {
            const consultant = consultants.find(c => c.email.toLowerCase() === currentEmail.toLowerCase());
            if (consultant) return consultant.consultantId;
        }
        return '';
    };

    // Timer functions
    const startTimer = () => {
        if (!canUseTimer) { showToast('You do not have permission to use the timer', 'error'); return; }
        if (!timerProject) { showToast('Please select a project first', 'error'); return; }
        setIsTimerRunning(true); showToast('Timer started', 'info');
    };
    const pauseTimer = () => { setIsTimerRunning(false); showToast('Timer paused', 'info'); };
    const stopTimer = () => {
        if (timerSeconds > 0) {
            const hours = Math.floor(timerSeconds / 3600);
            const minutes = Math.floor((timerSeconds % 3600) / 60);
            const consultantId = isConsultant ? getCurrentConsultantId() : '';
            setLogForm({ ...logForm, projectId: timerProject, consultantId, hours: hours.toString(), minutes: minutes.toString(), description: timerDescription, date: new Date().toISOString().split('T')[0] });
            setShowLogModal(true);
        }
        setIsTimerRunning(false); setTimerSeconds(0); setTimerDescription('');
    };
    const resetTimer = () => { setIsTimerRunning(false); setTimerSeconds(0); setTimerProject(''); setTimerDescription(''); };
    const formatTime = (seconds: number) => { const hrs = Math.floor(seconds / 3600); const mins = Math.floor((seconds % 3600) / 60); const secs = seconds % 60; return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`; };

    // CRUD
    const createHoursLog = async () => {
        if (!canLogHours) { showToast('You do not have permission to log hours', 'error'); return; }
        if (!logForm.projectId || !logForm.consultantId || !logForm.date) { showToast('Please fill required fields', 'error'); return; }
        const hours = parseFloat(logForm.hours || '0'); const minutes = parseFloat(logForm.minutes || '0'); const totalHours = hours + (minutes / 60);
        if (totalHours <= 0) { showToast('Please enter valid hours', 'error'); return; }
        setLoading(true);
        try {
            const consultant = consultants.find(c => c.consultantId === logForm.consultantId);
            const r = await fetch(`${API_BASE}/hours-logs`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: logForm.projectId, consultantId: logForm.consultantId, consultantEmail: consultant?.email || currentEmail, date: logForm.date, hours: totalHours.toFixed(2), description: logForm.description, performedBy: isAdmin ? 'admin' : 'consultant' })
            });
            if (!r.ok) throw new Error('Failed');
            showToast('Hours logged successfully', 'success'); setShowLogModal(false); resetLogForm(); loadHoursLogs();
        } catch (e) {
            // Save to localStorage if API fails (for local projects)
            const consultant = consultants.find(c => c.consultantId === logForm.consultantId);
            const newLog: HoursLog = { logId: `log_${Date.now()}`, projectId: logForm.projectId, consultantId: logForm.consultantId, consultantEmail: consultant?.email || currentEmail, date: logForm.date, hours: totalHours, description: logForm.description, createdAt: new Date().toISOString() };
            const existing = JSON.parse(localStorage.getItem('timely_hours_logs') || '[]');
            localStorage.setItem('timely_hours_logs', JSON.stringify([...existing, newLog]));
            showToast('Hours logged successfully', 'success'); setShowLogModal(false); resetLogForm(); loadAllData();
        } finally { setLoading(false); }
    };

    const deleteHoursLog = async (logId: string) => {
        if (!canDeleteLogs) { showToast('You do not have permission to delete hours logs', 'error'); return; }
        try {
            const r = await fetch(`${API_BASE}/hours-logs-delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logId, performedBy: 'admin' }) });
            if (!r.ok) throw new Error('Failed');
            setShowDeleteConfirm(null); setShowEditModal(false); loadHoursLogs(); showToast('Hours log deleted', 'success');
        } catch (e) {
            // Try deleting from local storage
            const existing = JSON.parse(localStorage.getItem('timely_hours_logs') || '[]');
            const filtered = existing.filter((l: HoursLog) => l.logId !== logId);
            localStorage.setItem('timely_hours_logs', JSON.stringify(filtered));
            setShowDeleteConfirm(null); setShowEditModal(false); loadAllData(); showToast('Hours log deleted', 'success');
        }
    };

    const resetLogForm = () => {
        const consultantId = isConsultant ? getCurrentConsultantId() : '';
        setLogForm({ projectId: '', consultantId, date: new Date().toISOString().split('T')[0], hours: '', minutes: '', description: '' });
    };
    const openEditModal = (log: HoursLog) => {
        const hours = Math.floor(log.hours); const minutes = Math.round((log.hours - hours) * 60);
        setSelectedLog(log); setLogForm({ projectId: log.projectId, consultantId: log.consultantId, date: log.date, hours: hours.toString(), minutes: minutes.toString(), description: log.description }); setShowEditModal(true);
    };

    // Helpers
    const getProjectName = (pid: string) => projects.find(p => p.projectId === pid)?.projectName || 'Unknown';
    const getConsultantName = (cid: string) => { const c = consultants.find(c => c.consultantId === cid); return c ? `${c.firstName} ${c.lastName}` : 'Unknown'; };
    const getConsultantNameFromLog = (log: HoursLog) => {
        if (log.consultantId) {
            const c = consultants.find(c => c.consultantId === log.consultantId);
            if (c) return `${c.firstName} ${c.lastName}`;
        }
        if (log.consultantEmail) {
            const c = consultants.find(c => c.email.toLowerCase() === (log.consultantEmail || '').toLowerCase());
            if (c) return `${c.firstName} ${c.lastName}`;
            return log.consultantEmail;
        }
        return 'Unknown';
    };
    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const formatHours = (h: number) => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`; };
    const getWeekDates = (startDate: string) => { const dates = []; const start = new Date(startDate); for (let i = 0; i < 7; i++) { const date = new Date(start); date.setDate(start.getDate() + i); dates.push(date.toISOString().split('T')[0]); } return dates; };
    const navigateWeek = (dir: 'prev' | 'next') => { const c = new Date(currentWeekStart); c.setDate(c.getDate() + (dir === 'prev' ? -7 : 7)); setCurrentWeekStart(c.toISOString().split('T')[0]); };

    // Filter logs based on role
    const filteredLogs = useMemo(() => {
        let logs = hoursLogs;

        // Consultants only see their own logs
        if (isConsultant) {
            const myConsultantId = getCurrentConsultantId();
            logs = hoursLogs.filter(log => {
                if (log.consultantId === myConsultantId) return true;
                if (log.consultantEmail && currentEmail && log.consultantEmail.toLowerCase() === currentEmail.toLowerCase()) return true;
                return false;
            });
        }

        // Apply filters
        return logs.filter(log => {
            const matchSearch = log.description.toLowerCase().includes(searchTerm.toLowerCase()) || getProjectName(log.projectId).toLowerCase().includes(searchTerm.toLowerCase()) || getConsultantNameFromLog(log).toLowerCase().includes(searchTerm.toLowerCase());
            const matchProject = filterProject === 'all' || log.projectId === filterProject;
            const matchConsultant = filterConsultant === 'all' || log.consultantId === filterConsultant;
            return matchSearch && matchProject && matchConsultant;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [hoursLogs, searchTerm, filterProject, filterConsultant, projects, consultants, isConsultant, currentEmail, userConsultantId]);

    // Stats based on role
    const stats = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const weekDates = getWeekDates(currentWeekStart);

        // Use filtered logs for consultants (their own), all logs for admin
        const relevantLogs = isConsultant ? filteredLogs : hoursLogs;

        const todayHours = relevantLogs.filter(l => l.date === today).reduce((sum, l) => sum + l.hours, 0);
        const weekHours = relevantLogs.filter(l => weekDates.includes(l.date)).reduce((sum, l) => sum + l.hours, 0);
        const totalHours = relevantLogs.reduce((sum, l) => sum + l.hours, 0);
        const uniqueProjects = new Set(relevantLogs.map(l => l.projectId)).size;
        return { todayHours, weekHours, totalHours, uniqueProjects };
    }, [hoursLogs, filteredLogs, currentWeekStart, isConsultant]);

    const weeklyData = useMemo(() => {
        const weekDates = getWeekDates(currentWeekStart);
        const data: { [key: string]: HoursLog[] } = {};
        weekDates.forEach(date => { data[date] = filteredLogs.filter(l => l.date === date); });
        return { dates: weekDates, data };
    }, [filteredLogs, currentWeekStart]);

    // Client view - show friendly message
    if (isClient) {
        return (
            <div className={`min-h-screen ${styles.bg}`}>
                <div className="max-w-3xl mx-auto px-6 py-12">
                    <div className={`${styles.card} border rounded-2xl p-6`}>
                        <div className="flex items-center gap-3 mb-3">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                            <h1 className={`text-lg font-semibold ${styles.text}`}>Hours Tracking for Staff Only</h1>
                        </div>
                        <p className={styles.textMuted}>
                            As a client, you don't log hours in Timely. Your consultant and admin track work time for your projects.
                            You can view project updates and documents from your dashboard.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${styles.bg}`}>
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-[10000] space-y-2">
                {toasts.map(toast => (
                    <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                        <ToastIcon type={toast.type} /><span className={styles.text}>{toast.message}</span>
                        <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className={styles.textMuted}><X className="w-4 h-4" /></button>
                    </div>
                ))}
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-md w-full p-6`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><AlertCircle className="w-5 h-5 text-red-500" /></div>
                            <h3 className={`text-lg font-semibold ${styles.text}`}>Delete Hours Log?</h3>
                        </div>
                        <p className={`${styles.textMuted} mb-6`}>This will permanently delete this time entry. This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className={`flex-1 px-4 py-2.5 ${styles.button} rounded-lg`}>Cancel</button>
                            <button onClick={() => deleteHoursLog(showDeleteConfirm)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className={`text-4xl font-bold ${styles.text} mb-2`}>Hours Tracker</h1>
                            <p className={styles.textMuted}>
                                {isAdmin ? 'View all logged hours across consultants and projects' : 'Log your work time and track your hours'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`text-xs px-3 py-1.5 rounded-full ${styles.cardInner} ${styles.textMuted}`}>
                                Role: <span className="font-semibold capitalize">{userRole}</span>
                            </div>
                            <button onClick={loadAllData} disabled={refreshing} className={`p-2.5 rounded-lg border ${styles.divider} ${styles.cardHover} ${refreshing ? 'animate-spin' : ''}`}><RefreshCw className={`w-5 h-5 ${styles.textMuted}`} /></button>
                            {canLogHours && (
                                <button onClick={() => { resetLogForm(); setShowLogModal(true); }} className={`${styles.buttonPrimary} px-5 py-2.5 rounded-lg flex items-center gap-2`}><Plus className="w-5 h-5" />Log Hours</button>
                            )}
                        </div>
                    </div>

                    {/* Role-based info banner */}
                    {isConsultant && (
                        <div className={`mb-4 p-3 rounded-lg border flex items-center gap-2 ${styles.warning}`}>
                            <AlertCircle className="w-4 h-4" />
                            <p className="text-sm">You can log and track your own hours. Only admins can view and manage all consultant hours.</p>
                        </div>
                    )}

                    {/* Timer Card - only for users who can log hours */}
                    {canUseTimer && (
                        <div className={`${styles.card} border rounded-lg p-6 mb-6`}>
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-6">
                                    <div className="text-center">
                                        <div className={`text-4xl font-mono font-bold ${isTimerRunning ? styles.accent : styles.text}`}>{formatTime(timerSeconds)}</div>
                                        <p className={`${styles.textSubtle} text-sm mt-1`}>Live Timer</p>
                                    </div>
                                    <div className={`h-12 w-px ${isDark ? 'bg-slate-700' : 'bg-gray-200'}`} />
                                    <div className="flex-1 max-w-md space-y-2">
                                        <select value={timerProject} onChange={(e) => setTimerProject(e.target.value)} disabled={isTimerRunning} className={`w-full px-4 py-2 ${styles.input} border rounded-lg text-sm disabled:opacity-50`}>
                                            <option value="">Select Project</option>
                                            {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}
                                        </select>
                                        <input type="text" value={timerDescription} onChange={(e) => setTimerDescription(e.target.value)} placeholder="What are you working on?" className={`w-full px-4 py-2 ${styles.input} border rounded-lg text-sm`} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isTimerRunning ? (
                                        <button onClick={startTimer} className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" title="Start"><Play className="w-5 h-5" /></button>
                                    ) : (
                                        <button onClick={pauseTimer} className="p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg" title="Pause"><Pause className="w-5 h-5" /></button>
                                    )}
                                    <button onClick={stopTimer} disabled={timerSeconds === 0} className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50" title="Stop & Log"><Square className="w-5 h-5" /></button>
                                    <button onClick={resetTimer} className={`p-3 ${styles.button} rounded-lg`} title="Reset"><X className="w-5 h-5" /></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        {[{ label: isConsultant ? 'Your Today' : 'Today', value: formatHours(stats.todayHours), icon: Clock }, { label: isConsultant ? 'Your Week' : 'This Week', value: formatHours(stats.weekHours), icon: Calendar }, { label: isConsultant ? 'Your Total' : 'Total Hours', value: formatHours(stats.totalHours), icon: TrendingUp }, { label: 'Projects', value: stats.uniqueProjects.toString(), icon: FolderOpen }].map((s, i) => (
                            <div key={i} className={`${styles.card} border rounded-lg p-4`}><div className="flex items-center justify-between mb-1"><span className={`${styles.textMuted} text-sm`}>{s.label}</span><s.icon className={`w-5 h-5 ${styles.accent}`} /></div><div className={`text-2xl font-bold ${styles.text}`}>{s.value}</div></div>
                        ))}
                    </div>

                    {/* View Toggle & Search */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'list' ? styles.buttonPrimary : styles.button}`}>List View</button>
                            <button onClick={() => setViewMode('weekly')} className={`px-4 py-2 rounded-lg text-sm font-medium ${viewMode === 'weekly' ? styles.buttonPrimary : styles.button}`}>Weekly View</button>
                        </div>
                        <div className="flex items-center gap-3 flex-1 justify-end">
                            <div className="relative flex-1 max-w-md"><Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${styles.textMuted} w-5 h-5`} /><input type="text" placeholder="Search logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`w-full pl-10 pr-4 py-2.5 ${styles.input} border rounded-lg focus:outline-none ${styles.inputFocus}`} /></div>
                            <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2.5 rounded-lg flex items-center gap-2 ${showFilters ? styles.buttonPrimary : styles.button}`}><Filter className="w-5 h-5" />Filters</button>
                        </div>
                    </div>

                    {showFilters && (
                        <div className={`mt-4 p-4 ${styles.card} border rounded-lg grid grid-cols-2 gap-4`}>
                            <div><label className={`${styles.textMuted} text-sm block mb-1`}>Project</label><select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className={`w-full px-4 py-2 ${styles.input} border rounded-lg`}><option value="all">All Projects</option>{projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select></div>
                            {isAdmin && (
                                <div><label className={`${styles.textMuted} text-sm block mb-1`}>Consultant</label><select value={filterConsultant} onChange={(e) => setFilterConsultant(e.target.value)} className={`w-full px-4 py-2 ${styles.input} border rounded-lg`}><option value="all">All Consultants</option>{consultants.map(c => <option key={c.consultantId} value={c.consultantId}>{c.firstName} {c.lastName}</option>)}</select></div>
                            )}
                        </div>
                    )}
                </div>

                {/* Content */}
                {viewMode === 'list' ? (
                    <div className={`${styles.card} border rounded-lg overflow-hidden`}>
                        <div className={`grid grid-cols-12 gap-4 p-4 border-b ${styles.divider} ${styles.tableHeader}`}>
                            <div className={`col-span-2 ${styles.textMuted} text-sm`}>Date</div>
                            <div className={`col-span-3 ${styles.textMuted} text-sm`}>Project</div>
                            {isAdmin && <div className={`col-span-2 ${styles.textMuted} text-sm`}>Consultant</div>}
                            <div className={`${isAdmin ? 'col-span-1' : 'col-span-2'} ${styles.textMuted} text-sm`}>Hours</div>
                            <div className={`${isAdmin ? 'col-span-3' : 'col-span-4'} ${styles.textMuted} text-sm`}>Description</div>
                            <div className={`col-span-1 ${styles.textMuted} text-sm text-right`}>Actions</div>
                        </div>
                        {filteredLogs.length === 0 ? (
                            <div className="text-center py-16"><Clock className={`w-12 h-12 ${styles.textSubtle} mx-auto mb-3`} /><p className={styles.textMuted}>{isConsultant ? 'No hours logged yet. Start tracking your time!' : 'No hours logged yet'}</p></div>
                        ) : filteredLogs.map(log => (
                            <div key={log.logId} className={`grid grid-cols-12 gap-4 p-4 border-b ${styles.tableRow}`}>
                                <div className="col-span-2"><p className={`${styles.text} font-medium`}>{formatDate(log.date)}</p><p className={`${styles.textSubtle} text-xs`}>{log.date}</p></div>
                                <div className="col-span-3 flex items-center gap-2"><FolderOpen className={`w-4 h-4 ${styles.accent}`} /><span className={styles.text}>{getProjectName(log.projectId)}</span></div>
                                {isAdmin && <div className="col-span-2 flex items-center gap-2"><User className={`w-4 h-4 ${styles.textSubtle}`} /><span className={styles.textMuted}>{getConsultantNameFromLog(log)}</span></div>}
                                <div className={`${isAdmin ? 'col-span-1' : 'col-span-2'}`}><span className={`${styles.accent} font-semibold`}>{formatHours(log.hours)}</span></div>
                                <div className={`${isAdmin ? 'col-span-3' : 'col-span-4'}`}><p className={`${styles.textMuted} text-sm truncate`}>{log.description || '-'}</p></div>
                                <div className="col-span-1 flex items-center justify-end gap-1">
                                    <button onClick={() => openEditModal(log)} className={`p-2 ${styles.cardHover} rounded-lg`}><Edit2 className={`w-4 h-4 ${styles.textMuted}`} /></button>
                                    {canDeleteLogs && <button onClick={() => setShowDeleteConfirm(log.logId)} className="p-2 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={`${styles.card} border rounded-lg overflow-hidden`}>
                        <div className={`flex items-center justify-between p-4 border-b ${styles.divider}`}>
                            <button onClick={() => navigateWeek('prev')} className={`p-2 ${styles.cardHover} rounded-lg`}><ChevronLeft className={`w-5 h-5 ${styles.textMuted}`} /></button>
                            <div className="text-center">
                                <p className={`${styles.text} font-semibold`}>{formatDate(weeklyData.dates[0])} - {formatDate(weeklyData.dates[6])}</p>
                                <p className={`${styles.textSubtle} text-sm`}>Total: {formatHours(weeklyData.dates.reduce((sum, date) => sum + weeklyData.data[date].reduce((s, l) => s + l.hours, 0), 0))}</p>
                            </div>
                            <button onClick={() => navigateWeek('next')} className={`p-2 ${styles.cardHover} rounded-lg`}><ChevronRight className={`w-5 h-5 ${styles.textMuted}`} /></button>
                        </div>
                        <div className={`grid grid-cols-7 divide-x ${styles.divider}`}>
                            {weeklyData.dates.map((date, idx) => {
                                const dayLogs = weeklyData.data[date];
                                const dayTotal = dayLogs.reduce((sum, l) => sum + l.hours, 0);
                                const isToday = date === new Date().toISOString().split('T')[0];
                                const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                return (
                                    <div key={date} className={`min-h-[200px] ${isToday ? (isDark ? 'bg-blue-500/5' : 'bg-blue-50') : ''}`}>
                                        <div className={`p-3 border-b ${styles.divider} ${isToday ? (isDark ? 'bg-blue-500/10' : 'bg-blue-100') : styles.tableHeader}`}>
                                            <p className={`text-sm font-medium ${isToday ? styles.accent : styles.textMuted}`}>{dayNames[idx]}</p>
                                            <p className={`text-lg font-bold ${isToday ? styles.text : styles.textMuted}`}>{new Date(date).getDate()}</p>
                                            {dayTotal > 0 && <p className={`${styles.accent} text-sm font-semibold`}>{formatHours(dayTotal)}</p>}
                                        </div>
                                        <div className="p-2 space-y-2">
                                            {dayLogs.map(log => (
                                                <div key={log.logId} className={`p-2 ${styles.cardInner} rounded-lg text-xs cursor-pointer ${styles.cardHover}`} onClick={() => openEditModal(log)}>
                                                    <p className={`${styles.text} font-medium truncate`}>{getProjectName(log.projectId)}</p>
                                                    <p className={styles.accent}>{formatHours(log.hours)}</p>
                                                </div>
                                            ))}
                                            {dayLogs.length === 0 && <p className={`${styles.textSubtle} text-xs text-center py-4`}>No entries</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Log Hours Modal */}
            {showLogModal && canLogHours && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto`}>
                        <div className={`p-5 border-b ${styles.divider} flex items-center justify-between sticky top-0 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                            <h2 className={`text-xl font-bold ${styles.text}`}>Log Hours</h2>
                            <button onClick={() => setShowLogModal(false)} className={`p-2 ${styles.cardHover} rounded-lg`}><X className={`w-5 h-5 ${styles.textMuted}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div><label className={`${styles.textMuted} text-sm block mb-1`}>Project *</label><select value={logForm.projectId} onChange={(e) => setLogForm({ ...logForm, projectId: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`}><option value="">Select Project</option>{projects.map(p => <option key={p.projectId} value={p.projectId}>{p.projectName}</option>)}</select></div>
                            {isAdmin ? (
                                <div><label className={`${styles.textMuted} text-sm block mb-1`}>Consultant *</label><select value={logForm.consultantId} onChange={(e) => setLogForm({ ...logForm, consultantId: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`}><option value="">Select Consultant</option>{consultants.map(c => <option key={c.consultantId} value={c.consultantId}>{c.firstName} {c.lastName}</option>)}</select></div>
                            ) : (
                                <div><label className={`${styles.textMuted} text-sm block mb-1`}>Consultant</label><div className={`px-4 py-2.5 ${styles.cardInner} border ${styles.divider} rounded-lg ${styles.textMuted}`}>{consultants.find(c => c.consultantId === logForm.consultantId)?.firstName || 'You'} {consultants.find(c => c.consultantId === logForm.consultantId)?.lastName || ''}</div></div>
                            )}
                            <div><label className={`${styles.textMuted} text-sm block mb-1`}>Date *</label><input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /></div>
                            <div><label className={`${styles.textMuted} text-sm block mb-1`}>Duration *</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative"><input type="number" min="0" max="24" value={logForm.hours} onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })} placeholder="0" className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /><span className={`absolute right-4 top-1/2 -translate-y-1/2 ${styles.textSubtle}`}>hours</span></div>
                                    <div className="relative"><input type="number" min="0" max="59" value={logForm.minutes} onChange={(e) => setLogForm({ ...logForm, minutes: e.target.value })} placeholder="0" className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg`} /><span className={`absolute right-4 top-1/2 -translate-y-1/2 ${styles.textSubtle}`}>mins</span></div>
                                </div>
                            </div>
                            <div><label className={`${styles.textMuted} text-sm block mb-1`}>Description</label><textarea rows={3} value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} placeholder="What did you work on?" className={`w-full px-4 py-2.5 ${styles.input} border rounded-lg resize-none`} /></div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowLogModal(false)} className={`flex-1 px-5 py-2.5 ${styles.button} rounded-lg`}>Cancel</button>
                                <button onClick={createHoursLog} disabled={loading} className={`flex-1 px-5 py-2.5 ${styles.buttonPrimary} rounded-lg disabled:opacity-50`}>{loading ? 'Saving...' : 'Log Hours'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit/View Modal */}
            {showEditModal && selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
                    <div className={`${styles.modal} border rounded-lg max-w-lg w-full`}>
                        <div className={`p-5 border-b ${styles.divider} flex items-center justify-between`}>
                            <h2 className={`text-xl font-bold ${styles.text}`}>Hours Log Details</h2>
                            <button onClick={() => setShowEditModal(false)} className={`p-2 ${styles.cardHover} rounded-lg`}><X className={`w-5 h-5 ${styles.textMuted}`} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className={`${styles.cardInner} rounded-lg p-4`}><p className={`${styles.textSubtle} text-xs mb-1`}>Project</p><p className={`${styles.text} font-medium`}>{getProjectName(selectedLog.projectId)}</p></div>
                            <div className={`${styles.cardInner} rounded-lg p-4`}><p className={`${styles.textSubtle} text-xs mb-1`}>Consultant</p><p className={styles.text}>{getConsultantNameFromLog(selectedLog)}</p></div>
                            <div className={`${styles.cardInner} rounded-lg p-4`}><p className={`${styles.textSubtle} text-xs mb-1`}>Date</p><p className={styles.text}>{formatDate(selectedLog.date)}</p></div>
                            <div className={`${styles.cardInner} rounded-lg p-4`}><p className={`${styles.textSubtle} text-xs mb-1`}>Hours Logged</p><p className={`${styles.accent} text-xl font-bold`}>{formatHours(selectedLog.hours)}</p></div>
                            <div className={`${styles.cardInner} rounded-lg p-4`}><p className={`${styles.textSubtle} text-xs mb-1`}>Description</p><p className={styles.text}>{selectedLog.description || 'No description'}</p></div>
                            <div className="flex gap-3 pt-2">
                                {canDeleteLogs && <button onClick={() => { setShowDeleteConfirm(selectedLog.logId); setShowEditModal(false); }} className="flex-1 px-5 py-2.5 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30">Delete</button>}
                                <button onClick={() => setShowEditModal(false)} className={`flex-1 px-5 py-2.5 ${styles.button} rounded-lg`}>Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HoursPage;