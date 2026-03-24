import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import { supabase } from "../lib/supabase";
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowRight, CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import logoImg from "../../assets/logo-certifica-dark.png";

type Mode = "login" | "forgot" | "reset_sent" | "register" | "register_sent";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const emailRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if already logged in → redirect to app
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const from = (location.state as any)?.from || "/";
        navigate(from, { replace: true });
      }
    });
    emailRef.current?.focus();
  }, [navigate, location.state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("E-mail ou senha incorretos. Verifique seus dados e tente novamente.");
        } else if (authError.message.includes("Email not confirmed")) {
          setError("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.");
        } else if (authError.message.includes("Too many requests")) {
          setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        } else {
          setError(authError.message);
        }
        return;
      }

      const from = (location.state as any)?.from || "/";
      navigate(from, { replace: true });
    } catch {
      setError("Erro inesperado. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/login` }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setMode("reset_sent");
    } catch {
      setError("Erro ao enviar e-mail. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { full_name: nome.trim() || undefined } },
      });
      if (signUpError) {
        if (signUpError.message.includes("already registered") || signUpError.message.includes("User already registered")) {
          setError("Este e-mail já está cadastrado. Tente fazer login.");
        } else {
          setError(signUpError.message);
        }
        return;
      }
      setMode("register_sent");
    } catch {
      setError("Erro inesperado. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #0E2A47 0%, #1F3F66 50%, #0E2A47 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[200px] -right-[200px] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #2B8EAD 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-[200px] -left-[200px] w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #2B8EAD 0%, transparent 70%)" }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-[400px] px-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logoImg} alt="Certifica" className="h-[36px] w-auto brightness-0 invert" />
        </div>

        <div
          className="bg-white rounded-[8px] overflow-hidden shadow-2xl"
          style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.4)" }}
        >
          {/* Card header */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-100">
            {mode === "login" && (
              <>
                <h1 className="text-[20px] text-[#0E2A47] mb-1" style={{ fontWeight: 700, letterSpacing: "-0.3px" }}>
                  Bem-vindo de volta
                </h1>
                <p className="text-[13px] text-gray-500">
                  Entre com suas credenciais para continuar
                </p>
              </>
            )}
            {mode === "register" && (
              <>
                <h1 className="text-[20px] text-[#0E2A47] mb-1" style={{ fontWeight: 700, letterSpacing: "-0.3px" }}>
                  Criar conta
                </h1>
                <p className="text-[13px] text-gray-500">
                  Preencha os dados para começar a usar o Certifica
                </p>
              </>
            )}
            {mode === "forgot" && (
              <>
                <h1 className="text-[20px] text-[#0E2A47] mb-1" style={{ fontWeight: 700, letterSpacing: "-0.3px" }}>
                  Recuperar senha
                </h1>
                <p className="text-[13px] text-gray-500">
                  Enviaremos um link de redefinição para seu e-mail
                </p>
              </>
            )}
            {mode === "reset_sent" && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={2} />
                  <h1 className="text-[20px] text-[#0E2A47]" style={{ fontWeight: 700, letterSpacing: "-0.3px" }}>
                    E-mail enviado!
                  </h1>
                </div>
                <p className="text-[13px] text-gray-500">
                  Verifique sua caixa de entrada
                </p>
              </>
            )}
            {mode === "register_sent" && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" strokeWidth={2} />
                  <h1 className="text-[20px] text-[#0E2A47]" style={{ fontWeight: 700, letterSpacing: "-0.3px" }}>
                    Conta criada!
                  </h1>
                </div>
                <p className="text-[13px] text-gray-500">
                  Confirme seu e-mail para ativar
                </p>
              </>
            )}
          </div>

          {/* Card body */}
          <div className="px-8 py-7">
            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-[11.5px] text-gray-600 mb-1.5" style={{ fontWeight: 500 }}>
                    E-mail
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="seu@email.com"
                      className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-[5px] text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B8EAD]/30 focus:border-[#2B8EAD]/50 transition-all"
                      style={{ fontWeight: 400 }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11.5px] text-gray-600" style={{ fontWeight: 500 }}>
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => toast.info("Entre em contato com o administrador para redefinir sua senha")}
                      className="text-[11px] text-[#2B8EAD] hover:text-[#1F3F66] transition-colors cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      Esqueci a senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-10 bg-gray-50 border border-gray-200 rounded-[5px] text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B8EAD]/30 focus:border-[#2B8EAD]/50 transition-all"
                      style={{ fontWeight: 400 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-[5px]">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-px" strokeWidth={1.5} />
                    <span className="text-[12px] text-red-700" style={{ lineHeight: "1.5" }}>{error}</span>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-[5px] text-white text-[13px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: loading || !email || !password
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #2B8EAD 0%, #1F3F66 100%)",
                    fontWeight: 600,
                    boxShadow: !loading && email && password ? "0 4px 12px rgba(43,142,173,0.35)" : "none",
                  }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="w-4 h-4" strokeWidth={2} />
                    </>
                  )}
                </button>

                {/* Link criar conta */}
                <p className="text-center text-[12px] text-gray-500 pt-1">
                  Não tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => toast.info("Entre em contato com o administrador para criar sua conta")}
                    className="text-[#2B8EAD] hover:text-[#1F3F66] font-medium transition-colors cursor-pointer"
                  >
                    Criar conta
                  </button>
                </p>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-[11.5px] text-gray-600 mb-1.5" style={{ fontWeight: 500 }}>
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="seu@email.com"
                      className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-[5px] text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B8EAD]/30 focus:border-[#2B8EAD]/50 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-[5px]">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-px" strokeWidth={1.5} />
                    <span className="text-[12px] text-red-700">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-[5px] text-white text-[13px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #2B8EAD 0%, #1F3F66 100%)",
                    fontWeight: 600,
                  }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} /> : "Enviar link de recuperação"}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); }}
                  className="w-full text-[12px] text-gray-500 hover:text-gray-700 transition-colors cursor-pointer py-1"
                >
                  ← Voltar ao login
                </button>
              </form>
            )}

            {mode === "reset_sent" && (
              <div className="space-y-4">
                <p className="text-[13px] text-gray-600" style={{ lineHeight: "1.6" }}>
                  Enviamos um link de redefinição de senha para <strong>{email}</strong>.
                  Verifique também sua pasta de spam.
                </p>
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-[5px] text-white text-[13px] transition-all cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #2B8EAD 0%, #1F3F66 100%)",
                    fontWeight: 600,
                  }}
                >
                  Voltar ao login
                </button>
              </div>
            )}

            {mode === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-[11.5px] text-gray-600 mb-1.5" style={{ fontWeight: 500 }}>
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    autoComplete="name"
                    placeholder="Seu nome"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-[5px] text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B8EAD]/30 focus:border-[#2B8EAD]/50 transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[11.5px] text-gray-600 mb-1.5" style={{ fontWeight: 500 }}>
                    E-mail *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="seu@email.com"
                      className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-[5px] text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B8EAD]/30 focus:border-[#2B8EAD]/50 transition-all"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-[11.5px] text-gray-600 mb-1.5" style={{ fontWeight: 500 }}>
                    Senha *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      className="w-full h-10 pl-9 pr-10 bg-gray-50 border border-gray-200 rounded-[5px] text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B8EAD]/30 focus:border-[#2B8EAD]/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                {/* Confirmar senha */}
                <div>
                  <label className="block text-[11.5px] text-gray-600 mb-1.5" style={{ fontWeight: 500 }}>
                    Confirmar senha *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      className="w-full h-10 pl-9 pr-10 bg-gray-50 border border-gray-200 rounded-[5px] text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B8EAD]/30 focus:border-[#2B8EAD]/50 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-[5px]">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-px" strokeWidth={1.5} />
                    <span className="text-[12px] text-red-700">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !password || !confirmPassword}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-[5px] text-white text-[13px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #2B8EAD 0%, #1F3F66 100%)",
                    fontWeight: 600,
                    boxShadow: "0 4px 12px rgba(43,142,173,0.35)",
                  }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" strokeWidth={2} />
                      Criar conta
                    </>
                  )}
                </button>

                <p className="text-center text-[12px] text-gray-500 pt-1">
                  Já tem conta?{" "}
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(null); }}
                    className="text-[#2B8EAD] hover:text-[#1F3F66] font-medium transition-colors cursor-pointer"
                  >
                    Entrar
                  </button>
                </p>
              </form>
            )}

            {mode === "register_sent" && (
              <div className="space-y-4">
                <p className="text-[13px] text-gray-600" style={{ lineHeight: "1.6" }}>
                  Enviamos um e-mail de confirmação para <strong>{email}</strong>.
                  Clique no link do e-mail para ativar sua conta. Verifique também o spam.
                </p>
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); setPassword(""); setConfirmPassword(""); setNome(""); }}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-[5px] text-white text-[13px] transition-all cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #2B8EAD 0%, #1F3F66 100%)",
                    fontWeight: 600,
                  }}
                >
                  Ir para o login
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-white/30 mt-6">
          © {new Date().getFullYear()} Certifica Gestão de Sistemas · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}
