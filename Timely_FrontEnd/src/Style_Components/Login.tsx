// src/Views_Layouts/Login.tsx
import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import timelyLogo from "../assets/Timely_logo.png";
import loginBg from "../assets/timely_background.jpg";

interface LoginProps { onLoginSuccess: (userData: { customerId: string; email: string; name: string; role?: string }) => void; }

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const { login } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [shake, setShake] = useState(false);

    const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 500); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(""); setIsLoading(true);
        try {
            const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Login failed");
            login(data.token, data.user); localStorage.setItem("timely_user", JSON.stringify(data.user)); localStorage.setItem("timely_authenticated", "true"); onLoginSuccess(data.user);
        } catch (err: any) { setError(err.message || "Invalid credentials"); triggerShake(); } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen flex relative overflow-hidden">
            {/* Background Image — full screen */}
            <div className="absolute inset-0 z-0">
                <img src={timelyLogo} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60" />
            </div>

            {/* Left Panel — Login Form */}
            <div className="relative z-10 w-full max-w-md min-h-screen flex flex-col justify-center px-10 py-12 bg-[#0a0a0a]/90 backdrop-blur-xl border-r border-gray-800/50">
                <div className={`animate-fadeIn ${shake ? "animate-shake" : ""}`} style={{ animationDuration: shake ? "0.4s" : "0.5s" }}>

                    {/* Logo + Header */}
                    <div className="mb-10">
                        <div className="flex items-center gap-4 mb-8">
                            <img src={loginBg} alt="Timely" className="w-12 h-12 rounded-xl" />
                            <div>
                                <h1 className="text-xl font-semibold text-white tracking-tight">Timely</h1>
                                <p className="text-[10px] tracking-[0.2em] uppercase text-gray-500">Real Estate</p>
                            </div>
                        </div>
                        <h2 className="text-2xl font-semibold text-white tracking-tight">Welcome back</h2>
                        <p className="text-gray-500 text-sm mt-1">Sign in to manage your operations</p>
                    </div>

                    {/* Form Card */}
                    <div className="neu-dark p-7">
                        {error && (
                            <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl animate-fadeIn">
                                <p className="text-sm text-red-400 text-center font-medium">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <div>
                                <label className="block text-[11px] font-medium text-blue-400 mb-2 uppercase tracking-wider">Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail className="w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" /></div>
                                    <input type="email" placeholder="name@company.com" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-transparent border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all duration-200" />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-[11px] font-medium text-blue-400 mb-2 uppercase tracking-wider">Password</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Lock className="w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" /></div>
                                    <input type={showPassword ? "text" : "password"} placeholder="Enter your password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 pr-12 py-3 bg-transparent border border-gray-700 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all duration-200" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 transition-colors">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit */}
                            <button type="submit" disabled={isLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed rounded-xl text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]">
                                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</> : "Sign In"}
                            </button>
                        </form>

                        <div className="mt-6 pt-5 border-t border-gray-800">
                            <p className="text-xs text-gray-600 text-center">Need help? <span className="text-blue-400/80 hover:text-blue-400 cursor-pointer transition-colors">Contact your administrator</span></p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-8"><p className="text-gray-700 text-xs tracking-wide">Timely Real Estate &copy; {new Date().getFullYear()}</p></div>
                </div>
            </div>

            {/* Right Side — visible background with overlay text */}
            <div className="hidden lg:flex flex-1 relative z-10 items-end p-12">
                <div className="max-w-lg">
                    <h2 className="text-4xl font-bold text-white leading-tight mb-4">Manage your real estate<br />operations with precision</h2>
                    <p className="text-gray-300/70 text-sm leading-relaxed">Track projects, manage consultants, schedule appointments, and stay on top of every detail — all in one place.</p>
                </div>
            </div>

            <style>{`
                @keyframes shake { 0%, 100% { transform: translateX(0); } 15% { transform: translateX(-8px); } 30% { transform: translateX(6px); } 45% { transform: translateX(-4px); } 60% { transform: translateX(3px); } 75% { transform: translateX(-1px); } }
                .animate-shake { animation: shake 0.4s ease-in-out; }
            `}</style>
        </div>
    );
};

export default Login;