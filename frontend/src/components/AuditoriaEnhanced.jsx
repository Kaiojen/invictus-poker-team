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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

const AuditoriaEnhanced = ({ user }) => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    userId: "all",
    action: "all",
    entity: "all",
    searchTerm: "",
  });
  const [stats, setStats] = useState({
    totalActions: 0,
    criticalActions: 0,
    uniqueUsers: 0,
    todayActions: 0,
  });
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAuditLogs();
    fetchUsers();
    fetchAuditStats();
  }, [currentPage, filters]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: "20",
        ...filters,
      });

      if (filters.action === "all") params.delete("action");
      if (filters.entity === "all") params.delete("entity");
      if (!filters.userId || filters.userId === "all") params.delete("userId");

      const response = await fetch(`/api/audit/logs?${params}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
        setTotalPages(data.pagination?.pages || 1);
      }
    } catch (error) {
      console.error("Erro ao carregar logs de auditoria:", error);
      toast.error("Erro ao carregar logs de auditoria");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  const fetchAuditStats = async () => {
    try {
      const response = await fetch("/api/audit/stats", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const toLowerSafe = (value) =>
    typeof value === "string"
      ? value.toLowerCase()
      : String(value || "").toLowerCase();

  const getActionIcon = (action) => {
    const actionLower = toLowerSafe(action);
    if (actionLower.includes("create"))
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (actionLower.includes("update"))
      return <RefreshCw className="w-4 h-4 text-blue-500" />;
    if (actionLower.includes("delete"))
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    if (actionLower.includes("approve"))
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (actionLower.includes("reject"))
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <Eye className="w-4 h-4 text-gray-500" />;
  };

  const getActionBadge = (action) => {
    const actionLower = toLowerSafe(action);
    if (actionLower.includes("create"))
      return <Badge className="bg-green-100 text-green-800">Criação</Badge>;
    if (actionLower.includes("update"))
      return <Badge className="bg-blue-100 text-blue-800">Atualização</Badge>;
    if (actionLower.includes("delete"))
      return <Badge className="bg-red-100 text-red-800">Exclusão</Badge>;
    if (actionLower.includes("approve"))
      return <Badge className="bg-green-100 text-green-800">Aprovação</Badge>;
    if (actionLower.includes("reject"))
      return <Badge className="bg-red-100 text-red-800">Rejeição</Badge>;
    return <Badge variant="outline">{action || "-"}</Badge>;
  };

  const getCriticalityLevel = (action, entity) => {
    const criticalActions = ["delete", "approve", "reject", "transfer"];
    const criticalEntities = ["user", "transaction", "reload_request"];

    const actionLower = toLowerSafe(action);
    const entityLower = toLowerSafe(entity);

    if (
      criticalActions.some((a) => actionLower.includes(a)) ||
      criticalEntities.some((e) => entityLower.includes(e))
    ) {
      return "high";
    }

    if (actionLower.includes("update")) {
      return "medium";
    }

    return "low";
  };

  const exportAuditReport = async () => {
    try {
      const params = new URLSearchParams(filters);
      if (filters.action === "all") params.delete("action");
      if (filters.entity === "all") params.delete("entity");
      if (!filters.userId || filters.userId === "all") params.delete("userId");
      const response = await fetch(`/api/audit/export?${params}`, {
        credentials: "include",
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `audit-report-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Relatório exportado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao exportar relatório:", error);
      toast.error("Erro ao exportar relatório");
    }
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      userId: "all",
      action: "all",
      entity: "all",
      searchTerm: "",
    });
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold gradient-gold-text flex items-center space-x-3">
            <Shield className="w-8 h-8" />
            <span>Auditoria do Sistema</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitoramento completo de ações e alterações no sistema
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={fetchAuditLogs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button onClick={exportAuditReport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Estatísticas de Auditoria */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Ações
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold invictus-gold">
              {stats.totalActions}
            </div>
            <p className="text-xs text-muted-foreground">
              Todas as ações registradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ações Críticas
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stats.criticalActions}
            </div>
            <p className="text-xs text-muted-foreground">
              Requerem atenção especial
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Usuários Ativos
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {stats.uniqueUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              Com ações no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ações Hoje</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {stats.todayActions}
            </div>
            <p className="text-xs text-muted-foreground">Ações de hoje</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros Avançados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filtros Avançados</span>
          </CardTitle>
          <CardDescription>
            Filtre os logs de auditoria por período, usuário, ação ou entidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="userId">Usuário</Label>
              <Select
                value={filters.userId}
                onValueChange={(value) =>
                  setFilters({ ...filters, userId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os usuários" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="action">Ação</Label>
              <Select
                value={filters.action}
                onValueChange={(value) =>
                  setFilters({ ...filters, action: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="create">Criação</SelectItem>
                  <SelectItem value="update">Atualização</SelectItem>
                  <SelectItem value="delete">Exclusão</SelectItem>
                  <SelectItem value="approve">Aprovação</SelectItem>
                  <SelectItem value="reject">Rejeição</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entity">Entidade</Label>
              <Select
                value={filters.entity}
                onValueChange={(value) =>
                  setFilters({ ...filters, entity: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as entidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as entidades</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="account">Conta</SelectItem>
                  <SelectItem value="transaction">Transação</SelectItem>
                  <SelectItem value="reload_request">Reload</SelectItem>
                  <SelectItem value="withdrawal_request">Saque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="searchTerm">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="searchTerm"
                  placeholder="Buscar nos detalhes..."
                  className="pl-8"
                  value={filters.searchTerm}
                  onChange={(e) =>
                    setFilters({ ...filters, searchTerm: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Limpar Filtros
            </Button>
            <Button
              onClick={() => {
                setCurrentPage(1);
                fetchAuditLogs();
              }}
            >
              Aplicar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Auditoria</CardTitle>
          <CardDescription>
            Histórico detalhado de todas as ações realizadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando logs...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhum log encontrado com os filtros aplicados.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Criticidade</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => {
                    const criticality = getCriticalityLevel(
                      log.action,
                      log.entity
                    );
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">
                              {log.user_name || "Sistema"}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.user_role}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getActionIcon(log.action)}
                            {getActionBadge(log.action)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.entity}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              criticality === "high"
                                ? "bg-red-100 text-red-800"
                                : criticality === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }
                          >
                            {criticality === "high"
                              ? "Alta"
                              : criticality === "medium"
                              ? "Média"
                              : "Baixa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate block cursor-help">
                                  {log.detail || "Sem detalhes"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-sm">
                                  {log.detail || "Sem detalhes adicionais"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>
                                <FileText className="w-4 h-4 mr-2" />
                                Gerar Relatório
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Paginação */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditoriaEnhanced;
