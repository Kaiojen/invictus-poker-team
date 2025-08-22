import { useState, useEffect, useCallback } from "react";
import Planilha from "./Planilha";
import { useSSE } from "../hooks/useSSE";
import ReloadRequestModal from "./ReloadRequestModal";
import WithdrawalRequestModal from "./WithdrawalRequestModal";
import TeamMonthlySnapshots from "./TeamMonthlySnapshots";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Info,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { formatUSD } from "@/lib/utils";
import {
  getPlayerStatus,
  getPlayerStatusClasses,
  getStatusBadge,
  getStatusIndicator,
  getStatusMessage,
  PlayerStatusIndicator,
  usePlayerStatus,
} from "@/components/ui/player-status";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PlanilhaPage = ({ user }) => {
  const [showReloadModal, setShowReloadModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [teamData, setTeamData] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [loading, setLoading] = useState(false);

  const isAdminOrManager = user.role === "admin" || user.role === "manager";

  // SSE para atualizações em tempo real
  const { addEventListener } = useSSE();

  // Buscar dados do time para admin/manager
  useEffect(() => {
    if (isAdminOrManager) {
      fetchTeamData();
    }
  }, [isAdminOrManager, refreshKey]);

  // Deep-link: se vier do dashboard com um jogador selecionado
  useEffect(() => {
    if (isAdminOrManager) {
      const selectedId = sessionStorage.getItem("selectedPlayerId");
      if (selectedId && teamData?.players) {
        const found = teamData.players.find((p) => String(p.id) === selectedId);
        if (found) setSelectedPlayer(found);
        sessionStorage.removeItem("selectedPlayerId");
      }
    }
  }, [isAdminOrManager, teamData]);

  // Detectar foco em solicitações para scroll automático
  useEffect(() => {
    const focus = sessionStorage.getItem("planilhaFocus");
    if (focus === "solicitacoes" && selectedPlayer) {
      sessionStorage.removeItem("planilhaFocus");
      // Scroll para a seção de solicitações após 500ms (aguarda renderização)
      setTimeout(() => {
        const element = document.getElementById("solicitacoes-section");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 500);
    }
  }, [selectedPlayer]);

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/team-financials", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTeamData(data);
      } else {
        console.error("Erro ao carregar dados do time");
      }
    } catch (error) {
      console.error("Erro ao carregar dados do time:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Configurar listeners SSE para atualizações em tempo real
  useEffect(() => {
    if (!addEventListener || !isAdminOrManager) return;

    const removeBalanceUpdatedListener = addEventListener(
      "balance_updated",
      (data) => {
        console.log("PlanilhaPage: Saldo atualizado via SSE", data);
        // Atualizar dados do time quando qualquer saldo for atualizado
        setTimeout(() => fetchTeamData(), 1000);
      }
    );

    const removeReloadCreatedListener = addEventListener(
      "reload_created",
      (data) => {
        console.log("PlanilhaPage: Novo reload criado via SSE", data);
        fetchTeamData(); // Atualizar estatísticas
      }
    );

    const removeReloadApprovedListener = addEventListener(
      "reload_approved",
      (data) => {
        console.log("PlanilhaPage: Reload aprovado via SSE", data);
        fetchTeamData(); // Atualizar estatísticas
      }
    );

    const removeDashboardRefreshListener = addEventListener(
      "dashboard_refresh",
      () => {
        console.log("PlanilhaPage: Refresh solicitado via SSE");
        fetchTeamData();
      }
    );

    // Cleanup dos listeners
    return () => {
      removeBalanceUpdatedListener?.();
      removeReloadCreatedListener?.();
      removeReloadApprovedListener?.();
      removeDashboardRefreshListener?.();
    };
  }, [addEventListener, fetchTeamData, isAdminOrManager]);

  // Usar hook personalizado para gerenciar status dos jogadores
  const { players: playersWithStatus, stats: playerStats } = usePlayerStatus(
    teamData?.players || []
  );

  const handleViewPlayer = (player) => {
    setSelectedPlayer(player);
    // deep-link para pendência: se crítico, abre modal de reload; se pendente, foca planilha
    if (player.computedStatus === "critical") {
      // nada aqui; modal é acionado dentro do Planilha ao clicar; mantemos navegação
    }
  };

  const handleReloadSuccess = (reloadRequest) => {
    toast.success("Solicitação de reload criada com sucesso!", {
      description: `Reload de $${reloadRequest.amount} em ${reloadRequest.platform_name} está aguardando aprovação.`,
    });
    setShowReloadModal(false);
    setRefreshKey((prev) => prev + 1); // Força refresh da planilha
  };

  const handleWithdrawalSuccess = (withdrawalRequest) => {
    toast.success("Solicitação de saque criada com sucesso!", {
      description: `Saque de $${withdrawalRequest.amount} de ${withdrawalRequest.platform_name} está aguardando aprovação.`,
    });
    setShowWithdrawalModal(false);
    setRefreshKey((prev) => prev + 1); // Força refresh da planilha
  };

  const handleRequestReload = () => {
    setShowReloadModal(true);
  };

  const handleRequestWithdrawal = () => {
    setShowWithdrawalModal(true);
  };

  // Renderização para Admin/Manager - Visão Geral do Time
  if (isAdminOrManager) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header Admin/Manager */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-gold-text flex items-center gap-2 fade-in">
              <BarChart3 className="w-8 h-8 text-primary" />
              Gestão Financeira do Time
            </h1>
            <p className="text-muted-foreground">
              Dashboard completo de entradas, saídas, lucros e gastos da equipe
            </p>
          </div>
          {selectedPlayer && (
            <Button
              variant="outline"
              onClick={() => setSelectedPlayer(null)}
              className="ml-4 border-border text-foreground hover:bg-secondary"
            >
              ← Voltar à Visão Geral
            </Button>
          )}
        </div>

        {/* Abas de Navegação */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">📊 Visão Geral</TabsTrigger>
            <TabsTrigger value="monthly">📅 Controle Mensal</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">
                  Carregando dados do time...
                </p>
              </div>
            ) : selectedPlayer ? (
              // Visão individual do jogador para admin
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <img
                        src="/LOGO_NOVO.png"
                        alt="Invictus"
                        className="w-6 h-6 object-contain"
                      />
                      <span>Planilha de {selectedPlayer.full_name}</span>
                    </CardTitle>
                    <CardDescription>
                      Dados completos e histórico do jogador
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Planilha
                  key={`${refreshKey}-${selectedPlayer.id}`}
                  userId={selectedPlayer.id}
                  userRole={user.role}
                  onRequestReload={handleRequestReload}
                  onRequestWithdrawal={handleRequestWithdrawal}
                  isManagingOtherUser={true}
                />
              </div>
            ) : (
              // Dashboard geral do time
              <div className="space-y-6">
                {/* Cards de Estatísticas Financeiras */}
                {teamData && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Saldo Total do Time
                        </CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-400">
                          $ {teamData.totalBalance?.toFixed(2) || "0.00"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Soma de todas as contas
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Lucro Mensal
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div
                          className={`text-2xl font-bold ${
                            (teamData.monthlyProfit || 0) >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          $ {teamData.monthlyProfit?.toFixed(2) || "0.00"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Resultado dos últimos 30 dias (alinhado ao gráfico)
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Reloads Pendentes
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-400">
                          {teamData.pendingReloads || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Aguardando aprovação
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                          Jogadores Ativos
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-400">
                          {teamData.activePlayers || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Com contas ativas
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Central de Pendências e Solicitações */}
                {playerStats.total > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">
                        ⚠️ Pendências e Solicitações
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-500">
                            {playerStats.complete}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Completos
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-500">
                            {playerStats.pending}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Pendentes
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-500">
                            {playerStats.critical}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Críticos
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold invictus-gold">
                            {playerStats.total}
                          </div>
                          <p className="text-sm text-muted-foreground">Total</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Lista de Jogadores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <img
                        src="/LOGO_NOVO.png"
                        alt="Invictus"
                        className="w-6 h-6 object-contain"
                      />
                      <span>Jogadores do Time</span>
                      {playerStats.critical > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {playerStats.critical} requer atenção
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Clique em um jogador para ver detalhes completos de sua
                      planilha
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {playersWithStatus?.length > 0 ? (
                      <div className="space-y-3">
                        {playersWithStatus.map((player) => (
                          <TooltipProvider key={player.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`${getPlayerStatusClasses(
                                    player.computedStatus
                                  )} cursor-pointer hover:scale-[1.02] transition-transform`}
                                  onClick={() => handleViewPlayer(player)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <div className="flex items-center space-x-2">
                                        {getStatusIndicator(
                                          player.computedStatus
                                        )}
                                        <span
                                          className={`player-name ${
                                            player.computedStatus === "critical"
                                              ? "font-bold"
                                              : "font-medium"
                                          }`}
                                        >
                                          {player.full_name}
                                        </span>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        @{player.username}
                                      </Badge>
                                      {getStatusBadge(player.computedStatus, {
                                        className: "text-xs",
                                      })}
                                    </div>
                                    <div className="flex items-center justify-between flex-1">
                                      <div className="flex items-center space-x-2">
                                        {player.pendingCount > 0 && (
                                          <Badge
                                            variant="destructive"
                                            className="text-xs"
                                          >
                                            {player.pendingCount} pendência(s)
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center space-x-4">
                                        <div className="text-right">
                                          <p className="text-sm font-medium text-green-400">
                                            {formatUSD(
                                              player.totalBalance || 0
                                            )}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {player.accountCount || 0} conta(s)
                                          </p>
                                        </div>
                                        <Button variant="outline" size="sm">
                                          <Eye className="w-4 h-4 mr-1" />
                                          Ver Planilha
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-sm max-w-xs">
                                  {player.statusMessage}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4" />
                        <p>Nenhum jogador encontrado</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="monthly" className="mt-6">
            <TeamMonthlySnapshots user={user} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Renderização para Jogador - Visão Individual
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header da página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-gold-text">
            📋 Minha Planilha
          </h1>
          <p className="text-muted-foreground">
            Gerencie seus saldos e solicitações em todas as plataformas
          </p>
        </div>
      </div>

      {/* Componente principal da planilha */}
      <Planilha
        key={refreshKey}
        userId={user.id}
        userRole={user.role}
        onRequestReload={handleRequestReload}
        onRequestWithdrawal={handleRequestWithdrawal}
      />

      {/* Modal de solicitação de reload */}
      <ReloadRequestModal
        isOpen={showReloadModal}
        onClose={() => setShowReloadModal(false)}
        userId={user.id}
        onSuccess={handleReloadSuccess}
      />

      {/* Modal de solicitação de saque */}
      <WithdrawalRequestModal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        userId={user.id}
        onSuccess={handleWithdrawalSuccess}
      />
    </div>
  );
};

export default PlanilhaPage;
