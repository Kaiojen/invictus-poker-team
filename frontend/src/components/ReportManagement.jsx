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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Calendar,
  Users,
  Target,
  Eye,
  FileSpreadsheet,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const ReportManagement = ({ user }) => {
  const [availableReports, setAvailableReports] = useState([]);
  const [availableRetas, setAvailableRetas] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Filtros do relatório
  const [reportType, setReportType] = useState("player");
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedReta, setSelectedReta] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState("pdf");

  useEffect(() => {
    fetchAvailableReports();
    fetchPlayers();
    setDefaultDates();
  }, []);

  const setDefaultDates = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    setEndDate(today.toISOString().split("T")[0]);
    setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
  };

  const fetchAvailableReports = async () => {
    try {
      const response = await fetch("/api/reports/available", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableReports(data.available_reports);
        setAvailableRetas(data.available_retas);
      } else {
        toast.error("Erro ao carregar tipos de relatórios");
      }
    } catch (error) {
      console.error("Erro ao buscar relatórios:", error);
      toast.error("Erro de conexão");
    }
  };

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users?role=player", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPlayers(data.users || []);

        // Se for jogador, selecionar automaticamente
        if (user.role === "player") {
          setSelectedPlayer(user.id.toString());
        }
      }
    } catch (error) {
      console.error("Erro ao buscar jogadores:", error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!startDate || !endDate) {
      toast.error("Datas de início e fim são obrigatórias");
      return false;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      toast.error("Data de início deve ser anterior à data de fim");
      return false;
    }

    const daysDiff =
      (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      toast.error("Período não pode exceder 365 dias");
      return false;
    }

    if (reportType === "player" && !selectedPlayer) {
      toast.error("Selecione um jogador");
      return false;
    }

    if (reportType === "reta" && (!selectedReta || selectedReta === "all")) {
      toast.error("Selecione uma reta");
      return false;
    }

    return true;
  };

  const generateReport = async () => {
    if (!validateForm()) return;

    setGenerating(true);
    try {
      let url = "/api/reports/";
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: format,
      });

      if (reportType === "player") {
        url += `player/${selectedPlayer}`;
      } else if (reportType === "team") {
        url += "team";
        if (selectedReta && selectedReta !== "all") {
          params.append("reta_id", selectedReta);
        }
      } else if (reportType === "reta") {
        url += `reta/${selectedReta}`;
      }

      const response = await fetch(`${url}?${params.toString()}`, {
        credentials: "include",
      });

      if (response.ok) {
        const blob = await response.blob();
        const contentDisposition = response.headers.get("content-disposition");
        const filename = contentDisposition
          ? contentDisposition.split("filename=")[1].replace(/"/g, "")
          : `relatorio_${reportType}_${
              new Date().toISOString().split("T")[0]
            }.${format}`;

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
      setGenerating(false);
    }
  };

  const previewReport = async () => {
    if (!validateForm()) return;

    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });

      if (reportType === "player") {
        params.append("user_id", selectedPlayer);
      } else if (reportType === "reta") {
        params.append("reta_id", selectedReta);
      } else if (
        reportType === "team" &&
        selectedReta &&
        selectedReta !== "all"
      ) {
        params.append("reta_id", selectedReta);
      }

      const response = await fetch(
        `/api/reports/preview/${reportType}?${params.toString()}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
        setShowPreviewDialog(true);
      } else {
        const error = await response.json();
        toast.error("Erro ao gerar preview", {
          description: error.error,
        });
      }
    } catch (error) {
      console.error("Erro ao gerar preview:", error);
      toast.error("Erro de conexão");
    }
  };

  const getReportIcon = (type) => {
    switch (type) {
      case "player":
        return <Users className="w-5 h-5" />;
      case "team":
        return <BarChart3 className="w-5 h-5" />;
      case "reta":
        return <Target className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Carregando relatórios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Gerador de Relatórios</span>
          </CardTitle>
          <CardDescription>
            Gere relatórios detalhados em PDF ou CSV com dados de jogadores,
            time e performance
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Configurações do Relatório */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tipo de Relatório */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableReports.map((report) => {
              const isDisabled =
                (report.type === "player" &&
                  user.role === "player" &&
                  !report.permissions.includes("own")) ||
                ((report.type === "team" || report.type === "reta") &&
                  user.role === "player");

              return (
                <Card
                  key={report.type}
                  className={`cursor-pointer transition-all ${
                    reportType === report.type
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:bg-secondary/50"
                  } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={() => !isDisabled && setReportType(report.type)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      {getReportIcon(report.type)}
                      <div>
                        <h3 className="font-medium">{report.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {report.description}
                        </p>
                        <div className="flex space-x-1 mt-2">
                          {report.formats.map((fmt) => (
                            <Badge
                              key={fmt}
                              variant="outline"
                              className="text-xs"
                            >
                              {fmt.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Filtros Específicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seleção de Jogador */}
            {reportType === "player" && (
              <div className="space-y-2">
                <Label htmlFor="player">Jogador</Label>
                <Select
                  value={selectedPlayer}
                  onValueChange={setSelectedPlayer}
                  disabled={user.role === "player"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um jogador" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map((player) => (
                      <SelectItem key={player.id} value={player.id.toString()}>
                        {player.full_name} (@{player.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seleção de Reta */}
            {(reportType === "team" || reportType === "reta") && (
              <div className="space-y-2">
                <Label htmlFor="reta">
                  {reportType === "reta"
                    ? "Reta (Obrigatório)"
                    : "Reta (Opcional)"}
                </Label>
                <Select value={selectedReta} onValueChange={setSelectedReta}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma reta" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportType === "team" && (
                      <SelectItem value="all">Todas as retas</SelectItem>
                    )}
                    {availableRetas.map((reta) => (
                      <SelectItem key={reta.id} value={reta.id.toString()}>
                        {reta.name} ({reta.description})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Período e Formato */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="format">Formato</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="csv">CSV (Excel)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ações */}
          <div className="flex space-x-3 pt-4 border-t">
            <Button onClick={previewReport} variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              Visualizar Dados
            </Button>
            <Button
              onClick={generateReport}
              disabled={generating}
              className="gradient-gold"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {generating ? "Gerando..." : `Gerar ${format.toUpperCase()}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Preview */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl report-preview">
          <DialogHeader>
            <DialogTitle className="font-semibold">
              Preview dos Dados do Relatório
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Visualização dos dados que serão incluídos no relatório
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Informações Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">
                    Tipo de Relatório
                  </Label>
                  <p className="text-sm">{previewData.report_type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Período</Label>
                  <p className="text-sm">
                    {new Date(previewData.period.start).toLocaleDateString(
                      "pt-BR"
                    )}{" "}
                    -{" "}
                    {new Date(previewData.period.end).toLocaleDateString(
                      "pt-BR"
                    )}
                  </p>
                </div>
              </div>

              {/* Dados Específicos do Relatório */}
              {previewData.report_type === "player" && previewData.player && (
                <div className="text-foreground">
                  <Label className="text-sm font-medium text-foreground">
                    Jogador
                  </Label>
                  <p className="text-sm text-foreground">
                    {previewData.player.full_name} (@
                    {previewData.player.username})
                  </p>
                </div>
              )}

              {previewData.reta && (
                <div className="text-foreground">
                  <Label className="text-sm font-medium text-foreground">
                    Reta
                  </Label>
                  <p className="text-sm text-foreground">
                    {previewData.reta.name}
                  </p>
                </div>
              )}

              {/* Resumo Financeiro */}
              {previewData.summary && (
                <div className="text-foreground">
                  <Label className="text-sm font-medium text-foreground">
                    Resumo Financeiro
                  </Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-foreground">
                    {previewData.summary.current_balance !== undefined && (
                      <div>
                        Saldo Atual:{" "}
                        {formatCurrency(previewData.summary.current_balance)}
                      </div>
                    )}
                    {previewData.summary.total_balance !== undefined && (
                      <div>
                        Saldo Total:{" "}
                        {formatCurrency(previewData.summary.total_balance)}
                      </div>
                    )}
                    {previewData.summary.pnl !== undefined && (
                      <div>P&L: {formatCurrency(previewData.summary.pnl)}</div>
                    )}
                    {previewData.summary.total_pnl !== undefined && (
                      <div>
                        P&L Total:{" "}
                        {formatCurrency(previewData.summary.total_pnl)}
                      </div>
                    )}
                    {previewData.summary.players_count !== undefined && (
                      <div>
                        Total Jogadores: {previewData.summary.players_count}
                      </div>
                    )}
                    {previewData.summary.profitable_players !== undefined && (
                      <div>
                        Jogadores Lucrativos:{" "}
                        {previewData.summary.profitable_players}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contadores */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {previewData.accounts_count !== undefined && (
                  <div>
                    <Label className="text-sm font-medium">Contas</Label>
                    <p>{previewData.accounts_count}</p>
                  </div>
                )}
                {previewData.players_included !== undefined && (
                  <div>
                    <Label className="text-sm font-medium">
                      Jogadores Incluídos
                    </Label>
                    <p>{previewData.players_included}</p>
                  </div>
                )}
                {previewData.transactions_count !== undefined && (
                  <div>
                    <Label className="text-sm font-medium">Transações</Label>
                    <p>{previewData.transactions_count}</p>
                  </div>
                )}
                {previewData.reload_requests_count !== undefined && (
                  <div>
                    <Label className="text-sm font-medium">
                      Solicitações de Reload
                    </Label>
                    <p>{previewData.reload_requests_count}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
              className="cancel-button-fix"
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                setShowPreviewDialog(false);
                generateReport();
              }}
            >
              Gerar Relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportManagement;
