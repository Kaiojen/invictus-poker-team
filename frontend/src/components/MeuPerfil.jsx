import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  User,
  Edit,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Shield,
  Target,
  Save,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import PlayerPermissions from "./PlayerPermissions";

const MeuPerfil = ({ user, userRole }) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    document: "",
    birth_date: "",
    pix_key: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
  });

  useEffect(() => {
    fetchUserProfile();
  }, [user.id]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data.user);
        setEditForm({
          full_name: data.user.full_name || "",
          email: data.user.email || "",
          phone: data.user.phone || "",
          document: data.user.document || "",
          birth_date: data.user.birth_date || "",
          pix_key: data.user.pix_key || "",
          bank_name: data.user.bank_name || "",
          bank_agency: data.user.bank_agency || "",
          bank_account: data.user.bank_account || "",
        });
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
      setError("Erro ao carregar dados do perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setUserData(data.user);
        setEditing(false);
        setSuccess("Perfil atualizado com sucesso!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Erro ao atualizar perfil");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    }
  };

  const handleChange = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      return age - 1;
    }
    return age;
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatDate = (dateString) => {
    if (!dateString) return "Não informado";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const maskDocument = (document) => {
    if (!document) return "Não informado";
    return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-**");
  };

  const maskBankAccount = (account) => {
    if (!account) return "Não informado";
    if (account.length <= 4) return account;
    return `****${account.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header do Perfil */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="gradient-gold-text text-2xl">
                  {userData?.full_name}
                </CardTitle>
                <CardDescription className="flex items-center space-x-2">
                  <Badge variant="outline">{userData?.role}</Badge>
                  {userData?.reta_name && (
                    <Badge className="gradient-gold">
                      <Target className="w-3 h-3 mr-1" />
                      {userData.reta_name}
                    </Badge>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSensitiveData(!showSensitiveData)}
              >
                {showSensitiveData ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
              <Button variant="outline" onClick={() => setEditing(!editing)}>
                <Edit className="w-4 h-4 mr-2" />
                {editing ? "Cancelar" : "Editar"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="dados-pessoais" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dados-pessoais">👤 Dados Pessoais</TabsTrigger>
          <TabsTrigger value="financeiro">💰 Financeiro</TabsTrigger>
          <TabsTrigger value="permissoes">🛡️ Permissões</TabsTrigger>
        </TabsList>

        <TabsContent value="dados-pessoais" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dados Básicos */}
            <Card>
              <CardHeader>
                <CardTitle>📋 Informações Básicas</CardTitle>
                <CardDescription>Dados principais da conta</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  {editing ? (
                    <Input
                      value={editForm.full_name}
                      onChange={(e) =>
                        handleChange("full_name", e.target.value)
                      }
                      placeholder="Seu nome completo"
                    />
                  ) : (
                    <p className="p-2 bg-secondary/20 rounded">
                      {userData?.full_name || "Não informado"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  {editing ? (
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="seu@email.com"
                    />
                  ) : (
                    <p className="p-2 bg-secondary/20 rounded flex items-center">
                      <Mail className="w-4 h-4 mr-2" />
                      {userData?.email || "Não informado"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Telefone</Label>
                  {editing ? (
                    <Input
                      value={editForm.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  ) : (
                    <p className="p-2 bg-secondary/20 rounded flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      {userData?.phone || "Não informado"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  {editing ? (
                    <Input
                      type="date"
                      value={editForm.birth_date}
                      onChange={(e) =>
                        handleChange("birth_date", e.target.value)
                      }
                    />
                  ) : (
                    <p className="p-2 bg-secondary/20 rounded flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(userData?.birth_date)}
                      {userData?.birth_date && (
                        <span className="ml-2 text-muted-foreground">
                          ({calculateAge(userData.birth_date)} anos)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dados Bancários */}
            <Card>
              <CardHeader>
                <CardTitle>🏦 Dados Bancários</CardTitle>
                <CardDescription>
                  Informações para transferências
                  {userRole === "player" && !showSensitiveData && (
                    <Badge variant="secondary" className="ml-2">
                      <Shield className="w-3 h-3 mr-1" />
                      Oculto
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Documento (CPF)</Label>
                  {editing ? (
                    <Input
                      value={editForm.document}
                      onChange={(e) => handleChange("document", e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  ) : (
                    <p className="p-2 bg-secondary/20 rounded">
                      {showSensitiveData || userRole !== "player"
                        ? userData?.document || "Não informado"
                        : maskDocument(userData?.document)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  {editing ? (
                    <Input
                      value={editForm.pix_key}
                      onChange={(e) => handleChange("pix_key", e.target.value)}
                      placeholder="seu@email.com ou CPF"
                    />
                  ) : (
                    <p className="p-2 bg-secondary/20 rounded">
                      {userData?.pix_key || "Não informado"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Banco</Label>
                  {editing ? (
                    <Input
                      value={editForm.bank_name}
                      onChange={(e) =>
                        handleChange("bank_name", e.target.value)
                      }
                      placeholder="Nome do banco"
                    />
                  ) : (
                    <p className="p-2 bg-secondary/20 rounded">
                      {userData?.bank_name || "Não informado"}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    {editing ? (
                      <Input
                        value={editForm.bank_agency}
                        onChange={(e) =>
                          handleChange("bank_agency", e.target.value)
                        }
                        placeholder="0000"
                      />
                    ) : (
                      <p className="p-2 bg-secondary/20 rounded">
                        {userData?.bank_agency || "Não informado"}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Conta</Label>
                    {editing ? (
                      <Input
                        value={editForm.bank_account}
                        onChange={(e) =>
                          handleChange("bank_account", e.target.value)
                        }
                        placeholder="00000-0"
                      />
                    ) : (
                      <p className="p-2 bg-secondary/20 rounded">
                        {showSensitiveData || userRole !== "player"
                          ? userData?.bank_account || "Não informado"
                          : maskBankAccount(userData?.bank_account)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>

              {editing && (
                <div className="px-6 pb-6">
                  <Button onClick={handleSave} className="gradient-gold w-full">
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Observações do Gestor */}
          {(userRole === "admin" || userRole === "manager") && (
            <Card>
              <CardHeader>
                <CardTitle>📝 Observações do Gestor</CardTitle>
                <CardDescription>
                  Anotações internas sobre o jogador
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={userData?.manager_notes || ""}
                  placeholder="Adicione observações sobre o jogador..."
                  rows={4}
                  className="w-full"
                />
                <Button className="mt-3 gradient-gold">
                  Atualizar Observações
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="financeiro" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <div className="ml-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Makeup Atual
                      </p>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AlertCircle className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">
                              <strong>Makeup:</strong> Valor devido ao time
                              quando o jogador está negativo após um saque.
                              Representa o saldo a ser compensado em futuras
                              sessões positivas.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(userData?.makeup || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      P&L Total
                    </p>
                    <p className="text-2xl font-bold text-green-500">
                      {formatCurrency(0)} {/* TODO: Calcular P&L real */}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-primary" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Membro desde
                    </p>
                    <p className="text-lg font-bold">
                      {formatDate(userData?.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permissoes" className="mt-6">
          <PlayerPermissions
            userId={user.id}
            userName={userData?.full_name || user.username}
            userRole={userRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MeuPerfil;
