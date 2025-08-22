import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  Users,
  CheckCircle,
  X,
  Eye,
  Download,
  Clock,
  AlertTriangle,
  UserCheck,
  UserX,
  Calendar,
  Filter,
  BarChart3,
  FileText,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const GestaoAuditoria = ({ user }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filters, setFilters] = useState({
    action: "all",
    entity_type: "all",
    days_back: 7,
  });
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchPendingUsers();
    fetchAuditLogs();
    fetchAuditStats();
  }, []);

  useEffect(() => {
    fetchAuditLogs();
    fetchAuditStats();
  }, [filters]);

  const fetchPendingUsers = async () => {
    try {
      const response = await fetch("/api/registration/pending", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPendingUsers(data.pending_users || []);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários pendentes:", error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.action && filters.action !== "all")
        params.append("action", filters.action);
      if (filters.entity_type && filters.entity_type !== "all")
        params.append("entity_type", filters.entity_type);
      if (filters.days_back) params.append("days_back", filters.days_back);

      const response = await fetch(`/api/audit/logs?${params}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Erro ao carregar logs de auditoria:", error);
    }
  };

  const fetchAuditStats = async () => {
    try {
      const response = await fetch(
        `/api/audit/stats?days_back=${filters.days_back}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAuditStats(data);
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId, retaId = 1) => {
    try {
      const response = await fetch(`/api/registration/approve/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reta_id: retaId,
          manager_notes: "Aprovado via dashboard de gestão",
        }),
      });

      if (response.ok) {
        toast.success("Usuário aprovado com sucesso!");
        fetchPendingUsers();
        fetchAuditLogs();

        // ✅ ATUALIZAR CONTADOR NO DASHBOARD PAI
        window.dispatchEvent(new CustomEvent("refresh-pending-registrations"));
      } else {
        const data = await response.json();
        toast.error(data.error || "Erro ao aprovar usuário");
      }
    } catch (error) {
      toast.error("Erro de conexão");
    }
  };

  const rejectUser = async (userId) => {
    try {
      const response = await fetch(`/api/registration/reject/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          reason: rejectionReason || "Não especificado",
        }),
      });

      if (response.ok) {
        toast.success("Cadastro rejeitado");
        fetchPendingUsers();
        fetchAuditLogs();
        setRejectionReason("");

        // ✅ ATUALIZAR CONTADOR NO DASHBOARD PAI
        window.dispatchEvent(new CustomEvent("refresh-pending-registrations"));
      } else {
        const data = await response.json();
        toast.error(data.error || "Erro ao rejeitar cadastro");
      }
    } catch (error) {
      toast.error("Erro de conexão");
    }
  };

  const exportAuditLogs = async () => {
    try {
      const response = await fetch(
        `/api/audit/export?days_back=${filters.days_back}&format=csv`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const contentDisposition = response.headers.get("content-disposition");
        const filename = contentDisposition
          ? contentDisposition.split("filename=")[1].replace(/"/g, "")
          : `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Logs exportados em CSV com sucesso!");
      }
    } catch (error) {
      toast.error("Erro ao exportar logs CSV");
    }
  };

  // ✅ EXPORT PDF (mesma qualidade dos outros relatórios)
  const exportAuditLogsPDF = async () => {
    try {
      toast.info("📄 Gerando PDF...", {
        description: "Aguarde enquanto preparamos o relatório",
      });

      const response = await fetch(
        `/api/audit/export?days_back=${filters.days_back}&format=pdf`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const contentDisposition = response.headers.get("content-disposition");
        const filename = contentDisposition
          ? contentDisposition.split("filename=")[1].replace(/"/g, "")
          : `audit_logs_${new Date().toISOString().slice(0, 10)}.pdf`;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("✅ Logs exportados em PDF com sucesso!");
      } else {
        // PDF com erro, fallback para CSV
        toast.warning("⚠️ PDF temporariamente indisponível", {
          description: "Usando export CSV como alternativa",
        });
        exportAuditLogs();
      }
    } catch (error) {
      console.error("Erro ao exportar logs PDF:", error);
      toast.error("❌ Erro ao exportar PDF", {
        description: "Tente usar o export CSV",
      });
    }
  };

  const getActionBadgeColor = (action) => {
    // ✅ CORES PADRONIZADAS COM O SISTEMA (usando classes do sistema)
    if (action.includes("created") || action.includes("registration"))
      return "bg-green-600 hover:bg-green-700";
    if (
      action.includes("updated") ||
      action.includes("balance") ||
      action.includes("manual")
    )
      return "bg-blue-600 hover:bg-blue-700";
    if (action.includes("deleted") || action.includes("rejected"))
      return "bg-red-600 hover:bg-red-700";
    if (action.includes("approved"))
      return "bg-emerald-600 hover:bg-emerald-700";
    if (action.includes("reload") || action.includes("payback"))
      return "bg-orange-600 hover:bg-orange-700";
    if (action.includes("withdrawal"))
      return "bg-purple-600 hover:bg-purple-700";
    return "bg-slate-600 hover:bg-slate-700";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("pt-BR");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            Gestão & Auditoria
          </h2>
        </div>
        <Shield className="w-8 h-8 text-yellow-500" />
      </div>

      <Tabs defaultValue="aprovacoes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="aprovacoes" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Aprovações
            {pendingUsers.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingUsers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Logs de Auditoria
          </TabsTrigger>
          <TabsTrigger value="estatisticas" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Estatísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aprovacoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Cadastros Pendentes de Aprovação
              </CardTitle>
              <CardDescription>
                {pendingUsers.length === 0
                  ? "Nenhum cadastro pendente no momento"
                  : `${pendingUsers.length} cadastro(s) aguardando aprovação`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>Todos os cadastros foram processados!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingUsers.map((pendingUser) => (
                    <Card key={pendingUser.id} className="border-yellow-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-lg">
                                {pendingUser.full_name}
                              </h4>
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                {pendingUser.days_waiting} dias aguardando
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                              <div>
                                <strong>Username:</strong>{" "}
                                {pendingUser.username}
                              </div>
                              <div>
                                <strong>Email:</strong> {pendingUser.email}
                              </div>
                              <div>
                                <strong>Telefone:</strong> {pendingUser.phone}
                              </div>
                              <div>
                                <strong>CPF:</strong> {pendingUser.document}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <strong>Cadastrado em:</strong>{" "}
                              {formatDate(pendingUser.created_at)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => approveUser(pendingUser.id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Aprovar
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                  <UserX className="w-4 h-4 mr-2" />
                                  Rejeitar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Rejeitar Cadastro
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja rejeitar o cadastro
                                    de {pendingUser.full_name}? Esta ação não
                                    pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="my-4">
                                  <Label htmlFor="reason">
                                    Motivo da rejeição
                                  </Label>
                                  <Textarea
                                    id="reason"
                                    value={rejectionReason}
                                    onChange={(e) =>
                                      setRejectionReason(e.target.value)
                                    }
                                    placeholder="Digite o motivo da rejeição..."
                                    className="mt-2"
                                  />
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => rejectUser(pendingUser.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Rejeitar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Logs de Auditoria
                </div>
                <div className="flex gap-2">
                  <Button onClick={exportAuditLogs} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                  <Button onClick={exportAuditLogsPDF} variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Histórico completo de ações no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros */}
              <div className="flex gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <Label htmlFor="action-filter">Filtrar por ação</Label>
                  <Input
                    id="action-filter"
                    placeholder="Ex: user_created, balance_updated..."
                    value={filters.action}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        action: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="entity-filter">Tipo de entidade</Label>
                  <Select
                    value={filters.entity_type}
                    onValueChange={(value) =>
                      setFilters((prev) => ({ ...prev, entity_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="User">Usuário</SelectItem>
                      <SelectItem value="Account">Conta</SelectItem>
                      <SelectItem value="ReloadRequest">Reload</SelectItem>
                      <SelectItem value="Transaction">Transação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label htmlFor="days-filter">Últimos dias</Label>
                  <Select
                    value={filters.days_back.toString()}
                    onValueChange={(value) =>
                      setFilters((prev) => ({
                        ...prev,
                        days_back: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 dia</SelectItem>
                      <SelectItem value="7">7 dias</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lista de Logs */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge
                          className={`${getActionBadgeColor(
                            log.action
                          )} text-white`}
                        >
                          {log.action}
                        </Badge>
                        <span className="font-medium">{log.entity_type}</span>
                        <span className="text-sm text-muted-foreground">
                          por {log.user_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {formatDate(log.created_at)}
                        </span>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Detalhes do Log</DialogTitle>
                              <DialogDescription>
                                Informações completas sobre a ação realizada
                              </DialogDescription>
                            </DialogHeader>
                            {selectedLog && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Ação</Label>
                                    <p className="font-mono text-sm">
                                      {selectedLog.action}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>Usuário</Label>
                                    <p>{selectedLog.user_name}</p>
                                  </div>
                                  <div>
                                    <Label>Entidade</Label>
                                    <p>
                                      {selectedLog.entity_type} #
                                      {selectedLog.entity_id}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>Data/Hora</Label>
                                    <p>{formatDate(selectedLog.created_at)}</p>
                                  </div>
                                </div>
                                {selectedLog.old_values && (
                                  <div>
                                    <Label>Valores Antigos</Label>
                                    <pre className="text-xs bg-muted/30 border border-border p-2 rounded mt-1 overflow-auto">
                                      {JSON.stringify(
                                        JSON.parse(selectedLog.old_values),
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </div>
                                )}
                                {selectedLog.new_values && (
                                  <div>
                                    <Label>Valores Novos</Label>
                                    <pre className="text-xs bg-muted/30 border border-border p-2 rounded mt-1 overflow-auto">
                                      {JSON.stringify(
                                        JSON.parse(selectedLog.new_values),
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>IP</Label>
                                    <p className="font-mono text-sm">
                                      {selectedLog.ip_address}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>User Agent</Label>
                                    <p className="text-xs truncate">
                                      {selectedLog.user_agent}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estatisticas" className="space-y-4">
          {auditStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Logs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {auditStats.total_logs}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Últimos {auditStats.period_days} dias
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Ações Mais Comuns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {auditStats.actions.slice(0, 3).map((action, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="truncate">{action.action}</span>
                        <span className="font-medium">{action.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Entidades Mais Afetadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {auditStats.entities.slice(0, 3).map((entity, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{entity.entity_type}</span>
                        <span className="font-medium">{entity.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Usuários Mais Ativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {auditStats.active_users.slice(0, 3).map((user, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="truncate">{user.user_name}</span>
                        <span className="font-medium">
                          {user.actions_count}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GestaoAuditoria;
