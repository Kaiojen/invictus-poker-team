import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";

const MonthlyReportButton = ({ user }) => {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const months = [
    { value: 1, label: "Janeiro" },
    { value: 2, label: "Fevereiro" },
    { value: 3, label: "Março" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Maio" },
    { value: 6, label: "Junho" },
    { value: 7, label: "Julho" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" },
    { value: 11, label: "Novembro" },
    { value: 12, label: "Dezembro" },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/reports/monthly-detailed?month=${selectedMonth}&year=${selectedYear}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReportData(data);
        toast.success("✅ Relatório gerado com sucesso!");
      } else {
        const error = await response.json();
        toast.error("❌ Erro ao gerar relatório", {
          description: error.error || "Erro desconhecido",
        });
      }
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("❌ Erro de conexão", {
        description: "Tente novamente em alguns instantes",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async (format = "json") => {
    try {
      const response = await fetch(
        `/api/reports/monthly-detailed?month=${selectedMonth}&year=${selectedYear}&format=${format}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const filename = `relatorio_mensal_${selectedYear}_${selectedMonth
          .toString()
          .padStart(2, "0")}.${format}`;

        if (format === "json") {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          // PDF or other formats
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }

        toast.success("✅ Relatório baixado com sucesso!");
      } else {
        toast.error("❌ Erro ao baixar relatório");
      }
    } catch (error) {
      console.error("Erro ao baixar relatório:", error);
      toast.error("❌ Erro ao baixar arquivo");
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          📄 Relatório Detalhado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            📊 Relatório Mensal Detalhado
          </DialogTitle>
          <DialogDescription>
            Relatório detalhado com lucros, jogadores lucrativos, saldos por
            plataforma, total de saques/reloads/investimentos e métricas
            completas do time
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Seleção de Período */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mês</label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem
                      key={month.value}
                      value={month.value.toString()}
                    >
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão Gerar Preview */}
          <div className="flex justify-center">
            <Button
              onClick={generateReport}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Gerando..." : "📊 Gerar Preview"}
            </Button>
          </div>

          {/* Preview dos Dados */}
          {reportData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    📅 {reportData.period.month_name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Resumo Financeiro Principal */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">
                          💰 Total Reloads
                        </div>
                        <div className="text-xl font-bold text-green-700 dark:text-green-300">
                          {formatCurrency(
                            reportData.financial_summary.total_reloads
                          )}
                        </div>
                      </div>

                      <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
                          💸 Total Saques
                        </div>
                        <div className="text-xl font-bold text-red-700 dark:text-red-300">
                          {formatCurrency(
                            reportData.financial_summary.total_withdrawals
                          )}
                        </div>
                      </div>

                      <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-2">
                          🏦 Total Investimento
                        </div>
                        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                          {formatCurrency(
                            reportData.financial_summary.total_team_investment
                          )}
                        </div>
                      </div>

                      <div
                        className={`text-center p-4 rounded-lg border ${
                          reportData.financial_summary.team_net_result >= 0
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                            : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                        }`}
                      >
                        <div
                          className={`text-sm font-medium mb-2 ${
                            reportData.financial_summary.team_net_result >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-orange-600 dark:text-orange-400"
                          }`}
                        >
                          🎯 Lucro do Time
                        </div>
                        <div
                          className={`text-xl font-bold ${
                            reportData.financial_summary.team_net_result >= 0
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-orange-700 dark:text-orange-300"
                          }`}
                        >
                          {formatCurrency(
                            Math.abs(
                              reportData.financial_summary.team_net_result
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Jogadores Lucrativos */}
                    {reportData.profitable_players &&
                      reportData.profitable_players.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">
                              🏆 Jogadores Lucrativos (
                              {reportData.statistics.profitable_players_count})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {reportData.profitable_players
                                .slice(0, 6)
                                .map((player, index) => (
                                  <div
                                    key={index}
                                    className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/20 rounded-lg"
                                  >
                                    <span className="font-medium">
                                      {player.name}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-green-600"
                                    >
                                      {formatCurrency(player.pnl)}
                                    </Badge>
                                  </div>
                                ))}
                            </div>
                            {reportData.profitable_players.length > 6 && (
                              <p className="text-sm text-muted-foreground mt-2 text-center">
                                +{reportData.profitable_players.length - 6}{" "}
                                outros jogadores lucrativos
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      )}

                    {/* Saldos por Plataforma */}
                    {reportData.platform_balances && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            🏦 Saldos por Plataforma
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(reportData.platform_balances).map(
                              ([platform, data]) => (
                                <div
                                  key={platform}
                                  className="p-3 border border-border rounded-lg"
                                >
                                  <div className="font-medium mb-2">
                                    {platform}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-sm">
                                    <div>
                                      <div className="text-muted-foreground">
                                        Saldo
                                      </div>
                                      <div className="font-medium">
                                        {formatCurrency(data.balance)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">
                                        Investido
                                      </div>
                                      <div className="font-medium">
                                        {formatCurrency(data.investment)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">
                                        P&L
                                      </div>
                                      <div
                                        className={`font-medium ${
                                          data.pnl >= 0
                                            ? "text-green-600"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {formatCurrency(data.pnl)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Fechar
          </Button>
          {reportData && (
            <>
              <Button
                onClick={() => downloadReport("json")}
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Download JSON
              </Button>
              <Button
                onClick={() => downloadReport("pdf")}
                className="bg-red-600 hover:bg-red-700"
                disabled
                title="PDF em desenvolvimento"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MonthlyReportButton;
