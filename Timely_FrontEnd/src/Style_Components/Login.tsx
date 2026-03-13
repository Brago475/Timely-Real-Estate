// src/Views_Layouts/Login.tsx
import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
        <div className="min-h-screen text-white relative overflow-hidden bg-black">
            {/* Background */}
            <div className="fixed inset-0 z-0">
                <img src={loginBg} alt="" className="w-full h-full object-cover" style={{ minWidth: '100vw', minHeight: '100vh' }} />
            </div>

            <div className="relative z-10 flex flex-row-reverse min-h-screen items-center justify-center gap-12 xl:gap-16 px-6">
                {/* Tagline — Right */}
                <div className="hidden lg:flex flex-col items-start max-w-lg">
                    <h1 className="text-[4rem] xl:text-[5.5rem] font-extrabold leading-[0.92] tracking-[-0.04em] text-white" style={{ textShadow: '0 4px 30px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.6)' }}>
                        Manage<br />Everything.<br />Miss Nothing.
                    </h1>
                    <p className="text-white text-xl mt-8 max-w-md leading-relaxed" style={{ textShadow: '0 2px 15px rgba(0,0,0,0.7)' }}>
                        Track projects, schedule consultants, and stay on top of every detail — all in one place.
                    </p>
                </div>

                {/* Login Card — Left */}
                <div className={`w-full max-w-[420px] bg-black/80 backdrop-blur-2xl rounded-3xl p-10 border border-white/10 ${shake ? "animate-shake" : ""}`}>

                    {/* Logo + Name */}
                    <div className="flex flex-col items-center mb-10">
                        <div className="bg-white/15 rounded-2xl p-4 backdrop-blur-sm">
                            <img src={timelyLogo} alt="Timely" className="w-16 h-16 object-contain" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mt-4 tracking-tight" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>Timely</h2>
                        <p className="text-[11px] tracking-[0.25em] uppercase text-neutral-300 font-medium mt-0.5">Real Estate</p>
                    </div>

                    {/* Mobile tagline */}
                    <div className="lg:hidden mb-8 text-center">
                        <h1 className="text-2xl font-extrabold tracking-tight">Manage Everything.<br />Miss Nothing.</h1>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/15 px-4 py-3">
                            <p className="text-sm font-medium text-red-400 text-center">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input type="email" placeholder="Email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="h-14 w-full rounded-2xl border border-white/15 bg-black/60 px-5 text-[15px] text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none transition-colors" />
                        </div>
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} placeholder="Password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="h-14 w-full rounded-2xl border border-white/15 bg-black/60 px-5 pr-14 text-[15px] text-white placeholder:text-neutral-500 focus:border-white/30 focus:outline-none transition-colors" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition">
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                        <button type="submit" disabled={isLoading} className="h-14 w-full rounded-2xl bg-white text-black font-bold text-[15px] transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-white/10">
                            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in...</> : "Sign in"}
                        </button>
                    </form>

                    {/* Forgot password */}
                    <div className="mt-8">
                        <p className="mb-4 text-[17px] font-bold text-white tracking-[-0.02em]">Forgot your password?</p>
                        <button type="button" className="h-14 w-full rounded-2xl border border-white/15 bg-transparent text-white font-semibold hover:bg-white/5 transition text-[15px]">Contact administrator</button>
                    </div>

                    {/* Footer */}
                    <p className="mt-8 text-sm leading-relaxed text-neutral-300">By signing in, you agree to the Timely <span className="text-blue-400 cursor-pointer hover:text-blue-300">Terms of Service</span> and <span className="text-blue-400 cursor-pointer hover:text-blue-300">Privacy Policy</span>.</p>
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