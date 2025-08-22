import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

const PlatformAccountsView = ({ playerId }) => {
  const [platformsData, setPlatformsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (playerId) {
      fetchAccountsByPlatform();
    }
  }, [playerId]);

  const fetchAccountsByPlatform = async () => {
    try {
      const response = await fetch(
        `/api/users/${playerId}/accounts-by-platform`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPlatformsData(data.platforms || []);
      }
    } catch (err) {
      console.error("Erro ao carregar contas por plataforma:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const getStatusColor = (profitLoss) => {
    if (profitLoss > 0) return "text-green-400";
    if (profitLoss < 0) return "text-red-400";
    return "text-gray-400";
  };

  const getStatusIcon = (profitLoss) => {
    if (profitLoss > 0)
      return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (profitLoss < 0)
      return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <BarChart3 className="w-4 h-4 text-gray-400" />;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      profit: { variant: "default", label: "Lucro" },
      loss: { variant: "destructive", label: "Prejuízo" },
      even: { variant: "secondary", label: "Neutro" },
      unknown: { variant: "outline", label: "Indefinido" },
    };

    const config = statusMap[status] || statusMap.unknown;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p>Carregando contas por plataforma...</p>
      </div>
    );
  }

  if (platformsData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <DollarSign className="w-12 h-12 mx-auto mb-4" />
        <p>Nenhuma conta encontrada para este jogador</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo por Plataforma */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platformsData.map((platform) => {
          const totalProfitLoss =
            platform.total_balance - platform.total_initial;

          return (
            <Card
              key={platform.platform_id}
              className="border border-gray-600 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl"
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    {platform.platform_name === "PokerStars" && "♠️"}
                    {platform.platform_name === "GGPoker" && "♦️"}
                    {platform.platform_name === "PartyPoker" && "♣️"}
                    {platform.platform_name === "888poker" && "♥️"}
                    {platform.platform_name === "LuxonPay" && "💳"}
                    <span className="gradient-gold-text">
                      {platform.platform_name}
                    </span>
                  </CardTitle>
                  {getStatusIcon(totalProfitLoss)}
                </div>
                <CardDescription className="text-gray-400 font-medium">
                  {platform.accounts.length} conta(s) ativa(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/30 p-4 rounded-lg border border-blue-500/30">
                  <div className="text-center">
                    <p className="text-sm text-blue-300 font-medium mb-1">
                      💰 Saldo Total
                    </p>
                    <p className="text-xl font-bold text-blue-400">
                      {formatCurrency(platform.total_balance)}
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/30 p-4 rounded-lg border border-purple-500/30">
                  <div className="text-center">
                    <p className="text-sm text-purple-300 font-medium mb-1">
                      💎 Investimento
                    </p>
                    <p className="text-xl font-bold text-purple-400">
                      {formatCurrency(platform.total_initial)}
                    </p>
                  </div>
                </div>

                <div
                  className={`p-4 rounded-lg border text-center ${
                    totalProfitLoss >= 0
                      ? "bg-gradient-to-r from-green-900/30 to-green-800/30 border-green-500/30"
                      : "bg-gradient-to-r from-red-900/30 to-red-800/30 border-red-500/30"
                  }`}
                >
                  <p
                    className={`text-sm font-medium mb-1 ${
                      totalProfitLoss >= 0 ? "text-green-300" : "text-red-300"
                    }`}
                  >
                    📈 P&L
                  </p>
                  <p
                    className={`text-xl font-bold ${getStatusColor(
                      totalProfitLoss
                    )}`}
                  >
                    {totalProfitLoss > 0 ? "+" : ""}
                    {formatCurrency(totalProfitLoss)}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-yellow-900/30 to-yellow-800/30 p-4 rounded-lg border border-yellow-500/30">
                  <div className="text-center">
                    <p className="text-sm text-yellow-300 font-medium mb-1">
                      📊 ROI
                    </p>
                    <p
                      className={`text-xl font-bold ${getStatusColor(
                        totalProfitLoss
                      )}`}
                    >
                      {platform.total_initial > 0
                        ? `${(
                            (totalProfitLoss / platform.total_initial) *
                            100
                          ).toFixed(1)}%`
                        : "0%"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detalhes por Plataforma */}
      {platformsData.map((platform) => (
        <Card key={`details-${platform.platform_id}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              {platform.platform_name} - Contas Detalhadas
            </CardTitle>
            <CardDescription>
              Informações detalhadas de cada conta na plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome da Conta</TableHead>
                  <TableHead>Saldo Atual</TableHead>
                  <TableHead>Investimento</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>ROI</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platform.accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <div className="font-medium">{account.account_name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {formatCurrency(account.current_balance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(account.initial_balance)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${getStatusColor(
                          account.profit_loss
                        )}`}
                      >
                        {account.profit_loss > 0 ? "+" : ""}
                        {formatCurrency(account.profit_loss)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${getStatusColor(
                          account.profit_loss
                        )}`}
                      >
                        {account.initial_balance > 0
                          ? `${(
                              (account.profit_loss / account.initial_balance) *
                              100
                            ).toFixed(1)}%`
                          : "0%"}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(account.status)}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {account.last_update
                          ? new Date(account.last_update).toLocaleDateString(
                              "pt-BR"
                            )
                          : "Não informado"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PlatformAccountsView;
