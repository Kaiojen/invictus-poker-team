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
// import PlayerManagement from "./PlayerManagement";
import RetaDashboard from "./RetaDashboard";
import VerificarPerfil from "./VerificarPerfil";
import BackupManagement from "./BackupManagement";
import ReportManagement from "./ReportManagement";
import NotificationCenter from "./NotificationCenter";
import { toast } from "sonner";
import NotificationBell from "./NotificationBell";
import PlayerDashboardImproved from "./PlayerDashboardImproved";
import PlayerDashboardEnhanced from "./PlayerDashboardEnhanced";
import ApprovalAlert from "./ApprovalAlert";
import ReloadRequestModal from "./ReloadRequestModal";
import WithdrawalRequestModal from "./WithdrawalRequestModal";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
  const [processingAction, setProcessingAction] = useState(null);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);

  // ✅ ESTADOS PARA MODAIS DE SOLICITAÇÃO
  const [showReloadModal, setShowReloadModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

  // SSE para atualizações em tempo real
  const { isConnected, addEventListener } = useSSE();

  useEffect(() => {
    fetchDashboardData();
    if (user.role === "admin" || user.role === "manager") {
      fetchPendingReloads();
      fetchPendingRegistrations();
    }

    // ✅ CONFIGURAR SSE LISTENERS PARA ATUALIZAÇÕES EM TEMPO REAL
    if (
      addEventListener &&
      (user.role === "admin" || user.role === "manager")
    ) {
      const removeReloadCreatedListener = addEventListener(
        "reload_created",
        (data) => {
          console.log("Dashboard: Novo reload criado via SSE", data);
          toast.info(`Nova solicitação de reload de ${data.username}`, {
            description: `$${data.amount} em ${data.platform_name}`,
            action: {
              label: "Ver",
              onClick: () => setActiveTab("gestao"),
            },
          });
          fetchPendingReloads();
          fetchDashboardData();
        }
      );

      const removeWithdrawalCreatedListener = addEventListener(
        "withdrawal_created",
        (data) => {
          console.log("Dashboard: Novo saque criado via SSE", data);
          toast.info(`Nova solicitação de saque de ${data.username}`, {
            description: `$${data.amount} de ${data.platform_name}`,
            action: {
              label: "Ver",
              onClick: () => setActiveTab("gestao"),
            },
          });
          fetchDashboardData();
        }
      );

      const removeReloadApprovedListener = addEventListener(
        "reload_approved",
        (data) => {
          console.log("Dashboard: Reload aprovado via SSE", data);
          fetchPendingReloads();
          fetchDashboardData();
        }
      );

      // Cleanup dos listeners
      return () => {
        removeReloadCreatedListener?.();
        removeWithdrawalCreatedListener?.();
        removeReloadApprovedListener?.();
      };
    }

    // Escutar eventos de navegação customizados
    const handleNavigation = (event) => {
      const { tab, playerId } = event.detail;
      if (tab === "planilha") {
        setActiveTab("planilha");
        if (playerId) {
          sessionStorage.setItem("selectedPlayerId", String(playerId));
        }
      }
    };

    // ✅ ESCUTAR EVENTO DE NAVEGAÇÃO PARA APROVAÇÕES
    const handleApprovalNavigation = () => {
      // Navegar para área de aprovações
      setActiveTab("backup-auditoria");
      setTimeout(() => {
        const auditoriaTab = document.querySelector('[value="auditoria"]');
        if (auditoriaTab) auditoriaTab.click();
        setTimeout(() => {
          const aprovacoesTab = document.querySelector('[value="aprovacoes"]');
          if (aprovacoesTab) aprovacoesTab.click();
        }, 200);
      }, 100);
    };

    // ✅ ESCUTAR REFRESH DE APROVAÇÕES (quando usuário é aprovado/rejeitado)
    const handleRefreshRegistrations = () => {
      fetchPendingRegistrations();
    };

    window.addEventListener("navigateToTab", handleNavigation);
    window.addEventListener("navigate-to-approval", handleApprovalNavigation);
    window.addEventListener(
      "refresh-pending-registrations",
      handleRefreshRegistrations
    );

    return () => {
      window.removeEventListener("navigateToTab", handleNavigation);
      window.removeEventListener(
        "navigate-to-approval",
        handleApprovalNavigation
      );
      window.removeEventListener(
        "refresh-pending-registrations",
        handleRefreshRegistrations
      );
    };
  }, [user]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const endpoint =
        user.role === "admin" || user.role === "manager"
          ? "/api/dashboard/manager"
          : "/api/dashboard/player";

      const response = await fetch(endpoint, {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else if (response.status === 304) {
        // 304 Not Modified - usar dados do cache se disponíveis
        console.log("Dashboard data not modified, using cached data");
      } else {
        console.error(
          "Erro ao carregar dados do dashboard:",
          response.status,
          response.statusText
        );
      }
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  // ✅ BUSCAR APROVAÇÕES PENDENTES PARA INDICADOR
  const fetchPendingRegistrations = useCallback(async () => {
    try {
      const response = await fetch("/api/registration/pending", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRegistrations(data.total_pending || 0);

        // Atualizar dashboardData com info de registros pendentes
        setDashboardData((prev) => ({
          ...prev,
          pending_registrations: data.total_pending || 0,
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar registros pendentes:", error);
    }
  }, []);

  const fetchPendingReloads = useCallback(async () => {
    try {
      setLoadingReloads(true);
      // Backend espera enums em minúsculas; usar lowercase evita 400 e inconsistências
      const res = await fetch("/api/reload_requests/?status=pending", {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });

      // Tratar código 304 (Not Modified) como sucesso
      if (res.ok || res.status === 304) {
        if (res.status !== 304) {
          const data = await res.json();
          setPendingReloads(data.reload_requests || []);
        }
        // Se for 304, mantém os dados existentes
      } else {
        console.error(
          "Error fetching pending reloads:",
          res.status,
          res.statusText
        );
      }
    } catch (e) {
      console.error("Erro ao carregar solicitações pendentes", e);
    } finally {
      setLoadingReloads(false);
    }
  }, []);

  const handleApprove = async (reloadId) => {
    try {
      setProcessingAction(reloadId);
      const response = await fetch(`/api/reload_requests/${reloadId}/approve`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Reload aprovado com sucesso!");
        fetchDashboardData();
        fetchPendingReloads();
      } else {
        const error = await response.json();
        toast.error("Erro ao aprovar reload", { description: error.error });
      }
    } catch (error) {
      console.error("Erro ao aprovar reload:", error);
      toast.error("Erro de conexão");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleReject = async (reloadId) => {
    try {
      setProcessingAction(reloadId);
      const response = await fetch(`/api/reload_requests/${reloadId}/reject`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Rejeitado via dashboard" }),
      });

      if (response.ok) {
        toast.success("Reload rejeitado!");
        fetchDashboardData();
        fetchPendingReloads();
      } else {
        const error = await response.json();
        toast.error("Erro ao rejeitar reload", { description: error.error });
      }
    } catch (error) {
      console.error("Erro ao rejeitar reload:", error);
      toast.error("Erro de conexão");
    } finally {
      setProcessingAction(null);
    }
  };

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

  // ✅ FUNÇÕES PARA MODAIS DE SOLICITAÇÃO
  const handleRequestReload = () => {
    setShowReloadModal(true);
  };

  const handleRequestWithdrawal = () => {
    setShowWithdrawalModal(true);
  };

  const handleReloadSuccess = (reloadRequest) => {
    toast.success("Solicitação de reload criada com sucesso!", {
      description: `Reload de $${reloadRequest.amount} em ${reloadRequest.platform_name} está aguardando aprovação.`,
    });
    setShowReloadModal(false);
    fetchDashboardData(); // Atualizar dashboard
  };

  const handleWithdrawalSuccess = (withdrawalRequest) => {
    toast.success("Solicitação de saque criada com sucesso!", {
      description: `Saque de $${withdrawalRequest.amount} de ${withdrawalRequest.platform_name} está aguardando aprovação.`,
    });
    setShowWithdrawalModal(false);
    fetchDashboardData(); // Atualizar dashboard
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
                    onClick={() => setActiveTab("notificacoes")}
                  >
                    Notificações
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("relatorios")}
                  >
                    Relatórios
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("alertas")}
                  >
                    Alertas
                  </Button>
                  {(user.role === "admin" || user.role === "manager") && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab("backup-auditoria")}
                    >
                      Backups e Auditorias
                    </Button>
                  )}
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
        {/* ✅ ALERTA DE APROVAÇÕES PENDENTES (só para admin/manager) */}
        {(user.role === "admin" || user.role === "manager") && (
          <ApprovalAlert
            onNavigateToApproval={() => {
              setActiveTab("backup-auditoria");
              setTimeout(() => {
                const auditoriaTab = document.querySelector(
                  '[value="auditoria"]'
                );
                if (auditoriaTab) auditoriaTab.click();
                setTimeout(() => {
                  const aprovacoesTab = document.querySelector(
                    '[value="aprovacoes"]'
                  );
                  if (aprovacoesTab) aprovacoesTab.click();
                }, 200);
              }, 100);
            }}
          />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Navegação Mobile Otimizada */}
          <div className="mobile-tabs overflow-x-auto no-scrollbar mb-6">
            <TabsList
              className={`grid w-full min-w-max overflow-x-auto no-scrollbar ${
                user.role === "admin"
                  ? "grid-cols-8"
                  : user.role === "manager"
                  ? "grid-cols-7"
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
              <TabsTrigger
                value="notificacoes"
                className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
              >
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notificações</span>
                <span className="sm:hidden text-xs">🔔</span>
              </TabsTrigger>
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
                  value="backup-auditoria"
                  className="flex items-center space-x-1 md:space-x-2 mobile-tap-target relative"
                >
                  <Database className="w-4 h-4" />
                  <span className="hidden sm:inline">Backups e Auditorias</span>
                  <span className="sm:hidden text-xs">💾</span>
                  {/* ✅ INDICADOR DE APROVAÇÕES PENDENTES */}
                  {dashboardData?.pending_registrations > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">
                        {dashboardData.pending_registrations}
                      </span>
                    </div>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger
                value="configuracoes"
                className="flex items-center space-x-1 md:space-x-2 mobile-tap-target"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">{"Meu Perfil"}</span>
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
                          variant={
                            pendingRegistrations > 0 ? "default" : "outline"
                          }
                          onClick={() => {
                            setActiveTab("backup-auditoria");
                            setTimeout(() => {
                              const auditoriaTab = document.querySelector(
                                '[value="auditoria"]'
                              );
                              if (auditoriaTab) auditoriaTab.click();
                              if (pendingRegistrations > 0) {
                                setTimeout(() => {
                                  const aprovacoesTab = document.querySelector(
                                    '[value="aprovacoes"]'
                                  );
                                  if (aprovacoesTab) aprovacoesTab.click();
                                }, 200);
                              }
                            }, 100);
                          }}
                          className={`relative ${
                            pendingRegistrations > 0
                              ? "bg-orange-500 hover:bg-orange-600 text-white"
                              : ""
                          }`}
                        >
                          {pendingRegistrations > 0 ? (
                            <>🔔 Aprovar Usuários ({pendingRegistrations})</>
                          ) : (
                            "Ver Auditoria"
                          )}
                          {pendingRegistrations > 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center">
                              <span className="text-[9px] text-white font-bold">
                                {pendingRegistrations}
                              </span>
                            </div>
                          )}
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
                            Solicitações pendentes:{" "}
                            {loadingReloads
                              ? "..."
                              : `${
                                  dashboardData?.statistics?.pending_requests ??
                                  0
                                } total 
                                 (${
                                   dashboardData?.statistics
                                     ?.pending_reload_requests ?? 0
                                 } reloads + 
                                 ${
                                   dashboardData?.statistics
                                     ?.pending_withdrawal_requests ?? 0
                                 } saques)`}
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
                                  className={`bg-green-600 hover:bg-green-700 button-enhanced focus-enhanced ${
                                    processingAction === r.id
                                      ? "button-loading"
                                      : ""
                                  }`}
                                  onClick={() => handleApprove(r.id)}
                                  disabled={processingAction === r.id}
                                >
                                  {processingAction === r.id
                                    ? ""
                                    : "✅ Aprovar"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className={`button-enhanced focus-enhanced ${
                                    processingAction === r.id
                                      ? "button-loading"
                                      : ""
                                  }`}
                                  onClick={() => handleReject(r.id)}
                                  disabled={processingAction === r.id}
                                >
                                  {processingAction === r.id
                                    ? ""
                                    : "❌ Rejeitar"}
                                </Button>
                              </div>
                            </div>
                          ))}
                          {pendingReloads.length > 3 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveTab("backup-auditoria")}
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

                    <Card className="card-hover">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-high-contrast">
                          Solicitações Pendentes
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold status-pending">
                          {dashboardData.statistics?.pending_requests || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {dashboardData.statistics?.pending_reload_requests ||
                            0}{" "}
                          reloads +{" "}
                          {dashboardData.statistics
                            ?.pending_withdrawal_requests || 0}{" "}
                          saques
                        </p>
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
                            <SelectItem value="complete">OK</SelectItem>
                            <SelectItem value="pending">Pendente</SelectItem>
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
                                className="grid grid-cols-3 gap-4 p-3 border border-border rounded-lg hover:bg-secondary/50 transition-colors items-center"
                              >
                                {/* Coluna 1: Pendências (esquerda) */}
                                <div className="flex flex-col space-y-1">
                                  {player.incomplete_data_count > 0 && (
                                    <span className="text-xs text-orange-500">
                                      {player.incomplete_data_count} dados
                                      pendentes
                                    </span>
                                  )}
                                  {player.pending_requests_count > 0 && (
                                    <span
                                      title="Ver solicitações deste jogador"
                                      className="text-xs text-yellow-500 underline cursor-pointer"
                                      onClick={() => {
                                        sessionStorage.setItem(
                                          "selectedPlayerId",
                                          String(player.id)
                                        );
                                        sessionStorage.setItem(
                                          "planilhaFocus",
                                          "solicitacoes"
                                        );
                                        setActiveTab("planilha");
                                      }}
                                    >
                                      {player.pending_requests_count}{" "}
                                      solicitações
                                    </span>
                                  )}
                                  {!player.incomplete_data_count &&
                                    !player.pending_requests_count && (
                                      <span className="text-xs text-green-500">
                                        {/* Texto removido conforme ABA Administrador_.md */}
                                      </span>
                                    )}
                                </div>

                                {/* Coluna 2: Jogador (centro) */}
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

                                {/* Coluna 3: Valores (direita) */}
                                <div className="flex items-center justify-end space-x-2">
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
                                        // Deep link direto para Verificar Perfil em Gestão > Jogadores
                                        sessionStorage.setItem(
                                          "playerSearchQuery",
                                          player.username
                                        );
                                        sessionStorage.setItem(
                                          "openProfileUserId",
                                          String(player.id)
                                        );
                                        setActiveTab("gestao");
                                        setGestaoInnerTab("jogadores");
                                      }}
                                    >
                                      Perfil
                                    </Button>
                                  )}
                                  {(user.role === "admin" ||
                                    user.role === "manager") && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        sessionStorage.setItem(
                                          "selectedPlayerId",
                                          String(player.id)
                                        );
                                        sessionStorage.setItem(
                                          "planilhaFocus",
                                          "solicitacoes"
                                        );
                                        setActiveTab("planilha");
                                      }}
                                    >
                                      Solicitações
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
            {user.role === "player" && (
              <PlayerDashboardEnhanced
                user={user}
                onRequestReload={handleRequestReload}
                onRequestWithdrawal={handleRequestWithdrawal}
              />
            )}

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
                <TabsList className="grid w-full grid-cols-3 overflow-x-auto no-scrollbar">
                  <TabsTrigger
                    value="dashboard"
                    className="flex items-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Dashboard
                  </TabsTrigger>
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
                  <VerificarPerfil userRole={user.role} />
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}

          {(user.role === "admin" || user.role === "manager") && (
            <TabsContent value="backup-auditoria" className="mt-6">
              <Tabs
                defaultValue={user.role === "admin" ? "backup" : "auditoria"}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  {user.role === "admin" && (
                    <TabsTrigger value="backup">💾 Backups</TabsTrigger>
                  )}
                  <TabsTrigger value="auditoria">✅ Auditoria</TabsTrigger>
                </TabsList>

                {user.role === "admin" && (
                  <TabsContent value="backup" className="mt-6">
                    <BackupManagement userRole={user.role} />
                  </TabsContent>
                )}

                <TabsContent value="auditoria" className="mt-6">
                  <GestaoAuditoria user={user} />
                </TabsContent>
              </Tabs>
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

          <TabsContent value="notificacoes" className="mt-6">
            <NotificationCenter user={user} />
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-6">
            <MeuPerfil user={user} userRole={user.role} />
          </TabsContent>
        </Tabs>
      </main>

      {/* ✅ MODAIS DE SOLICITAÇÃO */}
      <ReloadRequestModal
        isOpen={showReloadModal}
        onClose={() => setShowReloadModal(false)}
        userId={user.id}
        onSuccess={handleReloadSuccess}
      />

      <WithdrawalRequestModal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        userId={user.id}
        onSuccess={handleWithdrawalSuccess}
      />
    </div>
  );
};

export default Dashboard;
