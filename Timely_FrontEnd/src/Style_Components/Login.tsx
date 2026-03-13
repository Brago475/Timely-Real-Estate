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
            {/* Background Image */}
            <div className="fixed inset-0 z-0">
                <img src={loginBg} alt="" className="w-full h-full object-cover" style={{ minWidth: '100vw', minHeight: '100vh' }} />
            </div>

            <div className="relative z-10 flex min-h-screen">
                {/* Left — Solid Login Panel */}
                <div className={`w-full lg:w-[520px] min-h-screen bg-black flex flex-col justify-center px-10 lg:px-16 ${shake ? "animate-shake" : ""}`}>

                    {/* Logo */}
                    <div className="flex items-center gap-4 mb-12">
                        <img src={timelyLogo} alt="Timely" className="w-14 h-14 object-contain" />
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Timely</h2>
                            <p className="text-[10px] tracking-[0.2em] uppercase text-gray-400">Real Estate</p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                            <p className="text-sm font-medium text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input type="email" placeholder="Email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="h-14 w-full rounded-full border border-neutral-700 bg-neutral-900 px-5 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none" />
                        </div>
                        <div className="relative">
                            <input type={showPassword ? "text" : "password"} placeholder="Password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="h-14 w-full rounded-full border border-neutral-700 bg-neutral-900 px-5 pr-14 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <button type="submit" disabled={isLoading} className="h-14 w-full rounded-full bg-white text-black font-bold text-[15px] transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2">
                            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Signing in...</> : "Sign in"}
                        </button>
                    </form>

                    {/* Forgot password */}
                    <div className="mt-8">
                        <p className="mb-4 text-lg font-bold tracking-[-0.02em]">Forgot your password?</p>
                        <button type="button" className="h-14 w-full rounded-full border border-neutral-700 bg-transparent text-white font-semibold hover:bg-neutral-900 transition">Contact administrator</button>
                    </div>

                    {/* Footer */}
                    <p className="mt-8 text-sm leading-relaxed text-neutral-400">By signing in, you agree to the Timely Terms of Service and Privacy Policy.</p>

                    <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-500">
                        <span>About</span><span>Support</span><span>Privacy Policy</span><span>Terms of Service</span><span>Timely &copy; {new Date().getFullYear()}</span>
                    </div>
                </div>

                {/* Right — Background with Tagline */}
                <div className="hidden lg:flex flex-1 flex-col items-center justify-center px-16 xl:px-24">
                    <h1 className="text-[4rem] xl:text-[5.5rem] font-extrabold leading-[0.92] tracking-[-0.04em] text-white text-center" style={{ textShadow: '0 4px 30px rgba(0,0,0,0.8), 0 2px 10px rgba(0,0,0,0.6)' }}>
                        Manage<br />Everything.<br />Miss Nothing.
                    </h1>
                    <p className="text-white text-xl mt-8 max-w-lg text-center leading-relaxed" style={{ textShadow: '0 2px 15px rgba(0,0,0,0.7)' }}>
                        Track projects, schedule consultants, and stay on top of every detail — all in one place.
                    </p>
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