import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Trophy,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Eye,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

const PlayerDashboardImproved = ({ user }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("30"); // dias

  useEffect(() => {
    fetchDashboardData();
    fetchPerformanceData();
  }, [timeframe]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/dashboard/player?days=${timeframe}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        toast.error("Erro ao carregar dados do dashboard");
      }
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro de conexão");
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const response = await fetch(
        `/api/dashboard/performance?days=${timeframe}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data);
      }
    } catch (error) {
      console.error("Erro ao buscar dados de performance:", error);
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

  const formatPercentage = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  const getPerformanceColor = (value) => {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "complete":
        return "text-green-600";
      case "pending":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="w-4 h-4" />;
      case "pending":
        return <Clock className="w-4 h-4" />;
      case "critical":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Carregando seu dashboard...</p>
      </div>
    );
  }

  // 🚨 CORREÇÃO: Usar dados corretos do backend ao invés de cálculos manuais
  const totalBalance = dashboardData?.summary?.total_current_balance || 0;
  const totalInvestment = dashboardData?.summary?.total_investment || 0; // Já inclui reloads
  const totalPnL = dashboardData?.summary?.total_pnl || 0; // P&L correto do backend
  const approvedReloads = dashboardData?.summary?.approved_reload_amount || 0;
  const pnlPercentage =
    totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Dashboard do Jogador</span>
              </CardTitle>
              <CardDescription>
                Acompanhe sua performance e evolução financeira
              </CardDescription>
            </div>

            <div className="flex items-center space-x-4">
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="365">1 ano</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={fetchDashboardData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Saldo Total
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(totalBalance)}
                </p>
              </div>
              <Wallet className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  P&L Total
                </p>
                <p
                  className={`text-2xl font-bold ${getPerformanceColor(
                    totalPnL
                  )}`}
                >
                  {formatCurrency(totalPnL)}
                </p>
                <p className={`text-sm ${getPerformanceColor(pnlPercentage)}`}>
                  {formatPercentage(pnlPercentage)}
                </p>
              </div>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-600" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Contas Ativas
                </p>
                <p className="text-2xl font-bold">
                  {dashboardData?.accounts?.filter((acc) => acc.is_active)
                    .length || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  de {dashboardData?.accounts?.length || 0} total
                </p>
              </div>
              <PieChart className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Reloads Pendentes
                </p>
                <p className="text-2xl font-bold">
                  {dashboardData?.pending_reloads || 0}
                </p>
                <p className="text-sm text-muted-foreground">solicitações</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance mensal */}
      {performanceData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="w-5 h-5" />
              <span>Performance Mensal</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">ROI Mensal</span>
                  <span
                    className={`font-bold ${getPerformanceColor(
                      performanceData.monthly_roi
                    )}`}
                  >
                    {formatPercentage(performanceData.monthly_roi)}
                  </span>
                </div>
                <Progress
                  value={Math.abs(performanceData.monthly_roi)}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Dias Lucrativos</span>
                  <span className="font-bold text-green-600">
                    {performanceData.profitable_days || 0}
                  </span>
                </div>
                <Progress
                  value={(performanceData.profitable_days / 30) * 100}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Maior Ganho</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(performanceData.biggest_win)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status das contas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Status das Contas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData?.accounts?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PieChart className="w-12 h-12 mx-auto mb-4" />
              <p>Nenhuma conta cadastrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dashboardData?.accounts?.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`flex items-center space-x-2 ${getStatusColor(
                        account.status
                      )}`}
                    >
                      {getStatusIcon(account.status)}
                      <span className="font-medium">
                        {account.platform_name}
                      </span>
                    </div>

                    <Badge
                      variant={account.is_active ? "default" : "secondary"}
                    >
                      {account.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>

                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(account.current_balance)}
                    </p>
                    <p
                      className={`text-sm ${getPerformanceColor(account.pnl)}`}
                    >
                      P&L: {formatCurrency(account.pnl)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Ações Rápidas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-20 flex-col space-y-2"
              onClick={() => (window.location.href = "/dashboard?tab=planilha")}
            >
              <Eye className="w-6 h-6" />
              <span>Ver Planilha</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex-col space-y-2"
              onClick={() =>
                (window.location.href = "/dashboard?tab=relatorios")
              }
            >
              <BarChart3 className="w-6 h-6" />
              <span>Relatórios</span>
            </Button>

            <Button
              variant="outline"
              className="h-20 flex-col space-y-2"
              onClick={() =>
                (window.location.href = "/dashboard?tab=notificacoes")
              }
            >
              <Bell className="w-6 h-6" />
              <span>Notificações</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metas e objetivos */}
      {performanceData?.goals && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Metas do Mês</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {performanceData.goals.map((goal, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{goal.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {goal.current} / {goal.target}
                    </span>
                  </div>
                  <Progress
                    value={(goal.current / goal.target) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {goal.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlayerDashboardImproved;
