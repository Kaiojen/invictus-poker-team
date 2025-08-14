import { formatUSD } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useSSE } from "../hooks/useSSE";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import PlanilhaCompleta from "./PlanilhaCompleta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CalendarTracker from "./CalendarTracker";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  Upload,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Calendar,
  RefreshCw,
} from "lucide-react";

const Planilha = ({
  userId,
  userRole,
  onRequestReload,
  onRequestWithdrawal,
}) => {
  const [planilhaData, setPlanilhaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState(null);
  const [newBalance, setNewBalance] = useState("");
  const [balanceNotes, setBalanceNotes] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [closingDay, setClosingDay] = useState(false);

  // SSE para atualizações em tempo real
  const { addEventListener } = useSSE();

  useEffect(() => {
    fetchPlanilhaData();
  }, [userId]);

  const fetchPlanilhaData = useCallback(async () => {
    try {
      const response = await fetch(`/api/planilhas/user/${userId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPlanilhaData(data);
      }
    } catch (err) {
      console.error("Erro ao carregar planilha:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Configurar listeners SSE para atualizações em tempo real da planilha
  useEffect(() => {
    if (!addEventListener) return;

    const removeBalanceUpdatedListener = addEventListener(
      "balance_updated",
      (data) => {
        console.log("Planilha: Saldo atualizado via SSE", data);
        // Recarregar dados da planilha quando o saldo for atualizado
        setTimeout(() => fetchPlanilhaData(), 1000); // Delay para permitir propagação
      }
    );

    const removeReloadStatusListener = addEventListener(
      "reload_status",
      (data) => {
        console.log("Planilha: Status do reload atualizado via SSE", data);
        fetchPlanilhaData(); // Atualizar dados quando reload for processado
      }
    );

    const removeDashboardRefreshListener = addEventListener(
      "dashboard_refresh",
      () => {
        console.log("Planilha: Refresh solicitado via SSE");
        fetchPlanilhaData();
      }
    );

    // Cleanup dos listeners
    return () => {
      removeBalanceUpdatedListener?.();
      removeReloadStatusListener?.();
      removeDashboardRefreshListener?.();
    };
  }, [addEventListener, fetchPlanilhaData]);

  const handleUpdateBalance = async (accountId) => {
    if (!newBalance || parseFloat(newBalance) < 0) {
      alert("Por favor, informe um saldo válido.");
      return;
    }

    try {
      const response = await fetch(
        `/api/planilhas/account/${accountId}/update-balance`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_balance: parseFloat(newBalance),
            notes: balanceNotes,
            verified: userRole !== "player",
          }),
          credentials: "include",
        }
      );

      if (response.ok) {
        setEditingAccount(null);
        setNewBalance("");
        setBalanceNotes("");
        fetchPlanilhaData(); // Recarregar dados
        // Feedback de sucesso
        const tempMsg = document.createElement("div");
        tempMsg.textContent = "Saldo atualizado com sucesso!";
        tempMsg.style.cssText =
          "position:fixed;top:20px;right:20px;background:green;color:white;padding:10px;border-radius:5px;z-index:9999;";
        document.body.appendChild(tempMsg);
        setTimeout(() => document.body.removeChild(tempMsg), 3000);
      } else {
        const errorData = await response.json();
        alert(
          `Erro ao atualizar saldo: ${errorData.error || "Erro desconhecido"}`
        );
      }
    } catch (err) {
      console.error("Erro ao atualizar saldo:", err);
      alert("Erro de conexão. Tente novamente.");
    }
  };

  const handleToggleAccount = async (
    account,
    hasAccount,
    initialBalance = 0
  ) => {
    try {
      // Upsert via endpoint unificado (garante consistência para admin/jogador)
      const response = await fetch(
        `/api/planilhas/user/${userId}/platform/${account.platform_id}/upsert`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            has_account: hasAccount,
            account_name: account.account_name || account.platform_name,
            current_balance: hasAccount ? initialBalance : 0,
          }),
        }
      );

      if (response.ok) {
        fetchPlanilhaData(); // Recarregar dados
        // Feedback de sucesso
        const action = hasAccount ? "adicionada" : "removida";
        const tempMsg = document.createElement("div");
        tempMsg.textContent = `Conta ${action} com sucesso!`;
        tempMsg.style.cssText =
          "position:fixed;top:20px;right:20px;background:green;color:white;padding:10px;border-radius:5px;z-index:9999;";
        document.body.appendChild(tempMsg);
        setTimeout(() => document.body.removeChild(tempMsg), 3000);
      } else {
        const errorData = await response.json();
        alert(
          `Erro ao alterar conta: ${errorData.error || "Erro desconhecido"}`
        );
      }
    } catch (err) {
      console.error("Erro ao alterar status da conta:", err);
      alert("Erro de conexão. Tente novamente.");
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

  const getAccountStatusColor = (account) => {
    if (!account.has_account) return "text-muted-foreground";
    if (account.platform_name?.toLowerCase() === "luxon")
      return "text-muted-foreground";
    if (account.current_balance === 0) return "status-pending";
    return account.pnl >= 0 ? "status-complete" : "status-critical";
  };

  const formatCurrency = (value) => formatUSD(value);

  const formatDate = (dateString) => {
    if (!dateString) return "Nunca";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const handleCloseDay = async () => {
    try {
      setClosingDay(true);
      const response = await fetch(`/api/planilhas/user/${userId}/close-day`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        fetchPlanilhaData();
      } else {
        const err = await response.json();
        alert(err.error || "Falha ao fechar o dia");
      }
    } catch (e) {
      console.error(e);
      alert("Erro de conexão");
    } finally {
      setClosingDay(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2">Carregando planilha...</span>
      </div>
    );
  }

  if (!planilhaData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Erro ao carregar dados da planilha.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header da Planilha */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="gradient-gold-text">
                📋 Planilha - {planilhaData.user.full_name}
              </CardTitle>
              <CardDescription>
                Última atualização: {formatDate(planilhaData.user.updated_at)}
              </CardDescription>
            </div>
            <div
              className={`flex items-center space-x-2 ${getStatusColor(
                planilhaData.status
              )}`}
            >
              {getStatusIcon(planilhaData.status)}
              <span className="font-medium">
                {planilhaData.status === "complete" && "Tudo em ordem"}
                {planilhaData.status === "pending" && "Dados pendentes"}
                {planilhaData.status === "critical" && "Ação necessária"}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Resumo Consolidado */}
      <Card>
        <CardHeader>
          <CardTitle>💰 Resumo Consolidado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-sm text-muted-foreground">
                Total Investido
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(planilhaData.summary.total_initial_balance)}
              </div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-sm text-muted-foreground">Saldo Atual</div>
              <div className="text-2xl font-bold invictus-gold">
                {formatCurrency(planilhaData.summary.total_current_balance)}
              </div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-sm text-muted-foreground">P&L Total</div>
              <div
                className={`text-2xl font-bold flex items-center justify-center space-x-1 ${
                  planilhaData.summary.total_pnl >= 0
                    ? "status-complete"
                    : "status-critical"
                }`}
              >
                {planilhaData.summary.total_pnl >= 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span>{formatCurrency(planilhaData.summary.total_pnl)}</span>
              </div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-sm text-muted-foreground">Contas Ativas</div>
              <div className="text-2xl font-bold text-primary">
                {planilhaData.summary.active_accounts} /{" "}
                {planilhaData.summary.accounts_count}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pendências da Planilha */}
      {(planilhaData.pending_requests.reloads.length > 0 ||
        planilhaData.pending_requests.withdrawals.length > 0 ||
        planilhaData.accounts.some((acc) => acc.needs_update)) && (
        <Card>
          <CardHeader>
            <CardTitle className="status-pending">
              ⚠️ Pendências da Planilha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {planilhaData.pending_requests.reloads.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    📤 {planilhaData.pending_requests.reloads.length}{" "}
                    solicitação(ões) de reload pendente(s)
                  </AlertDescription>
                </Alert>
              )}
              {planilhaData.pending_requests.withdrawals.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    📥 {planilhaData.pending_requests.withdrawals.length}{" "}
                    solicitação(ões) de saque pendente(s)
                  </AlertDescription>
                </Alert>
              )}
              {planilhaData.accounts.some((acc) => acc.needs_update) && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    📊 Alguns saldos precisam ser atualizados há mais de 24
                    horas
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campos da Planilha Completa */}
      <PlanilhaCompleta userId={userId} userRole={userRole} />

      {/* Tabela de Contas por Plataforma */}
      <Card>
        <CardHeader>
          <CardTitle>🎮 Contas por Plataforma</CardTitle>
          <CardDescription>
            Gerencie seus saldos em cada plataforma
          </CardDescription>
          <div className="mt-2">
            <Button size="sm" onClick={handleCloseDay} disabled={closingDay}>
              {closingDay ? "Fechando..." : "Fechar dia (carimbar saldos)"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>{"Banca Anterior"}</TableHead>
                  <TableHead>Banca Atual</TableHead>
                  <TableHead>Nickname</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  planilhaData.all_platform_accounts ||
                  planilhaData.accounts ||
                  []
                ).map((account) => (
                  <TableRow key={account.id || account.platform_id}>
                    <TableCell className="font-medium">
                      {account.platform_name}
                    </TableCell>
                    <TableCell>
                      {/* Luxon mostra banca inicial (saldo inicial do time).
                          Sites mostram banca anterior (dia anterior) */}
                      {account.platform_name?.toLowerCase() === "luxon" ? (
                        account.has_account ? (
                          formatCurrency(account.initial_balance || 0)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )
                      ) : account.previous_balance != null ? (
                        formatCurrency(account.previous_balance)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingAccount === account.id ? (
                        <div className="space-y-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={newBalance}
                            onChange={(e) => setNewBalance(e.target.value)}
                            placeholder="Novo saldo"
                            className="w-24"
                          />
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              onClick={() => handleUpdateBalance(account.id)}
                              disabled={!newBalance}
                            >
                              <CheckCircle className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingAccount(null);
                                setNewBalance("");
                                setBalanceNotes("");
                              }}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className={getAccountStatusColor(account)}>
                          {account.has_account
                            ? formatCurrency(account.current_balance)
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                    {/* Nickname por plataforma */}
                    <TableCell>
                      {account.has_account ? (
                        <Input
                          value={account.account_name || ""}
                          onChange={async (e) => {
                            const newName = e.target.value;
                            if (account.id) {
                              try {
                                await fetch(`/api/accounts/${account.id}`, {
                                  method: "PUT",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  credentials: "include",
                                  body: JSON.stringify({
                                    account_name: newName,
                                  }),
                                });
                                fetchPlanilhaData(); // Refresh data
                              } catch (err) {
                                console.error("Erro ao salvar nickname:", err);
                              }
                            }
                          }}
                          placeholder={
                            userRole === "player"
                              ? "Seu nick nesta plataforma"
                              : "Nick do jogador"
                          }
                          className="w-44 text-sm"
                          disabled={userRole === "viewer"}
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {account.has_account ? (
                        (() => {
                          const isLuxon =
                            account.platform_name?.toLowerCase() === "luxon";
                          // P&L diário = banca atual - banca anterior (para sites). Luxon é N/A
                          const dailyPnl =
                            !isLuxon && account.previous_balance != null
                              ? Number(account.current_balance || 0) -
                                Number(account.previous_balance || 0)
                              : null;
                          const positive = dailyPnl >= 0;
                          return (
                            <div
                              className={`flex items-center space-x-1 ${
                                isLuxon
                                  ? "text-muted-foreground"
                                  : positive
                                  ? "status-complete"
                                  : "status-critical"
                              }`}
                            >
                              {!isLuxon &&
                                (positive ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                ))}
                              <span>
                                {isLuxon
                                  ? "N/A (transferência)"
                                  : dailyPnl === null
                                  ? "—"
                                  : formatCurrency(dailyPnl)}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={account.has_account ? "default" : "secondary"}
                      >
                        {account.has_account
                          ? account.current_balance === 0
                            ? "Zerada"
                            : account.pnl >= 0
                            ? "Lucro"
                            : "Prejuízo"
                          : "Sem conta"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(account.last_balance_update)}
                      {account.needs_update && (
                        <div className="text-xs status-pending">
                          Precisa atualizar
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex space-x-1 justify-end">
                        {account.has_account ? (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingAccount(account.id);
                                      setNewBalance(
                                        account.current_balance.toString()
                                      );
                                    }}
                                  >
                                    <DollarSign className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Editar saldo da conta</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleToggleAccount(account, false)
                                    }
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Remover conta da planilha</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleToggleAccount(account, true, 0)
                                  }
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Adicionar conta à planilha</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Solicitações Pendentes */}
      {(planilhaData.pending_requests.reloads.length > 0 ||
        planilhaData.pending_requests.withdrawals.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="status-pending">
              📋 Solicitações Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {planilhaData.pending_requests.reloads.map((request) => (
                <div
                  key={`reload-${request.id}`}
                  className="flex justify-between items-center p-3 border border-border rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      Reload {request.platform_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(request.amount)} -{" "}
                      {formatDate(request.created_at)}
                    </div>
                  </div>
                  <Badge variant="secondary">Aguardando</Badge>
                </div>
              ))}

              {planilhaData.pending_requests.withdrawals.map((request) => (
                <div
                  key={`withdrawal-${request.id}`}
                  className="flex justify-between items-center p-3 border border-border rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      Saque {request.platform_name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(request.amount)} -{" "}
                      {formatDate(request.created_at)}
                    </div>
                  </div>
                  <Badge variant="secondary">Aguardando</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações Rápidas (somente jogador) */}
      {userRole === "player" && (
        <Card>
          <CardHeader>
            <CardTitle>⚡ Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={onRequestReload} className="gradient-gold">
                <Upload className="w-4 h-4 mr-2" />
                Solicitar Reload
              </Button>
              <Button onClick={onRequestWithdrawal} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Solicitar Saque
              </Button>

              <Button variant="outline" onClick={fetchPlanilhaData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de edição de saldo (se necessário) */}
      {editingAccount && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Editar Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="balance">Novo Saldo</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={balanceNotes}
                  onChange={(e) => setBalanceNotes(e.target.value)}
                  placeholder="Motivo da alteração..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendário de Preenchimento (últimos 30 dias) */}
      <CalendarTracker playerId={userId} />
    </div>
  );
};

export default Planilha;
