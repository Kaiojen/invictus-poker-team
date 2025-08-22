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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Plus,
  Archive,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  RefreshCw,
  Download,
} from "lucide-react";
import { toast } from "sonner";

const TeamMonthlySnapshots = ({ user }) => {
  const [snapshots, setSnapshots] = useState([]);
  const [currentData, setCurrentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [yearsAvailable, setYearsAvailable] = useState([]);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Form states
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [notes, setNotes] = useState("");
  const [isClosedMonth, setIsClosedMonth] = useState(false);

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

  useEffect(() => {
    fetchSnapshots();
    fetchCurrentData();
  }, [selectedYear]);

  const fetchSnapshots = async () => {
    try {
      const response = await fetch(`/api/team/monthly?year=${selectedYear}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSnapshots(data.snapshots || []);
        setYearsAvailable(data.years_available || [selectedYear]);
      }
    } catch (error) {
      console.error("Erro ao carregar snapshots:", error);
      toast.error("Erro ao carregar histórico mensal");
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentData = async () => {
    try {
      const response = await fetch("/api/team/monthly/current", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentData(data);
      }
    } catch (error) {
      console.error("Erro ao carregar dados atuais:", error);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!selectedMonth || !selectedYear) {
      toast.error("Selecione mês e ano");
      return;
    }

    setCreateLoading(true);

    try {
      const response = await fetch("/api/team/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          month: selectedMonth,
          year: selectedYear,
          is_closed: isClosedMonth,
          notes: notes.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Snapshot mensal criado com sucesso!");
        setShowCreateModal(false);
        resetForm();
        fetchSnapshots();
        fetchCurrentData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Erro ao criar snapshot");
      }
    } catch (error) {
      console.error("Erro ao criar snapshot:", error);
      toast.error("Erro de conexão");
    } finally {
      setCreateLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedMonth(new Date().getMonth() + 1);
    setNotes("");
    setIsClosedMonth(false);
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("pt-BR");

  const getMonthName = (month) =>
    months.find((m) => m.value === month)?.label || month;

  const getStatusColor = (snapshot) => {
    if (snapshot.is_closed) return "bg-green-100 text-green-800";
    return "bg-yellow-100 text-yellow-800";
  };

  const getPerformanceColor = (pnl) => {
    if (pnl > 0) return "text-green-600";
    if (pnl < 0) return "text-red-600";
    return "text-gray-600";
  };

  // ✅ FUNÇÃO PARA DOWNLOAD DIRETO DO RELATÓRIO MENSAL (EXATAMENTE como ReportManagement.jsx)
  const downloadMonthlyReport = async (month, year) => {
    const snapshotId = `${month}-${year}`;
    setDownloadingReport(snapshotId);

    try {
      const response = await fetch(
        `/api/reports/monthly-detailed?month=${month}&year=${year}&format=pdf`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const contentDisposition = response.headers.get("content-disposition");
        const filename = contentDisposition
          ? contentDisposition.split("filename=")[1].replace(/"/g, "")
          : `relatorio_mensal_detalhado_${year}_${month
              .toString()
              .padStart(2, "0")}.pdf`;

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        toast.success("Relatório gerado com sucesso!", {
          description: `Download do arquivo ${filename} iniciado`,
        });
      } else {
        const error = await response.json();
        toast.error("Erro ao gerar relatório", {
          description: error.error,
        });
      }
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      toast.error("Erro de conexão");
    } finally {
      setDownloadingReport(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2">Carregando histórico mensal...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Snapshots Mensais do Time
              </CardTitle>
              <CardDescription>
                Controle histórico do saldo total e estatísticas mensais
              </CardDescription>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearsAvailable.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {user.role === "admin" && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowPreviewModal(true)}
                    disabled={!currentData}
                    className="flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Preview Mês Atual
                  </Button>

                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="gradient-gold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Snapshot
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum snapshot encontrado para {selectedYear}</p>
              <p className="text-sm">
                Crie o primeiro snapshot para começar o controle mensal
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Saldo Total</TableHead>
                    <TableHead>P&L</TableHead>
                    <TableHead>Jogadores</TableHead>
                    <TableHead>Contas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Relatório</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((snapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell className="font-medium">
                        {getMonthName(snapshot.month)} {snapshot.year}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium invictus-gold">
                          {formatCurrency(snapshot.total_balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {snapshot.total_pnl > 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : snapshot.total_pnl < 0 ? (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          ) : null}
                          <span
                            className={`font-medium ${getPerformanceColor(
                              snapshot.total_pnl
                            )}`}
                          >
                            {formatCurrency(snapshot.total_pnl)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{snapshot.active_players}</span>
                          <span className="text-xs text-muted-foreground">
                            ({snapshot.profitable_players} lucrativos)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{snapshot.total_accounts}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(snapshot)}>
                          {snapshot.is_closed ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Fechado
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 mr-1" />
                              Aberto
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(snapshot.created_at)}
                      </TableCell>
                      <TableCell>
                        {/* ✅ DOWNLOAD DIRETO DO RELATÓRIO DETALHADO */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadMonthlyReport(snapshot.month, snapshot.year)
                          }
                          disabled={
                            downloadingReport ===
                            `${snapshot.month}-${snapshot.year}`
                          }
                          className="flex items-center gap-1"
                          title="Baixar relatório detalhado em PDF"
                        >
                          {downloadingReport ===
                          `${snapshot.month}-${snapshot.year}` ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Preview Mês Atual */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl snapshot-modal-fix">
          <DialogHeader>
            <DialogTitle className="text-gray-900 font-semibold text-lg">
              📊 Preview do Mês Atual
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Dados atuais que serão salvos no snapshot mensal
            </DialogDescription>
          </DialogHeader>

          {currentData && (
            <div className="space-y-6">
              {/* Cards organizados em grid melhorado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl">
                  <div className="text-sm font-medium text-blue-800 mb-2">
                    💰 Saldo Total
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatCurrency(currentData.current_data.total_balance)}
                  </div>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl">
                  <div className="text-sm font-medium text-green-800 mb-2">
                    📈 P&L Total
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      currentData.current_data.total_pnl >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {formatCurrency(currentData.current_data.total_pnl)}
                  </div>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl">
                  <div className="text-sm font-medium text-purple-800 mb-2">
                    👥 Jogadores
                  </div>
                  <div className="text-2xl font-bold text-purple-900">
                    {currentData.current_data.active_players}
                  </div>
                </div>

                <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl">
                  <div className="text-sm font-medium text-orange-800 mb-2">
                    🏦 Contas
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {currentData.current_data.total_accounts}
                  </div>
                </div>
              </div>

              {currentData.has_snapshot && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-800 font-medium">
                    ⚠️ Já existe um snapshot para {currentData.period}
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Criado em{" "}
                    {formatDate(currentData.existing_snapshot.created_at)}
                  </p>
                </div>
              )}

              {/* Informações adicionais organizadas */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                  📋 Resumo do Período
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Período:</span>
                    <span className="text-gray-900 font-medium">
                      {currentData.period}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data atual:</span>
                    <span className="text-gray-900 font-medium">
                      {formatDate(new Date())}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewModal(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar Snapshot */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="snapshot-modal-fix bg-gray-800">
          <DialogHeader>
            <DialogTitle className="gradient-gold-text text-xl">
              📊 Criar Snapshot Mensal
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Salvar estado atual do time para controle histórico
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-200 font-medium flex items-center gap-2">
                  📅 Mês
                </Label>
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(value) => setSelectedMonth(parseInt(value))}
                >
                  <SelectTrigger className="bg-gray-700 border-2 border-yellow-500 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-yellow-500">
                    {months.map((month) => (
                      <SelectItem
                        key={month.value}
                        value={month.value.toString()}
                        className="text-white hover:bg-gray-700"
                      >
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-200 font-medium flex items-center gap-2">
                  🗓️ Ano
                </Label>
                <Input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  min="2020"
                  max="2030"
                  className="bg-gray-700 border-2 border-yellow-500 text-white"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_closed"
                className="checkbox-fix"
                checked={isClosedMonth}
                onChange={(e) => setIsClosedMonth(e.target.checked)}
              />
              <Label htmlFor="is_closed" className="text-gray-200 font-medium">
                🔒 Marcar mês como fechado
              </Label>
            </div>

            <div>
              <Label className="text-gray-200 font-medium flex items-center gap-2">
                📝 Observações (opcional)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre o fechamento mensal..."
                rows={3}
                className="bg-gray-700 border-2 border-yellow-500 text-white placeholder:text-gray-400 focus:border-yellow-400 resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              className="bg-gray-600 border-gray-500 text-gray-200 hover:bg-gray-500 hover:text-white"
            >
              ❌ Cancelar
            </Button>
            <Button
              onClick={handleCreateSnapshot}
              disabled={createLoading}
              className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-semibold border border-yellow-400"
            >
              {createLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  📊 Criando...
                </>
              ) : (
                "📊 Criar Snapshot"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamMonthlySnapshots;
