// src/Views_Layouts/Login.tsx
import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import timelyLogo from "../assets/Timely_logo.jpg";

interface LoginProps {
  onLoginSuccess: (userData: {
    customerId: string;
    email: string;
    name: string;
    role?: string;
  }) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Login failed");

      login(data.token, data.user);
      localStorage.setItem("timely_user", JSON.stringify(data.user));
      localStorage.setItem("timely_authenticated", "true");
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Left Side */}
        <section className="hidden lg:flex flex-1 items-center justify-center px-16">
          <div className="flex items-center justify-center">
            <img
              src={timelyLogo}
              alt="Timely"
              className="w-[420px] xl:w-[520px] 2xl:w-[620px] h-auto object-contain"
            />
          </div>
        </section>

        {/* Right Side */}
        <section className="w-full lg:w-[620px] flex items-center justify-center px-8 sm:px-12 lg:px-16">
          <div
            className={`w-full max-w-[420px] ${shake ? "animate-shake" : ""}`}
          >
            {/* Mobile logo */}
            <div className="lg:hidden mb-10 flex justify-center">
              <img
                src={timelyLogo}
                alt="Timely"
                className="w-24 h-24 object-contain"
              />
            </div>

            {/* Heading */}
            <div className="mb-10">
              <h1 className="text-[3.3rem] sm:text-[4rem] font-extrabold leading-[0.95] tracking-[-0.04em]">
                Happening now
              </h1>
            </div>

            <div className="mb-8">
              <h2 className="text-[2rem] font-bold tracking-[-0.03em]">
                Sign in today.
              </h2>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <p className="text-sm font-medium text-red-400">{error}</p>
              </div>
            )}

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 w-full rounded-full border border-neutral-700 bg-transparent px-5 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
                />
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 w-full rounded-full border border-neutral-700 bg-transparent px-5 pr-14 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="h-14 w-full rounded-full bg-white text-black font-bold text-[15px] transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-800" />
              <span className="text-sm text-neutral-500">or</span>
              <div className="h-px flex-1 bg-neutral-800" />
            </div>

            {/* Secondary actions */}
            <div className="space-y-4">
              <button
                type="button"
                className="h-14 w-full rounded-full border border-neutral-700 bg-transparent text-white font-semibold hover:bg-neutral-900 transition"
              >
                Create account
              </button>

              <div className="pt-6">
                <p className="mb-4 text-[1.35rem] font-bold tracking-[-0.02em]">
                  Forgot your password?
                </p>
                <button
                  type="button"
                  className="h-14 w-full rounded-full border border-neutral-700 bg-transparent text-white font-semibold hover:bg-neutral-900 transition"
                >
                  Contact administrator
                </button>
              </div>
            </div>

            {/* Footer text */}
            <p className="mt-8 text-xs leading-relaxed text-neutral-500">
              By signing in, you agree to the Timely Terms of Service and
              Privacy Policy.
            </p>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-900 px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] flex-wrap gap-x-4 gap-y-2 text-[11px] text-neutral-500">
          <span>About</span>
          <span>Support</span>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>Contact</span>
          <span>Timely © {new Date().getFullYear()}</span>
        </div>
      </footer>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(3px); }
          75% { transform: translateX(-1px); }
        }

        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Login;