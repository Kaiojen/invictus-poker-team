import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crown,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  LogOut,
  FileSpreadsheet,
  BarChart3,
  Settings,
  Database,
  FileText,
  Bell,
  Menu,
} from "lucide-react";
import PlanilhaPage from "./PlanilhaPage";
import TeamProfitChart from "./TeamProfitChart";
import RetasManagement from "./RetasManagement";
import MeuPerfil from "./MeuPerfil";
import GestaoAuditoria from "./GestaoAuditoria";
import AuditoriaEnhanced from "./AuditoriaEnhanced";
import AlertasAutomatizados from "./AlertasAutomatizados";
import PlayerManagement from "./PlayerManagement";
import RetaDashboard from "./RetaDashboard";
import VerificarPerfil from "./VerificarPerfil";
import BackupManagement from "./BackupManagement";
import ReportManagement from "./ReportManagement";
import NotificationCenter from "./NotificationCenter";
import NotificationBell from "./NotificationBell";
import PlayerDashboardImproved from "./PlayerDashboardImproved";
import PlayerDashboardEnhanced from "./PlayerDashboardEnhanced";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useSSE } from "../hooks/useSSE";

const Dashboard = ({ user, onLogout }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [pendingReloads, setPendingReloads] = useState([]);
  const [loadingReloads, setLoadingReloads] = useState(false);
  const [gestaoInnerTab, setGestaoInnerTab] = useState("dashboard");

  // SSE para atualizações em tempo real
  const { isConnected, addEventListener } = useSSE();

  useEffect(() => {
    fetchDashboardData();
    if (user.role === "admin" || user.role === "manager") {
      fetchPendingReloads();
    }
  }, [user]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const endpoint =
        user.role === "admin" || user.role === "manager"
          ? "/api/dashboard/manager"
          : "/api/dashboard/player";

      const response = await fetch(endpoint, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  const fetchPendingReloads = useCallback(async () => {
    try {
      setLoadingReloads(true);
      // Backend espera enums em minúsculas; usar lowercase evita 400 e inconsistências
      const res = await fetch("/api/reload_requests/?status=pending", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPendingReloads(data.reload_requests || []);
      }
    } catch (e) {
      console.error("Erro ao carregar solicitações pendentes", e);
    } finally {
      setLoadingReloads(false);
    }
  }, []);

  // Auto-refresh leve para manter cards e pendências atualizados quase em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
      if (user.role === "admin" || user.role === "manager") {
        fetchPendingReloads();
      }
    }, 60000); // 60s
    return () => clearInterval(interval);
  }, [user]);

  // Configurar listeners SSE para atualizações em tempo real
  useEffect(() => {
    if (!addEventListener) return;

    const removeReloadCreatedListener = addEventListener(
      "reload_created",
      (data) => {
        console.log("Dashboard: Novo reload criado via SSE", data);
        // Atualizar dados automaticamente
        fetchDashboardData();
        if (user.role === "admin" || user.role === "manager") {
          fetchPendingReloads();
        }
      }
    );

    const removeReloadApprovedListener = addEventListener(
      "reload_approved",
      (data) => {
        console.log("Dashboard: Reload aprovado via SSE", data);
        fetchDashboardData();
        fetchPendingReloads();
      }
    );

    const removeDashboardRefreshListener = addEventListener(
      "dashboard_refresh",
      () => {
        console.log("Dashboard: Refresh solicitado via SSE");
        fetchDashboardData();
        if (user.role === "admin" || user.role === "manager") {
          fetchPendingReloads();
        }
      }
    );

    const removeBalanceUpdatedListener = addEventListener(
      "balance_updated",
      (data) => {
        console.log("Dashboard: Saldo atualizado via SSE", data);
        // Refresh mais suave apenas se for o usuário atual
        if (
          user.role === "player" ||
          user.role === "admin" ||
          user.role === "manager"
        ) {
          setTimeout(() => fetchDashboardData(), 1000); // Delay de 1s para permitir propagação
        }
      }
    );

    // Cleanup dos listeners
    return () => {
      removeReloadCreatedListener?.();
      removeReloadApprovedListener?.();
      removeDashboardRefreshListener?.();
      removeBalanceUpdatedListener?.();
    };
  }, [addEventListener, user, fetchDashboardData, fetchPendingReloads]);

  const approveReload = async (id) => {
    try {
      const res = await fetch(`/api/reload_requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ manager_notes: "Aprovado via ações rápidas" }),
      });
      if (res.ok) {
        toast.success("Solicitação aprovada");
        fetchPendingReloads();
        fetchDashboardData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao aprovar");
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  };

  const rejectReload = async (id) => {
    try {
      const reason = window.prompt(
        "Motivo da rejeição:",
        "Dados insuficientes"
      );
      if (reason === null) return;
      const res = await fetch(`/api/reload_requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ manager_notes: reason || "Não especificado" }),
      });
      if (res.ok) {
        toast.success("Solicitação rejeitada");
        fetchPendingReloads();
        fetchDashboardData();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao rejeitar");
      }
    } catch (e) {
      toast.error("Erro de conexão");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      onLogout();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "complete":
        return "status-complete";
      case "pending":
        return "status-pending";
      case "critical":
        return "status-critical";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "critical":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card mobile-sticky-header">
        <div className="container mx-auto px-4 py-4 relative flex justify-center sm:justify-between items-center">
          {/* Mobile side menu trigger */}
          {(user.role === "admin" || user.role === "manager") && (
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden absolute left-2"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <div className="p-2 space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => setActiveTab("dashboard")}
                  >
                    Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("planilha")}
                  >
                    Planilha
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("gestao")}
                  >
                    Gestão
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("auditoria")}
                  >
                    Auditoria
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("relatorios")}
                  >
                    Relatórios
                  </Button>
                  {user.role === "admin" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab("backup")}
                    >
                      Backup
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("notificacoes")}
                  >
                    Notificações
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("configuracoes")}
                  >
                    Perfil
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden">
              <img
                src="/LOGO_NOVO.png"
                alt="Invictus Poker Team"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-2xl font-bold gradient-gold-text">
                Invictus Poker Team
              </h1>
              <p className="text-sm text-muted-foreground">Sistema de Gestão</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-4">
            <NotificationBell
              onOpenCenter={() => setActiveTab("notificacoes")}
            />

            {/* Indicador de conexão SSE */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span className="text-xs text-muted-foreground">
                {isConnected ? "Tempo real" : "Desconectado"}
              </span>
            </div>

            <div className="text-right">
              <p className="font-medium text-foreground">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {user.role === "admin"
                  ? "Administrador Sistema"
                  : user.role === "manager"
                  ? "Gerente"
                  : user.role === "player"
                  ? "Jogador"
                  : user.role}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-border text-foreground hover:bg-secondary"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 md:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Navegação Mobile Otimizada */}
          <div className="mobile-tabs overflow-x-auto mb-6">
            <TabsList
              className={`grid w-full min-w-max ${
                user.role === "admin"
                  ? "grid-cols-9"
                  : user.role === "manager"
                  ? "grid-cols-8"
                  : "grid-cols-4"
              } md:min-w-0`}
            >
              <TabsTrigger
                value="dashboard"
                className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden text-xs">Home</span>
              </TabsTrigger>
              <TabsTrigger
                value="planilha"
                className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Planilha</span>
                <span className="sm:hidden text-xs">📊</span>
              </TabsTrigger>
              {(user.role === "admin" || user.role === "manager") && (
                <TabsTrigger
                  value="gestao"
                  className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Gestão</span>
                  <span className="sm:hidden text-xs">👥</span>
                </TabsTrigger>
              )}
              {(user.role === "admin" || user.role === "manager") && (
                <TabsTrigger
                  value="auditoria"
                  className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Auditoria</span>
                  <span className="sm:hidden text-xs">✅</span>
                </TabsTrigger>
              )}
              {(user.role === "admin" || user.role === "manager") && (
                <TabsTrigger
                  value="alertas"
                  className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="hidden sm:inline">Alertas</span>
                  <span className="sm:hidden text-xs">⚠️</span>
                </TabsTrigger>
              )}
              {(user.role === "admin" || user.role === "manager") && (
                <TabsTrigger
                  value="relatorios"
                  className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Relatórios</span>
                  <span className="sm:hidden text-xs">📄</span>
                </TabsTrigger>
              )}
              {user.role === "admin" && (
                <TabsTrigger
                  value="backup"
                  className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
                >
                  <Database className="w-4 h-4" />
                  <span className="hidden sm:inline">Backup</span>
                  <span className="sm:hidden text-xs">💾</span>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="notificacoes"
                className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notificações</span>
                <span className="sm:hidden text-xs">🔔</span>
              </TabsTrigger>
              <TabsTrigger
                value="configuracoes"
                className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {user.role === "admin" ? "Verificar Perfil" : "Meu Perfil"}
                </span>
                <span className="sm:hidden text-xs">⚙️</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-6">
            {/* Dashboard do Gestor */}
            {(user.role === "admin" || user.role === "manager") &&
              dashboardData && (
                <div className="space-y-6">
                  {/* Hero central com nome do time */}
                  <div className="text-center py-4">
                    <h2 className="text-3xl sm:text-4xl font-extrabold gradient-gold-text">
                      Invictus Poker Team
                    </h2>
                    <p className="text-sm sm:text-base text-muted-foreground mt-1">
                      Mente fria, jogo afiado. A vitória é só o começo.
                    </p>
                  </div>

                  {/* Ações rápidas para Admin/Manager */}
                  <Card>
                    <CardHeader>
                      <CardTitle>⚡ Ações Rápidas</CardTitle>
                      <CardDescription>
                        Atalhos para aprovações e pendências
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab("gestao")}
                        >
                          Ir para Gestão
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab("auditoria")}
                        >
                          Ver Auditoria
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setActiveTab("notificacoes")}
                        >
                          Notificações
                        </Button>
                      </div>

                      {(user.role === "admin" || user.role === "manager") && (
                        <div className="mt-4">
                          <p className="text-sm text-muted-foreground mb-2">
                            Solicitações de reload pendentes:{" "}
                            {loadingReloads ? "..." : pendingReloads.length}
                          </p>
                          {pendingReloads.slice(0, 3).map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between border border-border rounded-md p-2 mb-2"
                            >
                              <div className="text-sm">
                                <span className="font-medium">
                                  @{r.user_name}
                                </span>{" "}
                                • {r.platform_name} • $ {r.amount.toFixed(2)}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => approveReload(r.id)}
                                >
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => rejectReload(r.id)}
                                >
                                  Rejeitar
                                </Button>
                              </div>
                            </div>
                          ))}
                          {pendingReloads.length > 3 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveTab("auditoria")}
                            >
                              Ver todas pendências
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Total de Jogadores
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold invictus-gold">
                          {dashboardData.statistics?.total_players || 0}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Solicitações Pendentes
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold status-pending">
                          {dashboardData.statistics?.pending_requests || 0}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Jogadores com Pendências
                        </CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold status-critical">
                          {dashboardData.statistics?.players_with_issues || 0}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Gráfico de lucro do time */}
                  <TeamProfitChart days={30} />

                  {/* Lista de Jogadores */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Jogadores</CardTitle>
                      <CardDescription>
                        Status e pendências dos jogadores
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <Input
                          placeholder="Buscar por nome ou @username"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="max-w-sm"
                        />
                        <Select
                          value={filterStatus}
                          onValueChange={setFilterStatus}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="complete">Verde (OK)</SelectItem>
                            <SelectItem value="pending">
                              Amarelo (Pendente)
                            </SelectItem>
                            <SelectItem value="critical">
                              Vermelho (Crítico)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(() => {
                        const players = (dashboardData.players || []).filter(
                          (p) => {
                            const matchesSearch = `${p.full_name} ${p.username}`
                              .toLowerCase()
                              .includes(searchTerm.toLowerCase());
                            const matchesStatus =
                              filterStatus === "all" ||
                              p.status === filterStatus;
                            return matchesSearch && matchesStatus;
                          }
                        );
                        return (
                          <div className="space-y-3">
                            {players.map((player) => (
                              <div
                                key={player.id}
                                className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-secondary/50 transition-colors"
                              >
                                <div className="flex items-center space-x-3">
                                  <div
                                    className={`flex items-center space-x-2 ${getStatusColor(
                                      player.status
                                    )}`}
                                  >
                                    {getStatusIcon(player.status)}
                                    <span className="font-medium">
                                      {player.full_name}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    @{player.username}
                                  </Badge>
                                </div>
                                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                  {player.incomplete_data_count > 0 && (
                                    <span>
                                      {player.incomplete_data_count} dados
                                      pendentes
                                    </span>
                                  )}
                                  {player.pending_requests_count > 0 && (
                                    <span>
                                      {player.pending_requests_count}{" "}
                                      solicitações
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      sessionStorage.setItem(
                                        "selectedPlayerId",
                                        String(player.id)
                                      );
                                      setActiveTab("planilha");
                                    }}
                                  >
                                    Planilha
                                  </Button>
                                  {(user.role === "admin" ||
                                    user.role === "manager") && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        // Deep link direto para Verificar Perfil (aba Configurações)
                                        sessionStorage.setItem(
                                          "playerSearchQuery",
                                          player.username
                                        );
                                        sessionStorage.setItem(
                                          "openProfileUserId",
                                          String(player.id)
                                        );
                                        setActiveTab("configuracoes");
                                      }}
                                    >
                                      Perfil
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              )}

            {/* Dashboard do Jogador */}
            {user.role === "player" && <PlayerDashboardEnhanced user={user} />}

            {/* Dashboard antigo do jogador (backup) */}
            {false && user.role === "player" && dashboardData && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Meu Status</CardTitle>
                    <CardDescription>
                      Situação atual da sua conta
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`flex items-center space-x-2 ${getStatusColor(
                        dashboardData.status
                      )}`}
                    >
                      {getStatusIcon(dashboardData.status)}
                      <span className="font-medium capitalize">
                        {dashboardData.status === "complete" && "Tudo em ordem"}
                        {dashboardData.status === "pending" &&
                          "Dados pendentes"}
                        {dashboardData.status === "critical" &&
                          "Ação necessária"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Contas */}
                {dashboardData.accounts &&
                  dashboardData.accounts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Minhas Contas</CardTitle>
                        <CardDescription>Saldos por plataforma</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {dashboardData.accounts.map((account) => (
                            <div
                              key={account.id}
                              className="flex justify-between items-center p-3 border border-border rounded-lg"
                            >
                              <div>
                                <p className="font-medium">
                                  {account.platform_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {account.account_name}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold invictus-gold">
                                  $ {account.current_balance.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Resumo Financeiro */}
                {dashboardData.financial_summary && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Resumo Financeiro (30 dias)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Saldo Total
                          </p>
                          <p className="text-xl font-bold invictus-gold">
                            ${" "}
                            {dashboardData.financial_summary.current_total_balance.toFixed(
                              2
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Resultado Líquido
                          </p>
                          <p
                            className={`text-xl font-bold ${
                              dashboardData.financial_summary.net_result >= 0
                                ? "status-complete"
                                : "status-critical"
                            }`}
                          >
                            ${" "}
                            {dashboardData.financial_summary.net_result.toFixed(
                              2
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="planilha" className="mt-6">
            <PlanilhaPage user={user} />
          </TabsContent>

          {(user.role === "admin" || user.role === "manager") && (
            <TabsContent value="gestao" className="mt-6">
              <Tabs
                value={gestaoInnerTab}
                onValueChange={setGestaoInnerTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dashboard">📊 Dashboard</TabsTrigger>
                  <TabsTrigger value="retas">🎯 Retas</TabsTrigger>
                  <TabsTrigger value="jogadores">👥 Jogadores</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="mt-6">
                  <RetaDashboard />
                </TabsContent>

                <TabsContent value="retas" className="mt-6">
                  <RetasManagement userRole={user.role} />
                </TabsContent>

                <TabsContent value="jogadores" className="mt-6">
                  <PlayerManagement userRole={user.role} />
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}

          {(user.role === "admin" || user.role === "manager") && (
            <TabsContent value="auditoria" className="mt-6">
              <AuditoriaEnhanced user={user} />
            </TabsContent>
          )}

          {(user.role === "admin" || user.role === "manager") && (
            <TabsContent value="alertas" className="mt-6">
              <AlertasAutomatizados user={user} />
            </TabsContent>
          )}

          {(user.role === "admin" || user.role === "manager") && (
            <TabsContent value="relatorios" className="mt-6">
              <ReportManagement user={user} />
            </TabsContent>
          )}

          {user.role === "admin" && (
            <TabsContent value="backup" className="mt-6">
              <BackupManagement userRole={user.role} />
            </TabsContent>
          )}

          <TabsContent value="notificacoes" className="mt-6">
            <NotificationCenter user={user} />
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-6">
            {user.role === "admin" ? (
              <VerificarPerfil userRole={user.role} />
            ) : (
              <MeuPerfil user={user} userRole={user.role} />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
