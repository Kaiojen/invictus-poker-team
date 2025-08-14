import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Crown, UserPlus, Mail } from "lucide-react";
import AutoCadastro from "./AutoCadastro";

const LoginForm = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [twoFARequired, setTwoFARequired] = useState(false);
  const [totp, setTotp] = useState("");
  const [showRegistration, setShowRegistration] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);

  // Detectar token vindo por link (#reset?token=...)
  useEffect(() => {
    try {
      const hash = window.location.hash || "";
      if (hash.startsWith("#reset")) {
        const params = new URLSearchParams(hash.split("?")[1] || "");
        const token = params.get("token");
        if (token) {
          setShowForgotPassword(true);
          setShowResetForm(true);
          setResetToken(token);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          totp: twoFARequired ? totp : undefined,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.user);
      } else {
        if (data.two_factor_required) {
          setTwoFARequired(true);
          setError("Informe seu código 2FA ou recovery code");
        } else {
          setError(data.error || "Erro ao fazer login");
        }
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setForgotPasswordMessage("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: forgotPasswordEmail,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        // Não exibir token na interface; apenas mensagem genérica.
        setForgotPasswordMessage(
          data.email_sent
            ? "Se o usuário existir, você receberá um e-mail com as instruções."
            : "Se o usuário existir, um token foi gerado. Verifique seu e-mail."
        );
        // Para ambiente de desenvolvimento, ainda registramos no console
        if (data.reset_token) {
          // eslint-disable-next-line no-console
          console.log("[DEV] Reset token:", data.reset_token);
        }
        // Oferecer passo seguinte (abrir form de redefinição)
        setShowResetForm(true);
      } else {
        setError(data.error || "Erro ao solicitar reset de senha");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (newPassword !== confirmPassword) {
        setError("As senhas não conferem");
        setLoading(false);
        return;
      }
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: resetToken,
          new_password: newPassword,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setForgotPasswordMessage(
          "Senha alterada com sucesso! Você pode fazer login agora."
        );
        setShowForgotPassword(false);
        setResetToken("");
        setNewPassword("");
        setForgotPasswordEmail("");
      } else {
        setError(data.error || "Erro ao resetar senha");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    } finally {
      setLoading(false);
    }
  };

  if (showRegistration) {
    return <AutoCadastro onBackToLogin={() => setShowRegistration(false)} />;
  }

  // Componente para "Esqueci Senha"
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-card border border-border">
                <img
                  src="/LOGO_NOVO.png"
                  alt="Invictus Poker Team"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold gradient-gold-text">
              Recuperar Senha
            </CardTitle>
            <CardDescription>
              {resetToken
                ? "Digite sua nova senha"
                : "Digite seu nome de usuário"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {forgotPasswordMessage && (
              <Alert className="mb-4">
                <AlertDescription>{forgotPasswordMessage}</AlertDescription>
              </Alert>
            )}

            {!showResetForm ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Nome de usuário ou email</Label>
                  <Input
                    id="forgotEmail"
                    name="forgotEmail"
                    type="text"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gradient-gold text-primary-foreground font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Solicitar Reset
                    </>
                  )}
                </Button>
                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setShowResetForm(true);
                      setForgotPasswordMessage("");
                    }}
                  >
                    Já tem o token? Inserir manualmente
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetToken">Token de recuperação</Label>
                  <Input
                    id="resetToken"
                    name="resetToken"
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova senha</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="bg-input border-border focus:border-primary"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gradient-gold text-primary-foreground font-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    "Alterar Senha"
                  )}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForgotPassword(false);
                  setError("");
                  setForgotPasswordMessage("");
                  setResetToken("");
                  setNewPassword("");
                  setForgotPasswordEmail("");
                }}
                disabled={loading}
              >
                Voltar ao Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-card border border-border">
              <img
                src="/LOGO_NOVO.png"
                alt="Invictus Poker Team"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold gradient-gold-text">
            Invictus Poker Team
          </CardTitle>
          <CardDescription>Sistema de Gestão de Jogadores</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                className="bg-input border-border focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                className="bg-input border-border focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              className="w-full gradient-gold text-primary-foreground font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          {/* Link Esqueci Senha */}
          <div className="mt-4 text-center">
            <Button
              type="button"
              variant="link"
              className="text-sm text-muted-foreground hover:text-primary"
              onClick={() => setShowForgotPassword(true)}
              disabled={loading}
            >
              Esqueceu a senha?
            </Button>
          </div>

          {twoFARequired && (
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="totp">Código 2FA ou Recovery</Label>
                <Input
                  id="totp"
                  name="totp"
                  type="text"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Validar 2FA
              </Button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-center text-gray-400 mb-4">Novo no time?</p>
            <Button
              type="button"
              variant="outline"
              className="w-full border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
              onClick={() => setShowRegistration(true)}
              disabled={loading}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Cadastrar-se como Jogador
            </Button>
          </div>

          {/* Rodapé minimalista */}
          <div className="mt-6 text-center text-xs text-muted-foreground/70">
            <p>© {new Date().getFullYear()} Invictus Poker Team</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;
