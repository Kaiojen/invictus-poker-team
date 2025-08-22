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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  CheckCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Info,
  BookOpen,
  Target,
  Calendar,
  Award,
  RefreshCw,
  HelpCircle,
  Lightbulb,
} from "lucide-react";
import {
  getPlayerStatus,
  getStatusBadge,
  getStatusIndicator,
  getStatusMessage,
} from "@/components/ui/player-status";
import { toast } from "sonner";

const PlayerDashboardEnhanced = ({
  user,
  onRequestReload,
  onRequestWithdrawal,
}) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    loadPlayerTips();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/planilhas/user/${user.id}`, {
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
  };

  const loadPlayerTips = () => {
    const playerTips = [
      {
        icon: Target,
        title: "Mantenha seus dados atualizados",
        description:
          "Atualize seus saldos semanalmente para manter controle preciso",
        type: "info",
      },
      {
        icon: DollarSign,
        title: "Solicite reloads com antecedência",
        description: "Processamento pode levar até 24h em dias úteis",
        type: "warning",
      },
      {
        icon: BookOpen,
        title: "Documente seus ganhos",
        description: "Faça upload de comprovantes para facilitar auditoria",
        type: "info",
      },
      {
        icon: Award,
        title: "Acompanhe sua performance",
        description: "Use os relatórios para analisar seus resultados",
        type: "success",
      },
    ];
    setTips(playerTips);
  };

  // ✅ FUNÇÕES DAS AÇÕES RÁPIDAS
  const handleRequestReload = () => {
    if (onRequestReload) {
      onRequestReload();
    } else {
      toast.info("Função de reload será implementada em breve");
    }
  };

  const handleRequestWithdrawal = () => {
    if (onRequestWithdrawal) {
      onRequestWithdrawal();
    } else {
      toast.info("Função de saque será implementada em breve");
    }
  };

  const handleUpdateBalances = () => {
    toast.info("Atualizando página...");
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleHelp = () => {
    toast.info("Abrindo página de ajuda...");
    setTimeout(() => {
      window.open("/help", "_blank");
    }, 500);
  };

  const calculateCompletionPercentage = () => {
    if (!dashboardData) return 0;

    const totalFields = 10; // Total de campos importantes
    let completedFields = 0;

    // Verificar campos do perfil
    if (user.phone) completedFields++;
    if (user.document) completedFields++;
    if (user.pix_key) completedFields++;
    if (user.bank_name) completedFields++;
    if (user.bank_account) completedFields++;

    // Verificar contas ativas
    if (dashboardData.accounts?.some((acc) => acc.has_account))
      completedFields++;

    // Verificar atualizações recentes
    if (dashboardData.accounts?.some((acc) => acc.last_balance_update))
      completedFields++;

    // Verificar documentos
    if (dashboardData.accounts?.some((acc) => acc.documents?.length > 0))
      completedFields++;

    // Verificar ausência de pendências críticas
    if (!dashboardData.pending_requests?.reloads?.length) completedFields++;
    if (!dashboardData.pending_requests?.withdrawals?.length) completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  };

  const getNextActions = () => {
    if (!dashboardData) return [];

    const actions = [];

    // Dados incompletos
    if (dashboardData.incomplete_data?.length > 0) {
      actions.push({
        type: "warning",
        icon: AlertTriangle,
        title: "Complete seus dados pessoais",
        description: `${dashboardData.incomplete_data.length} campo(s) precisam ser preenchidos`,
        action: "Ir para Perfil",
        priority: "high",
      });
    }

    // Contas sem saldo atualizado
    const staleAccounts = dashboardData.accounts?.filter(
      (acc) =>
        acc.has_account &&
        (!acc.last_balance_update ||
          new Date(acc.last_balance_update) <
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    );

    if (staleAccounts?.length > 0) {
      actions.push({
        type: "info",
        icon: RefreshCw,
        title: "Atualize seus saldos",
        description: `${staleAccounts.length} conta(s) com dados antigos`,
        action: "Atualizar Planilha",
        priority: "medium",
      });
    }

    // Solicitações pendentes
    if (dashboardData.pending_requests?.reloads?.length > 0) {
      actions.push({
        type: "warning",
        icon: Clock,
        title: "Aguardando aprovação de reload",
        description: `${dashboardData.pending_requests.reloads.length} solicitação(ões) em análise`,
        action: "Ver Detalhes",
        priority: "high",
      });
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  };

  const playerStatus = getPlayerStatus(dashboardData);
  const completionPercentage = calculateCompletionPercentage();
  const nextActions = getNextActions();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando seu dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Título do Invictus Poker Team */}
      <div className="text-center py-4">
        <h2 className="text-3xl sm:text-4xl font-extrabold gradient-gold-text">
          Invictus Poker Team
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Mente fria, jogo afiado. A vitória é só o começo.
        </p>
      </div>

      {/* Header com Status Geral */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold gradient-gold-text flex items-center space-x-3">
            <span>🎯 Meu Dashboard</span>
            {getStatusIndicator(playerStatus)}
          </h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo, {user.full_name}! Aqui está o resumo da sua situação.
          </p>
        </div>
        <div className="flex items-center space-x-3"></div>
      </div>

      {/* Próximas Ações */}
      {nextActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              <span>Próximas Ações</span>
            </CardTitle>
            <CardDescription>
              Itens que requerem sua atenção para manter tudo em ordem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nextActions.map((action, index) => (
                <Alert
                  key={index}
                  className={
                    action.type === "warning"
                      ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                      : action.type === "info"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      : "border-green-500 bg-green-50 dark:bg-green-950/20"
                  }
                >
                  <action.icon className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{action.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // deep-link basico: abre aba planilha e ancora de campo
                        const url = new URL(
                          "/dashboard?tab=planilha",
                          window.location.origin
                        );
                        window.location.href = url.pathname + url.search;
                      }}
                    >
                      {action.action}
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold invictus-gold">
              ${" "}
              {dashboardData?.summary?.total_current_balance?.toFixed(2) ||
                "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboardData?.summary?.active_accounts || 0} conta(s) ativa(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P&L Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                (dashboardData?.summary?.total_pnl || 0) >= 0
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              $ {dashboardData?.summary?.total_pnl?.toFixed(2) || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">Resultado acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendências</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {(dashboardData?.pending_requests?.reloads?.length || 0) +
                (dashboardData?.pending_requests?.withdrawals?.length || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Solicitações em análise
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dicas e Orientações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <span>Dicas para Jogadores</span>
          </CardTitle>
          <CardDescription>
            Orientações para manter seu perfil sempre atualizado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tips.map((tip, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-3 rounded-lg border"
              >
                <tip.icon
                  className={`w-5 h-5 mt-0.5 ${
                    tip.type === "warning"
                      ? "text-yellow-500"
                      : tip.type === "success"
                      ? "text-green-500"
                      : "text-blue-500"
                  }`}
                />
                <div>
                  <p className="font-medium text-sm">{tip.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {tip.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>🚀 Ações Rápidas</CardTitle>
          <CardDescription>
            Acesse rapidamente as funcionalidades mais usadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={handleRequestReload}
              variant="outline"
              className="h-auto p-6 flex flex-col items-center space-y-3 border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
            >
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors">
                <DollarSign className="w-6 h-6 text-green-700 dark:text-green-400" />
              </div>
              <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                Solicitar Reload
              </span>
            </Button>
            <Button
              onClick={handleRequestWithdrawal}
              variant="outline"
              className="h-auto p-6 flex flex-col items-center space-y-3 border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
            >
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                <TrendingDown className="w-6 h-6 text-blue-700 dark:text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                Solicitar Saque
              </span>
            </Button>
            <Button
              onClick={handleUpdateBalances}
              variant="outline"
              className="h-auto p-6 flex flex-col items-center space-y-3 border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
            >
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 group-hover:bg-amber-200 dark:group-hover:bg-amber-800/40 transition-colors">
                <RefreshCw className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              </div>
              <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                Atualizar Saldos
              </span>
            </Button>
            <Button
              onClick={handleHelp}
              variant="outline"
              className="h-auto p-6 flex flex-col items-center space-y-3 border-2 border-muted hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
            >
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
                <HelpCircle className="w-6 h-6 text-purple-700 dark:text-purple-400" />
              </div>
              <span className="text-sm font-semibold text-foreground group-hover:text-primary">
                Ajuda
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlayerDashboardEnhanced;
