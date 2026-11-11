import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Sprout } from "lucide-react";
import { adminLogin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Admin Portal — Miss Agriculture Zambia" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLoginPage,
});

const INSTITUTIONAL_GREEN = "#1b4332";
const INSTITUTIONAL_GREEN_HOVER = "#153226";
const INSTITUTIONAL_ACCENT = "#2d6a4f";
const INSTITUTIONAL_GOLD = "#d4af37";

function AdminLoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(adminLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await login({ data: { email, password } });
      navigate({ to: "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Left side — Login form */}
      <div
        className="flex w-full flex-col items-center justify-center px-6 py-12 md:w-3/5 lg:w-2/3"
        style={{ backgroundColor: "#fdfcfb" }}
      >
        <div className="w-full max-w-[400px]">
          {/* Brand mark */}
          <div className="mb-10 flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl shadow-sm"
              style={{ backgroundColor: INSTITUTIONAL_GREEN }}
            >
              <Sprout className="h-7 w-7" strokeWidth={1.5} style={{ color: INSTITUTIONAL_GOLD }} />
            </div>
            <h1
              className="mb-1 text-xl font-bold tracking-tight"
              style={{ color: INSTITUTIONAL_GREEN, fontFamily: "'Public Sans', sans-serif" }}
            >
              Miss Agriculture Zambia
            </h1>
            <p className="text-sm font-medium uppercase tracking-widest text-stone-500">
              Admin Portal
            </p>
          </div>

          {/* Login card */}
          <div
            className="rounded-2xl border border-stone-200 bg-white p-8"
            style={{ boxShadow: "0 8px 30px rgb(0,0,0,0.04)" }}
          >
            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-stone-700"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@missagrizambia.org"
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition-all focus:border-[#1b4332] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider text-stone-700"
                  >
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-xs font-medium transition-colors"
                    style={{ color: INSTITUTIONAL_ACCENT }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = INSTITUTIONAL_GREEN)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = INSTITUTIONAL_ACCENT)}
                  >
                    Forgot?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 transition-all focus:border-[#1b4332] focus:outline-none focus:ring-2 focus:ring-[#1b4332]/20"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer rounded-lg py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: INSTITUTIONAL_GREEN }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = INSTITUTIONAL_GREEN_HOVER;
                }}
                onMouseLeave={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = INSTITUTIONAL_GREEN;
                }}
              >
                {loading ? "Signing in…" : "Sign in to Dashboard"}
              </button>
            </form>
          </div>

          {/* Back link */}
          <div className="mt-8 text-center">
            <Link
              to="/"
              className="group inline-flex items-center text-xs font-medium text-stone-500 transition-colors hover:text-stone-800"
            >
              <ArrowLeft className="mr-2 h-3 w-3 transition-transform group-hover:-translate-x-1" />
              Back to main website
            </Link>
          </div>
        </div>
      </div>

      {/* Right side — Image */}
      <div
        className="relative hidden md:block md:w-2/5 lg:w-1/3"
        style={{ backgroundColor: INSTITUTIONAL_GREEN }}
      >
        <img
          src="/miss-agriculture-queen.png"
          alt="Miss Agriculture Zambia"
          loading="lazy"
          className="h-full w-full object-cover object-center"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "linear-gradient(to top, rgba(27,67,50,0.55) 0%, transparent 50%)",
          }}
        />
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <p className="text-xs font-medium uppercase tracking-widest opacity-80">Crown &amp; Glory</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight lg:text-2xl">Miss Agriculture Zambia</h2>
        </div>
      </div>
    </main>
  );
}
