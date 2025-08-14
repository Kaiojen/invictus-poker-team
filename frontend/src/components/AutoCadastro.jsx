import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

const AutoCadastro = ({ onBackToLogin }) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    phone: "",
    document: "",
    birth_date: "",
    pix_key: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [availability, setAvailability] = useState({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const checkAvailability = async (field, value) => {
    if (!value) return;

    setCheckingAvailability(true);
    try {
      const response = await fetch("/api/registration/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (response.ok) {
        const data = await response.json();
        setAvailability((prev) => ({
          ...prev,
          [field]: data[`${field}_available`],
        }));
      }
    } catch (error) {
      console.error("Erro ao verificar disponibilidade:", error);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const validateForm = () => {
    const errors = [];

    if (!formData.username) errors.push("Nome de usuário é obrigatório");
    if (!formData.email) errors.push("Email é obrigatório");
    if (!formData.password) errors.push("Senha é obrigatória");
    if (formData.password !== formData.confirmPassword)
      errors.push("Senhas não coincidem");
    if (!formData.full_name) errors.push("Nome completo é obrigatório");
    if (!formData.phone) errors.push("Telefone é obrigatório");
    if (!formData.document) errors.push("CPF é obrigatório");
    if (!formData.birth_date) errors.push("Data de nascimento é obrigatória");

    // Validar idade
    if (formData.birth_date) {
      const birthDate = new Date(formData.birth_date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      let calculatedAge = age;
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        calculatedAge--;
      }

      const finalAge = calculatedAge;

      if (finalAge < 18) {
        errors.push("Você deve ter pelo menos 18 anos");
      }
    }

    // Validar senha
    if (formData.password && formData.password.length < 8) {
      errors.push("Senha deve ter pelo menos 8 caracteres");
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/registration/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setRegistrationSuccess(true);
        toast.success("Cadastro realizado com sucesso!");
      } else {
        toast.error(data.error || "Erro ao realizar cadastro");
      }
    } catch (error) {
      toast.error("Erro de conexão. Tente novamente.");
      console.error("Erro no cadastro:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCPF = (value) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  if (registrationSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <Card className="w-full max-w-md mx-4 bg-gray-900/90 border-yellow-500/20">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Cadastro Realizado!
            </CardTitle>
            <CardDescription className="text-gray-300">
              Sua solicitação foi enviada com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <AlertDescription className="text-yellow-100">
                Seu cadastro está sendo analisado pela equipe. Você receberá uma
                confirmação quando for aprovado.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-semibold text-white">Próximos passos:</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Aguarde a análise da equipe (até 24h)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Você receberá um email de confirmação
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  Após aprovação, poderá fazer login
                </li>
              </ul>
            </div>

            <Button
              onClick={onBackToLogin}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 py-8">
      <Card className="w-full max-w-2xl mx-4 bg-gray-900/90 border-yellow-500/20">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-black" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Cadastro Invictus Poker Team
          </CardTitle>
          <CardDescription className="text-gray-300">
            Junte-se ao time de poker profissional
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados de Login */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-yellow-500/30 pb-2">
                Dados de Acesso
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white">
                    Nome de Usuário *
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    onBlur={(e) =>
                      checkAvailability("username", e.target.value)
                    }
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="seu_usuario"
                  />
                  {availability.username === false && (
                    <p className="text-red-400 text-sm">
                      Nome de usuário indisponível
                    </p>
                  )}
                  {availability.username === true && (
                    <p className="text-green-400 text-sm">
                      Nome de usuário disponível
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={(e) => checkAvailability("email", e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="seu@email.com"
                  />
                  {availability.email === false && (
                    <p className="text-red-400 text-sm">Email já cadastrado</p>
                  )}
                  {availability.email === true && (
                    <p className="text-green-400 text-sm">Email disponível</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">
                    Senha *
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleInputChange}
                      className="bg-gray-800 border-gray-600 text-white pr-10"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-white"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white">
                    Confirmar Senha *
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="bg-gray-800 border-gray-600 text-white pr-10"
                      placeholder="Repita a senha"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-white"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Dados Pessoais */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-yellow-500/30 pb-2">
                Dados Pessoais
              </h3>

              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-white">
                  Nome Completo *
                </Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white">
                    Telefone *
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setFormData((prev) => ({ ...prev, phone: formatted }));
                    }}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document" className="text-white">
                    CPF *
                  </Label>
                  <Input
                    id="document"
                    name="document"
                    value={formData.document}
                    onChange={(e) => {
                      const formatted = formatCPF(e.target.value);
                      setFormData((prev) => ({ ...prev, document: formatted }));
                    }}
                    onBlur={(e) =>
                      checkAvailability("document", e.target.value)
                    }
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  {availability.document === false && (
                    <p className="text-red-400 text-sm">CPF já cadastrado</p>
                  )}
                  {availability.document === true && (
                    <p className="text-green-400 text-sm">CPF disponível</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birth_date" className="text-white">
                  Data de Nascimento *
                </Label>
                <Input
                  id="birth_date"
                  name="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={handleInputChange}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Dados Bancários (Opcionais) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-yellow-500/30 pb-2">
                Dados Bancários
                <Badge variant="secondary" className="ml-2">
                  Opcional
                </Badge>
              </h3>

              <div className="space-y-2">
                <Label htmlFor="pix_key" className="text-white">
                  Chave PIX
                </Label>
                <Input
                  id="pix_key"
                  name="pix_key"
                  value={formData.pix_key}
                  onChange={handleInputChange}
                  className="bg-gray-800 border-gray-700 text-white"
                  placeholder="Email, telefone ou chave aleatória"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_name" className="text-white">
                    Banco
                  </Label>
                  <Input
                    id="bank_name"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleInputChange}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="Nome do banco"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_agency" className="text-white">
                    Agência
                  </Label>
                  <Input
                    id="bank_agency"
                    name="bank_agency"
                    value={formData.bank_agency}
                    onChange={handleInputChange}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="0000-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bank_account" className="text-white">
                    Conta
                  </Label>
                  <Input
                    id="bank_account"
                    name="bank_account"
                    value={formData.bank_account}
                    onChange={handleInputChange}
                    className="bg-gray-800 border-gray-700 text-white"
                    placeholder="00000-0"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onBackToLogin}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                disabled={loading}
              >
                Voltar ao Login
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                disabled={loading || checkingAvailability}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    Cadastrando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Cadastrar
                  </div>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoCadastro;
