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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Shield,
  DollarSign,
  Edit,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import PlayerPermissions from "./PlayerPermissions";
import BankrollChart from "./BankrollChart";
import CalendarTracker from "./CalendarTracker";
import { toast } from "sonner";

const AdminPlayerProfile = ({ player, isOpen, onClose, onSave }) => {
  const [playerData, setPlayerData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

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
    makeup: "",
    manager_notes: "",
    reta_id: "",
  });

  useEffect(() => {
    if (player && isOpen) {
      fetchPlayerDetails();
      setEditForm({
        full_name: player.full_name || "",
        email: player.email || "",
        phone: player.phone || "",
        document: player.document || "",
        birth_date: player.birth_date || "",
        pix_key: player.pix_key || "",
        bank_name: player.bank_name || "",
        bank_agency: player.bank_agency || "",
        bank_account: player.bank_account || "",
        makeup: player.makeup || "",
        manager_notes: player.manager_notes || "",
        reta_id: player.reta_id || "",
      });
    }
  }, [player, isOpen]);

  const fetchPlayerDetails = async () => {
    if (!player?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/users/${player.id}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPlayerData(data.user);
      } else {
        toast.error("Erro ao carregar dados do jogador");
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/${player.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        toast.success("✅ Perfil atualizado com sucesso!");
        setEditMode(false);
        fetchPlayerDetails();
        onSave && onSave();
      } else {
        const error = await response.json();
        toast.error("❌ Erro ao salvar", {
          description: error.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("❌ Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  if (!player) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold">👑 Perfil Administrativo</h3>
              <p className="text-sm text-muted-foreground">
                {player.full_name} (@{player.username})
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSensitive(!showSensitive)}
              >
                {showSensitive ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {showSensitive ? "Ocultar" : "Mostrar"} Dados Sensíveis
              </Button>
              <Button
                variant={editMode ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? (
                  <Save className="w-4 h-4" />
                ) : (
                  <Edit className="w-4 h-4" />
                )}
                {editMode ? "Salvar" : "Editar"}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Dados
              </TabsTrigger>
              <TabsTrigger
                value="financial"
                className="flex items-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                Financeiro
              </TabsTrigger>
              <TabsTrigger
                value="permissions"
                className="flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Permissões
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Atividade
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <Edit className="w-4 h-4" />
                Observações
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto space-y-4">
              <TabsContent value="overview" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        👤 Informações Pessoais
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label>Nome Completo</Label>
                          {editMode ? (
                            <Input
                              value={editForm.full_name}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  full_name: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm font-medium">
                              {playerData?.full_name}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Email</Label>
                          {editMode ? (
                            <Input
                              type="email"
                              value={editForm.email}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  email: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm font-medium">
                              {playerData?.email}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Telefone</Label>
                          {editMode ? (
                            <Input
                              value={editForm.phone}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  phone: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <p className="text-sm font-medium">
                              {playerData?.phone || "—"}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        🏦 Dados Bancários
                      </CardTitle>
                      <CardDescription>
                        {showSensitive
                          ? "Dados descriptografados"
                          : "Dados protegidos"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {showSensitive ? (
                        <div className="space-y-4">
                          <div>
                            <Label>PIX</Label>
                            {editMode ? (
                              <Input
                                value={editForm.pix_key}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    pix_key: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <p className="text-sm font-medium">
                                {playerData?.pix_key || "—"}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label>Banco</Label>
                            {editMode ? (
                              <Input
                                value={editForm.bank_name}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    bank_name: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <p className="text-sm font-medium">
                                {playerData?.bank_name || "—"}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label>Conta</Label>
                            {editMode ? (
                              <Input
                                value={editForm.bank_account}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    bank_account: e.target.value,
                                  })
                                }
                              />
                            ) : (
                              <p className="text-sm font-medium">
                                {playerData?.bank_account || "—"}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="w-12 h-12 mx-auto mb-4" />
                          <p>Dados protegidos</p>
                          <p className="text-xs">
                            Clique em "Mostrar Dados Sensíveis" para ver
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="financial" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>💰 Resumo Financeiro</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <div className="text-sm text-muted-foreground mb-2">
                            Saldo Total
                          </div>
                          <div className="text-xl font-bold text-green-600">
                            {formatCurrency(player.total_balance)}
                          </div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <div className="text-sm text-muted-foreground mb-2">
                            P&L Total
                          </div>
                          <div
                            className={`text-xl font-bold ${
                              (player.total_balance || 0) -
                                (player.total_investment || 0) >=
                              0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(
                              (player.total_balance || 0) -
                                (player.total_investment || 0)
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>📈 Evolução do Bankroll</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <BankrollChart playerId={player.id} />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="permissions" className="mt-0">
                <PlayerPermissions
                  userId={player.id}
                  userName={player.full_name}
                  userRole="admin"
                />
              </TabsContent>

              <TabsContent value="activity" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>📅 Calendário de Atividade</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CalendarTracker playerId={player.id} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>🔄 Histórico Recente</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Último login:</span>
                          <span className="font-medium">
                            {playerData?.last_login
                              ? new Date(
                                  playerData.last_login
                                ).toLocaleDateString("pt-BR")
                              : "Nunca"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Conta criada:</span>
                          <span className="font-medium">
                            {new Date(player.created_at).toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Última atualização:</span>
                          <span className="font-medium">
                            {new Date(player.updated_at).toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="notes" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle>📝 Observações do Gestor</CardTitle>
                    <CardDescription>
                      Notas privadas visíveis apenas para admins e managers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label>Makeup Atual</Label>
                        {editMode ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.makeup}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                makeup: e.target.value,
                              })
                            }
                            placeholder="0.00"
                          />
                        ) : (
                          <p className="text-sm font-medium">
                            {formatCurrency(player.makeup)}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Observações do Manager</Label>
                        {editMode ? (
                          <Textarea
                            value={editForm.manager_notes}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                manager_notes: e.target.value,
                              })
                            }
                            placeholder="Observações privadas sobre o jogador..."
                            rows={6}
                          />
                        ) : (
                          <div className="min-h-[120px] p-3 border border-border rounded-md bg-muted/30">
                            <p className="text-sm whitespace-pre-wrap">
                              {player.manager_notes ||
                                "Nenhuma observação registrada"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {editMode && (
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "💾 Salvar Alterações"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPlayerProfile;
