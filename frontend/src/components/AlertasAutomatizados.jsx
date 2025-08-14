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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  Bell,
  BellOff,
  Settings,
  MoreVertical,
  RefreshCw,
  Zap,
  Shield,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

// Configurações de alertas
const ALERT_CONFIGS = {
  pending_reloads: {
    name: "Reloads Pendentes",
    description: "Reloads aguardando aprovação há mais de 24h",
    icon: Clock,
    type: "warning",
    threshold: 1,
    checkFunction: (data) =>
      data.pendingReloads?.filter(
        (r) => new Date() - new Date(r.created_at) > 24 * 60 * 60 * 1000
      ).length || 0,
  },
  low_balances: {
    name: "Saldos Baixos",
    description: "Jogadores com saldo abaixo de $100",
    icon: TrendingDown,
    type: "info",
    threshold: 100,
    checkFunction: (data) =>
      data.players?.filter(
        (p) => p.current_balance < 100 && p.accounts_count > 0
      ).length || 0,
  },
  incomplete_profiles: {
    name: "Perfis Incompletos",
    description: "Jogadores com dados obrigatórios faltando",
    icon: Users,
    type: "warning",
    threshold: 1,
    checkFunction: (data) =>
      data.players?.filter((p) => p.incomplete_data > 0).length || 0,
  },
  stale_data: {
    name: "Dados Desatualizados",
    description: "Saldos não atualizados há mais de 7 dias",
    icon: Calendar,
    type: "info",
    threshold: 1,
    checkFunction: (data) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return (
        data.players?.filter(
          (p) => p.last_update && new Date(p.last_update) < sevenDaysAgo
        ).length || 0
      );
    },
  },
  high_makeup: {
    name: "Makeup Alto",
    description: "Jogadores com makeup acima de $1000",
    icon: TrendingUp,
    type: "critical",
    threshold: 1000,
    checkFunction: (data) =>
      data.players?.filter((p) => p.makeup > 1000).length || 0,
  },
  failed_transactions: {
    name: "Transações Rejeitadas",
    description: "Transações rejeitadas nas últimas 24h",
    icon: XCircle,
    type: "critical",
    threshold: 1,
    checkFunction: (data) => data.failedTransactions || 0,
  },
};

const AlertasAutomatizados = ({ user }) => {
  const [alerts, setAlerts] = useState([]);
  const [alertSettings, setAlertSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    checkAlerts();
    loadAlertSettings();

    // Auto-refresh a cada 5 minutos se habilitado
    let interval;
    if (autoRefresh) {
      interval = setInterval(checkAlerts, 5 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const checkAlerts = async () => {
    setLoading(true);
    try {
      // Buscar dados do sistema para análise
      const [dashboardRes, playersRes] = await Promise.all([
        fetch("/api/dashboard/manager", { credentials: "include" }),
        fetch("/api/planilhas/overview", { credentials: "include" }),
      ]);

      if (dashboardRes.ok && playersRes.ok) {
        const dashboardData = await dashboardRes.json();
        const playersData = await playersRes.json();

        const systemData = {
          ...dashboardData,
          players: playersData.players || [],
        };

        // Verificar cada configuração de alerta
        const newAlerts = [];

        Object.entries(ALERT_CONFIGS).forEach(([key, config]) => {
          if (alertSettings[key]?.enabled !== false) {
            // Default enabled
            const count = config.checkFunction(systemData);

            if (count >= config.threshold) {
              newAlerts.push({
                id: key,
                ...config,
                count,
                severity: getSeverity(config.type, count),
                timestamp: new Date().toISOString(),
                message: `${count} ${config.description.toLowerCase()}`,
              });
            }
          }
        });

        setAlerts(newAlerts);
        setLastCheck(new Date());

        // Notificar sobre alertas críticos
        const criticalAlerts = newAlerts.filter((a) => a.type === "critical");
        if (criticalAlerts.length > 0) {
          toast.error(
            `${criticalAlerts.length} alerta(s) crítico(s) detectado(s)!`
          );
        }
      }
    } catch (error) {
      console.error("Erro ao verificar alertas:", error);
      toast.error("Erro ao verificar alertas automatizados");
    } finally {
      setLoading(false);
    }
  };

  const loadAlertSettings = async () => {
    try {
      const response = await fetch("/api/alerts/settings", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAlertSettings(data.settings || {});
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  const toggleAlertType = async (alertType, enabled) => {
    try {
      const newSettings = {
        ...alertSettings,
        [alertType]: { ...alertSettings[alertType], enabled },
      };

      setAlertSettings(newSettings);

      const response = await fetch("/api/alerts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings }),
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Configurações atualizadas!");
        checkAlerts(); // Re-check after settings change
      }
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error);
      toast.error("Erro ao atualizar configurações");
    }
  };

  const getSeverity = (type, count) => {
    if (type === "critical") return "high";
    if (type === "warning" && count > 5) return "high";
    if (type === "warning") return "medium";
    return "low";
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case "critical":
        return XCircle;
      case "warning":
        return AlertTriangle;
      case "info":
        return CheckCircle;
      default:
        return Bell;
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case "critical":
        return "text-red-500 bg-red-50 border-red-200";
      case "warning":
        return "text-yellow-500 bg-yellow-50 border-yellow-200";
      case "info":
        return "text-blue-500 bg-blue-50 border-blue-200";
      default:
        return "text-gray-500 bg-gray-50 border-gray-200";
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      // Marcar alerta como resolvido (opcional - pode implementar backend)
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      toast.success("Alerta marcado como resolvido");
    } catch (error) {
      console.error("Erro ao resolver alerta:", error);
    }
  };

  const criticalAlerts = alerts.filter((a) => a.type === "critical");
  const warningAlerts = alerts.filter((a) => a.type === "warning");
  const infoAlerts = alerts.filter((a) => a.type === "info");

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold gradient-gold-text flex items-center space-x-3">
            <Zap className="w-8 h-8 text-yellow-500" />
            <span>Alertas Automatizados</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoramento inteligente de condições críticas do sistema
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <Bell className="w-4 h-4 mr-2" />
            ) : (
              <BellOff className="w-4 h-4 mr-2" />
            )}
            Auto-refresh {autoRefresh ? "Ativo" : "Inativo"}
          </Button>
          <Button variant="outline" onClick={checkAlerts}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Verificar Agora
          </Button>
        </div>
      </div>

      {/* Status Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Alertas
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold invictus-gold">
              {alerts.length}
            </div>
            <p className="text-xs text-muted-foreground">Alertas ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {criticalAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Requerem ação imediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avisos</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {warningAlerts.length}
            </div>
            <p className="text-xs text-muted-foreground">Merecem atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Última Verificação
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-green-500">
              {lastCheck ? lastCheck.toLocaleTimeString("pt-BR") : "Nunca"}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? "Verificando..." : "Última atualização"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Críticos */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5" />
              <span>Alertas Críticos</span>
            </CardTitle>
            <CardDescription className="text-red-600">
              Estes alertas requerem ação imediata para evitar problemas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalAlerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <Alert key={alert.id} className="border-red-300">
                    <Icon className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{alert.name}</p>
                        <p className="text-sm">{alert.message}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive">{alert.count}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() => resolveAlert(alert.id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Marcar como resolvido
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Target className="w-4 h-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Todos os Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Todos os Alertas</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {Object.entries(ALERT_CONFIGS).map(([key, config]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() =>
                      toggleAlertType(
                        key,
                        !(alertSettings[key]?.enabled !== false)
                      )
                    }
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{config.name}</span>
                      {alertSettings[key]?.enabled !== false ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardTitle>
          <CardDescription>
            Monitoramento em tempo real de condições importantes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Verificando alertas...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium text-green-600">
                Tudo funcionando perfeitamente!
              </p>
              <p className="text-muted-foreground">
                Nenhum alerta ativo no momento
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <TooltipProvider key={alert.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`p-4 rounded-lg border ${getAlertColor(
                            alert.type
                          )} cursor-help`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Icon className="w-5 h-5" />
                              <div>
                                <p className="font-medium">{alert.name}</p>
                                <p className="text-sm opacity-80">
                                  {alert.message}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge
                                className={
                                  alert.type === "critical"
                                    ? "bg-red-100 text-red-800"
                                    : alert.type === "warning"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-blue-100 text-blue-800"
                                }
                              >
                                {alert.count}
                              </Badge>
                              <span className="text-xs opacity-60">
                                {new Date(alert.timestamp).toLocaleTimeString(
                                  "pt-BR"
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{alert.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertasAutomatizados;
