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
import BankrollChart from "./BankrollChart";
// 🚨 REMOVIDO: import NotificationTemplates - não usado mais
import { toast } from "sonner";
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

  // 🚨 SIMPLIFICADO: Apenas calendar e estados mínimos necessários
  const [showCalendar, setShowCalendar] = useState(false);

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

  // ✅ FUNÇÕES LIMPAS - SISTEMA DE TEMPLATE REMOVIDO

  // Ações de solicitações
  // 🚨 NOVO: Ações diretas sem modal de template
  const handleReloadAction = async (reloadId, action) => {
    const isApproval = action === "approve";
    const confirmMessage = isApproval
      ? "Aprovar esta solicitação de reload?"
      : "Rejeitar esta solicitação de reload?";

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(
        `/api/reload-requests/${reloadId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manager_notes: isApproval
              ? "Aprovado via planilha"
              : "Rejeitado via planilha",
          }),
          credentials: "include",
        }
      );

      if (response.ok) {
        toast.success(
          `Reload ${isApproval ? "aprovado" : "rejeitado"} com sucesso!`
        );
        fetchPlanilhaData();
      } else {
        const error = await response.json();
        toast.error(`Erro ao ${action} reload`, {
          description: error.message || "Erro desconhecido",
        });
      }
    } catch (err) {
      toast.error("Erro de conexão");
    }
  };

  const handleWithdrawalAction = async (withdrawalId, action) => {
    const isApproval = action === "approve";
    const isComplete = action === "complete";

    let confirmMessage;
    if (isComplete) {
      confirmMessage = "Marcar saque como concluído?";
    } else {
      confirmMessage = isApproval
        ? "Aprovar esta solicitação de saque?"
        : "Rejeitar esta solicitação de saque?";
    }

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(
        `/api/withdrawal-requests/${withdrawalId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manager_notes: isComplete
              ? "Marcado como concluído via planilha"
              : isApproval
              ? "Aprovado via planilha"
              : "Rejeitado via planilha",
          }),
          credentials: "include",
        }
      );

      if (response.ok) {
        const actionText = isComplete
          ? "marcado como concluído"
          : isApproval
          ? "aprovado"
          : "rejeitado";
        toast.success(`Saque ${actionText} com sucesso!`);
        fetchPlanilhaData();
      } else {
        const error = await response.json();
        toast.error(`Erro ao ${action} saque`, {
          description: error.message || "Erro desconhecido",
        });
      }
    } catch (err) {
      toast.error("Erro de conexão");
    }
  };

  // ✅ FUNÇÃO PARA EDITAR SALDO - FUNCIONANDO
  const handleUpdateBalance = async (accountId) => {
    console.log("💰 Botão de editar saldo clicado!");
    console.log("🔧 Account ID:", accountId, "Novo saldo:", newBalance);

    if (!newBalance || parseFloat(newBalance) < 0) {
      toast.error("❌ Saldo inválido!", {
        description: "Digite um valor válido maior ou igual a zero",
      });
      return;
    }

    const valorSaldo = parseFloat(newBalance);
    const confirmAction = confirm(
      `💰 ATUALIZAR SALDO\n\n` +
        `Novo valor: ${formatCurrency(valorSaldo)}\n` +
        `Observações: ${balanceNotes || "Atualização manual"}\n\n` +
        `Confirma a atualização?`
    );

    if (!confirmAction) {
      console.log("❌ Usuário cancelou a atualização de saldo");
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
            new_balance: parseFloat(newBalance), // ✅ CORRIGIDO: usar new_balance
            notes: balanceNotes,
            change_reason: "manual_update",
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

  // ✅ FUNÇÃO PARA EDITAR INVESTIMENTO - FUNCIONANDO
  const handleEditInvestment = async () => {
    console.log("🔧 Botão de editar investimento clicado!");

    const valorAtual = planilhaData.summary?.total_investment || 0;
    const novoValor = prompt(
      `💰 Investimento Atual: ${formatCurrency(valorAtual)}\n\n` +
        `Digite o novo valor total investido pelo time:`,
      valorAtual
    );

    if (novoValor === null) {
      console.log("❌ Usuário cancelou a edição");
      return;
    }

    const valor = parseFloat(novoValor);
    if (isNaN(valor) || valor < 0) {
      toast.error("❌ Valor inválido!", {
        description: "Digite um número válido maior que zero",
      });
      return;
    }

    const observacoes = prompt(
      "📝 Observações sobre este investimento (opcional):",
      "Investimento definido manualmente pelo admin"
    );

    console.log("✅ Novo investimento:", valor, "Obs:", observacoes);

    try {
      const response = await fetch(
        `/api/team-investment/user/${userId}/manual`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            investment_amount: valor,
            notes: observacoes,
          }),
        }
      );

      if (response.ok) {
        toast.success("✅ Investimento atualizado!", {
          description: `Novo valor: ${formatCurrency(valor)}`,
          duration: 3000,
        });
        fetchPlanilhaData(); // Recarregar dados para mostrar mudança
      } else {
        const errorData = await response.json();
        toast.error("❌ Erro ao atualizar investimento", {
          description: errorData.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar investimento:", error);
      toast.error("❌ Erro de conexão", {
        description: "Tente novamente em alguns instantes",
      });
    }
  };

  // ✅ NOVA FUNÇÃO: Editar Reloads Manualmente
  const handleEditReloads = async () => {
    const valor = parseFloat(
      prompt(
        "💳 EDITAR RELOADS TOTAL\n\n" +
          `Valor atual: ${formatCurrency(
            derived.approvedReloadsAmount || 0
          )}\n\n` +
          "Digite o novo valor total de reloads:",
        String(derived.approvedReloadsAmount || 0)
      ) || "0"
    );

    if (isNaN(valor) || valor < 0) {
      toast.error("❌ Valor inválido!", {
        description: "Digite um valor válido maior ou igual a zero",
      });
      return;
    }

    const observacoes = prompt(
      "📝 Observações (opcional):",
      "Reloads definidos manualmente pelo admin"
    );

    console.log("✅ Novo valor reloads:", valor, "Obs:", observacoes);

    try {
      const response = await fetch(
        `/api/team-investment/user/${userId}/manual-reload`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            reload_amount: valor,
            notes: observacoes,
          }),
        }
      );

      if (response.ok) {
        toast.success("✅ Reloads atualizados!", {
          description: `Novo valor: ${formatCurrency(valor)}`,
          duration: 3000,
        });
        fetchPlanilhaData(); // Recarregar dados para mostrar mudança
      } else {
        const errorData = await response.json();
        toast.error("❌ Erro ao atualizar reloads", {
          description: errorData.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      console.error("Erro ao atualizar reloads:", error);
      toast.error("❌ Erro de conexão", {
        description: "Tente novamente em alguns instantes",
      });
    }
  };

  // ✅ FUNÇÃO PARA QUITAR RELOADS - FUNCIONANDO
  const handlePaybackReloads = async () => {
    console.log("💸 Botão de quitar reloads clicado!");
    console.log("📊 Valor de reloads:", derived.approvedReloadsAmount);

    if (!(derived.approvedReloadsAmount > 0)) {
      console.log("❌ Nenhum reload para quitar");
      toast.error("❌ Nenhum reload pendente para quitar");
      return;
    }

    const valorReloads = formatCurrency(derived.approvedReloadsAmount);
    const confirmAction = confirm(
      `💸 QUITAR RELOADS\n\n` +
        `Valor: ${valorReloads}\n\n` +
        `⚠️ Esta ação irá:\n` +
        `• Deduzir o valor das contas do jogador\n` +
        `• Reduzir o investimento do time\n` +
        `• Permitir que o jogador solicite saques\n\n` +
        `Confirma a quitação?`
    );

    if (!confirmAction) {
      console.log("❌ Usuário cancelou a quitação");
      return;
    }

    console.log("✅ Quitação confirmada!");

    try {
      const response = await fetch("/api/reload-payback/payback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          user_id: userId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("✅ Reload quitado com sucesso!", {
          description: `${valorReloads} foi processado`,
          duration: 3000,
        });
        fetchPlanilhaData(); // Recarregar dados para mostrar mudança
      } else {
        const errorData = await response.json();
        toast.error("❌ Erro ao quitar reload", {
          description: errorData.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      console.error("Erro ao quitar reload:", error);
      toast.error("❌ Erro de conexão", {
        description: "Tente novamente em alguns instantes",
      });
    }

    // 🚨 CÓDIGO REMOVIDO - API IMPLEMENTADA ACIMA:
    //   body: JSON.stringify({ user_id: userId })
    // }).then(() => fetchPlanilhaData())
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

  // Ordem canônica de plataformas: PS → GG → YA → PP → 888 → Luxon (Luxon por último)
  const normalizePlatformKey = (name) => {
    const n = String(name || "").toLowerCase();
    if (n.includes("pokerstars") || n === "ps") return "ps";
    if (n.includes("gg")) return "gg";
    if (n.includes("ya")) return "ya";
    if (n.includes("party") || n.includes("pp")) return "pp";
    if (n.includes("888")) return "888";
    if (n.includes("luxon")) return "luxon";
    return n || "other";
  };

  const canonicalOrder = ["ps", "gg", "ya", "pp", "888", "luxon", "other"];

  const sortedAccounts = (
    planilhaData.all_platform_accounts ||
    planilhaData.accounts ||
    []
  )
    .slice()
    .sort((a, b) => {
      const ak = normalizePlatformKey(a.platform_name);
      const bk = normalizePlatformKey(b.platform_name);
      const ai = canonicalOrder.indexOf(ak);
      const bi = canonicalOrder.indexOf(bk);
      return ai - bi;
    });

  // 🚨 CORREÇÃO CRÍTICA: Usar dados corretos do backend que já inclui lógica de reloads
  const derived = (() => {
    // Backend já calcula P&L correto (saldo atual - investimento total com reloads)
    const pnl = Number(planilhaData.summary?.total_pnl || 0);

    // Backend já calcula saldo total (inclui Luxon)
    const totalBalance = Number(
      planilhaData.summary?.total_current_balance || 0
    );

    // Backend já calcula investimento total (inicial + reloads aprovados)
    const totalInvestment = Number(planilhaData.summary?.total_investment || 0);

    // Reloads pendentes (ainda não aprovados) somados ao investimento
    const pendingReloadsSum = (
      planilhaData.pending_requests?.reloads || []
    ).reduce((s, r) => s + Number(r.amount || 0), 0);

    const investedWithPending = totalInvestment + pendingReloadsSum;

    // Reloads já aprovados (separadamente para visualização)
    const approvedReloadsAmount = Number(
      planilhaData.summary?.approved_reload_amount || 0
    );

    return {
      pnl,
      totalBalance,
      investedWithPending,
      totalInvestment,
      approvedReloadsAmount,
    };
  })();

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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 border border-border rounded-lg relative">
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                💰 Total Investido
                {/* 🚨 NOVO: Botão de edição para admin */}
                {userRole === "admin" && (
                  <Button
                    size="sm"
                    onClick={handleEditInvestment}
                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 h-6"
                    title="Editar investimento total"
                  >
                    ✏️
                  </Button>
                )}
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(derived.totalInvestment)}
              </div>

              {/* 🚨 NOVO: Indicador se é manual ou automático */}
              {planilhaData.summary?.is_manual_investment && (
                <div className="text-xs text-blue-600 mt-1 font-medium">
                  📝 Definido manualmente
                </div>
              )}

              {/* 🚨 NOVO: Mostrar reloads separadamente na nova aba */}
              {!planilhaData.summary?.is_manual_investment &&
                derived.approvedReloadsAmount > 0 && (
                  <div className="text-xs text-orange-600 mt-1 font-medium">
                    + {formatCurrency(derived.approvedReloadsAmount)} reloads
                  </div>
                )}
            </div>

            {/* 🚨 NOVO: Card de Reload Manual (como Total Investido) */}
            <div className="text-center p-4 border border-border rounded-lg relative">
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                🔄 Reloads
                {/* Botão de edição manual para admin */}
                {userRole === "admin" && (
                  <Button
                    size="sm"
                    onClick={handleEditReloads}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 h-6"
                    title="Editar reloads total"
                  >
                    ✏️
                  </Button>
                )}
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(derived.approvedReloadsAmount || 0)}
              </div>

              {/* Indicador de que pode ser editado manualmente */}
              {userRole === "admin" && (
                <div className="text-xs text-orange-600 mt-1 font-medium">
                  📝 Editável manualmente
                </div>
              )}
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-sm text-muted-foreground">
                📊 Saldo Atual
              </div>
              <div className="text-2xl font-bold invictus-gold">
                {formatCurrency(derived.totalBalance)}
              </div>
            </div>
            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-sm text-muted-foreground">📈 P&L Total</div>
              <div
                className={`text-2xl font-bold flex items-center justify-center space-x-1 ${
                  derived.pnl >= 0 ? "status-complete" : "status-critical"
                }`}
              >
                {derived.pnl >= 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                <span>{formatCurrency(derived.pnl)}</span>
              </div>
            </div>

            <div className="text-center p-4 border border-border rounded-lg">
              <div className="text-sm text-muted-foreground">🏦 Contas</div>
              <div className="text-2xl font-bold text-primary">
                {planilhaData.summary.active_accounts} /{" "}
                {planilhaData.summary.accounts_count}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Ativas / Total
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🚨 ALERTA DE RELOADS PENDENTES (SOMENTE PARA ADMIN/MANAGER) */}
      {derived.approvedReloadsAmount > 0 &&
        (userRole === "admin" || userRole === "manager") && (
          <Alert className="border-orange-400/50 bg-orange-50/60 dark:bg-orange-950/20">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-600 dark:text-orange-400">
              <div className="font-semibold text-orange-700 dark:text-orange-300 mb-2">
                ⚠️ Reload Pendente de Quitação
              </div>
              Você tem{" "}
              <strong>{formatCurrency(derived.approvedReloadsAmount)}</strong>{" "}
              em reload não quitado.
              <br />
              <strong>Deve quitar antes de solicitar saque.</strong>
              <br />
              <Button
                size="sm"
                className="mt-2 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm font-medium"
                onClick={handlePaybackReloads}
              >
                🔄 Quitar Reload Agora
              </Button>
            </AlertDescription>
          </Alert>
        )}

      {/* 🚨 NOVA: Aba Separada de Reloads Aprovados */}
      {planilhaData.summary?.approved_reload_amount > 0 && (
        <Card id="reloads-section" className="border-muted">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                🔄 <span className="text-primary">Reloads Aprovados</span>
              </span>
              {userRole === "admin" && (
                <Button
                  size="sm"
                  onClick={handlePaybackReloads}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  💸 Quitar Reloads
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              Reloads vinculados ao investimento total -{" "}
              {userRole === "admin" ? "clique para quitar" : "aguardando admin"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-b from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="text-sm text-green-700 dark:text-green-300 font-medium mb-2">
                  💰 Total de Reloads
                </div>
                <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {formatCurrency(
                    planilhaData.summary?.approved_reload_amount || 0
                  )}
                </div>
              </div>

              <div className="text-center p-4 bg-gradient-to-b from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                  📊 Impacto no Investimento
                </div>
                <div className="text-lg font-bold text-blue-800 dark:text-blue-200">
                  {planilhaData.summary?.is_manual_investment
                    ? "📝 Manual"
                    : `+${formatCurrency(
                        planilhaData.summary?.approved_reload_amount || 0
                      )}`}
                </div>
              </div>

              <div className="text-center p-4 bg-gradient-to-b from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <div className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-2">
                  ⚠️ Status
                </div>
                <div className="text-lg font-bold text-amber-800 dark:text-amber-200">
                  {userRole === "admin"
                    ? "⏳ Pendente quitação"
                    : "⏱️ Aguardando admin"}
                </div>
              </div>
            </div>

            {userRole !== "admin" && (
              <Alert className="mt-4 border-primary/20 bg-primary/5 dark:bg-primary/10">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">
                  <strong>ℹ️ Informação:</strong> Você não pode solicitar saques
                  enquanto houver reloads não quitados. Aguarde o administrador
                  processar a quitação.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pendências e Solicitações da Planilha */}
      {(planilhaData.pending_requests.reloads.length > 0 ||
        planilhaData.pending_requests.withdrawals.length > 0 ||
        planilhaData.accounts.some((acc) => acc.needs_update)) && (
        <Card id="solicitacoes-section">
          <CardHeader>
            <CardTitle className="status-pending">
              ⚠️ Pendências e Solicitações
            </CardTitle>
            <CardDescription>
              Solicitações pendentes e dados que precisam de atenção
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Solicitações de Reload Detalhadas */}
              {planilhaData.pending_requests.reloads.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-amber-600 flex items-center gap-2">
                    📤 Solicitações de Reload (
                    {planilhaData.pending_requests.reloads.length})
                  </h4>
                  {planilhaData.pending_requests.reloads.map((reload) => (
                    <div
                      key={reload.id}
                      className="border border-amber-200 rounded-lg p-4 bg-amber-50 dark:bg-amber-950 dark:border-amber-800"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 space-y-1">
                          <div className="text-sm text-muted-foreground">
                            Reload - {reload.platform_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Solicitado em{" "}
                            {new Date(reload.created_at).toLocaleDateString(
                              "pt-BR"
                            )}
                          </div>
                          {reload.notes && (
                            <div className="text-sm">
                              <strong>Observações:</strong> {reload.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-lg">
                            {formatCurrency(reload.amount)}
                          </div>
                        </div>
                      </div>
                      {(userRole === "admin" || userRole === "manager") && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white border-green-400"
                            onClick={() =>
                              handleReloadAction(reload.id, "approve")
                            }
                          >
                            ✅ Aprovar
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-500 hover:bg-red-600 text-white border-red-400"
                            onClick={() =>
                              handleReloadAction(reload.id, "reject")
                            }
                          >
                            ❌ Rejeitar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Solicitações de Saque Detalhadas */}
              {planilhaData.pending_requests.withdrawals.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-blue-600 flex items-center gap-2">
                    📥 Solicitações de Saque (
                    {planilhaData.pending_requests.withdrawals.length})
                  </h4>
                  {planilhaData.pending_requests.withdrawals.map(
                    (withdrawal) => (
                      <div
                        key={withdrawal.id}
                        className="border border-blue-200 rounded-lg p-4 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-1">
                            <div className="text-sm text-muted-foreground">
                              Saque - {withdrawal.platform_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Solicitado em{" "}
                              {new Date(
                                withdrawal.created_at
                              ).toLocaleDateString("pt-BR")}
                            </div>
                            {withdrawal.notes && (
                              <div className="text-sm">
                                <strong>Observações:</strong> {withdrawal.notes}
                              </div>
                            )}
                            <div className="text-sm">
                              <strong>Status:</strong>{" "}
                              <Badge variant="secondary">
                                {withdrawal.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-lg">
                              {formatCurrency(withdrawal.amount)}
                            </div>
                          </div>
                        </div>
                        {(userRole === "admin" || userRole === "manager") && (
                          <div className="flex gap-2 mt-3">
                            {withdrawal.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-green-500 hover:bg-green-600 text-white border-green-400"
                                  onClick={() =>
                                    handleWithdrawalAction(
                                      withdrawal.id,
                                      "approve"
                                    )
                                  }
                                >
                                  ✅ Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-red-500 hover:bg-red-600 text-white border-red-400"
                                  onClick={() =>
                                    handleWithdrawalAction(
                                      withdrawal.id,
                                      "reject"
                                    )
                                  }
                                >
                                  ❌ Rejeitar
                                </Button>
                              </>
                            )}
                            {withdrawal.status === "approved" && (
                              <Button
                                size="sm"
                                className="bg-blue-500 hover:bg-blue-600 text-white border-blue-400"
                                onClick={() =>
                                  handleWithdrawalAction(
                                    withdrawal.id,
                                    "complete"
                                  )
                                }
                              >
                                🏁 Marcar como Concluído
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Alertas de Saldos Desatualizados */}
              {planilhaData.accounts.some((acc) => acc.needs_update) && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Alguns saldos precisam ser atualizados há mais de 24 horas
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
                {sortedAccounts.map((account) => (
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

      {/* Evolução do Bankroll (30 dias) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg gradient-gold-text">
            📈 Evolução do Bankroll (30 dias)
          </CardTitle>
          <CardDescription>
            Histórico de evolução do bankroll nas últimas 4 semanas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankrollChart playerId={userId} />
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
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">⚡</div>
              <span>Ações Rápidas</span>
            </CardTitle>
            <CardDescription>
              Acesse rapidamente as funcionalidades mais usadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                onClick={onRequestReload}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-3 border-2 border-muted hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all duration-200 group"
              >
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors">
                  <Upload className="w-5 h-5 text-green-700 dark:text-green-400" />
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:text-green-700 dark:group-hover:text-green-300">
                  Solicitar Reload
                </span>
              </Button>
              <Button
                onClick={onRequestWithdrawal}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-3 border-2 border-muted hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-200 group"
              >
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                  <Download className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300">
                  Solicitar Saque
                </span>
              </Button>
              <Button
                onClick={fetchPlanilhaData}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center space-y-3 border-2 border-muted hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all duration-200 group"
              >
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30 group-hover:bg-amber-200 dark:group-hover:bg-amber-800/40 transition-colors">
                  <RefreshCw className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-300">
                  Atualizar
                </span>
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

      {/* Calendário de Preenchimento (últimos 30 dias) - Popover */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg gradient-gold-text flex items-center gap-2">
            📅 Calendário de Preenchimento
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              <Calendar className="w-4 h-4 mr-1" />
              {showCalendar ? "Ocultar" : "Ver Calendário"}
            </Button>
          </CardTitle>
          <CardDescription>
            Rastreamento de preenchimento de dados nos últimos 30 dias
          </CardDescription>
        </CardHeader>
        {showCalendar && (
          <CardContent>
            <CalendarTracker playerId={userId} />
          </CardContent>
        )}
      </Card>

      {/* 🚨 REMOVIDO: Sistema de templates - agora aprovação é direta */}

      {/* 🚨 REMOVIDO: Modais desnecessários - agora tudo é direto com confirm() */}
    </div>
  );
};

export default Planilha;
