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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
        <div className="flex items-center space-x-3">
          {getStatusBadge(playerStatus)}
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Progresso de Completude */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Progresso do Perfil</CardTitle>
            <span className="text-2xl font-bold invictus-gold">
              {completionPercentage}%
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={completionPercentage} className="h-3 mb-3" />
          <p className="text-sm text-muted-foreground">
            {completionPercentage === 100
              ? "🎉 Parabéns! Seu perfil está 100% completo!"
              : `${
                  100 - completionPercentage
                }% restante para completar seu perfil`}
          </p>
        </CardContent>
      </Card>

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
              <TooltipProvider key={index}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors cursor-help">
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
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Clique para mais informações sobre esta dica
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>
            Acesse rapidamente as funcionalidades mais usadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={() => onRequestReload && onRequestReload()}
              className="h-auto p-4 flex flex-col space-y-2"
            >
              <DollarSign className="w-5 h-5" />
              <span className="text-xs">Solicitar Reload</span>
            </Button>
            <Button
              onClick={() => onRequestWithdrawal && onRequestWithdrawal()}
              variant="outline"
              className="h-auto p-4 flex flex-col space-y-2"
            >
              <TrendingDown className="w-5 h-5" />
              <span className="text-xs">Solicitar Saque</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col space-y-2"
            >
              <RefreshCw className="w-5 h-5" />
              <span className="text-xs">Atualizar Saldos</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto p-4 flex flex-col space-y-2"
            >
              <HelpCircle className="w-5 h-5" />
              <span className="text-xs">Ajuda</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlayerDashboardEnhanced;
