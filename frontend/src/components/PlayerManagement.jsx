import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Target,
  Crown,
  TrendingUp,
  TrendingDown,
  Edit,
  CheckCircle,
  X,
  Filter,
  Search,
  MoreVertical,
  FileSpreadsheet,
  UserCheck,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

const PlayerManagement = ({ userRole }) => {
  const [players, setPlayers] = useState([]);
  const [retas, setRetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReta, setSelectedReta] = useState("");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [playerCompleteness, setPlayerCompleteness] = useState({});
  const [playerRequests, setPlayerRequests] = useState({});

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [playersPerPage] = useState(10);

  useEffect(() => {
    fetchPlayers();
    fetchRetas();
  }, []);

  useEffect(() => {
    // Buscar completude de cada jogador
    if (players.length > 0) {
      players.forEach((player) => {
        if (player.role === "player") {
          fetchPlayerCompleteness(player.id);
        }
      });
    }
  }, [players]);

  // Deep-link: se vier com query do dashboard, aplicar filtro automático
  useEffect(() => {
    const q = sessionStorage.getItem("playerSearchQuery");
    if (q) {
      setSearchTerm(q);
      sessionStorage.removeItem("playerSearchQuery");
    }
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await fetch("/api/users/players", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players || []);
      }
    } catch (err) {
      console.error("Erro ao carregar jogadores:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRetas = async () => {
    try {
      const response = await fetch("/api/retas", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setRetas(data.retas || []);
      }
    } catch (err) {
      console.error("Erro ao carregar retas:", err);
    }
  };

  const fetchPlayerCompleteness = async (playerId) => {
    try {
      const response = await fetch(
        `/api/planilhas/user/${playerId}/completeness`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPlayerCompleteness((prev) => ({
          ...prev,
          [playerId]: data,
        }));
      }
    } catch (err) {
      console.error("Erro ao carregar completude:", err);
    }
  };

  const handleUpdatePlayerReta = async (playerId, newRetaId) => {
    try {
      const response = await fetch(`/api/users/${playerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reta_id: parseInt(newRetaId),
        }),
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Reta do jogador atualizada com sucesso!");
        fetchPlayers();
        setShowEditModal(false);
        setEditingPlayer(null);
      } else {
        const data = await response.json();
        toast.error(data.error || "Erro ao atualizar reta");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    }
  };

  const getRetaName = (retaId) => {
    const reta = retas.find((r) => r.id === retaId);
    return reta ? reta.name : "Sem reta";
  };

  const getRetaColor = (retaId) => {
    const colors = {
      1: "bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500", // Reta 0
      2: "bg-blue-600 hover:bg-blue-700 text-white border border-blue-500", // Reta 1
      3: "bg-amber-600 hover:bg-amber-700 text-black border border-amber-500", // Reta 2
      4: "bg-rose-600 hover:bg-rose-700 text-white border border-rose-500", // Reta 3
    };
    return (
      colors[retaId] ||
      "bg-slate-600 hover:bg-slate-700 text-white border border-slate-500"
    );
  };

  const getPlayerStatus = (player) => {
    // P&L baseado: negativo = crítico, positivo = lucro, zero = neutro
    const pnl = (player.total_balance || 0) - (player.total_investment || 0);
    if (pnl < 0) return "critical"; // Prejuízo (P)
    if (pnl > 0) return "profit"; // Lucro (L)
    return "even"; // Neutro
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "profit":
        return "text-green-400";
      case "critical":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const fetchPlayerRequests = async (playerId) => {
    try {
      // Buscar reloads pendentes
      const reloadRes = await fetch(
        `/api/reload_requests/?user_id=${playerId}&status=pending`,
        {
          credentials: "include",
        }
      );

      // Buscar saques pendentes
      const withdrawalRes = await fetch(
        `/api/withdrawal_requests/?user_id=${playerId}&status=pending`,
        {
          credentials: "include",
        }
      );

      const requests = {
        reloads: [],
        withdrawals: [],
      };

      if (reloadRes.ok) {
        const reloadData = await reloadRes.json();
        requests.reloads = reloadData.reload_requests || [];
      }

      if (withdrawalRes.ok) {
        const withdrawalData = await withdrawalRes.json();
        requests.withdrawals = withdrawalData.withdrawal_requests || [];
      }

      const totalRequests =
        requests.reloads.length + requests.withdrawals.length;

      if (totalRequests > 0) {
        toast.info(
          `${totalRequests} solicitação(ões) pendente(s): ${requests.reloads.length} reload(s) + ${requests.withdrawals.length} saque(s)`,
          { duration: 4000 }
        );
      } else {
        toast.success("Nenhuma solicitação pendente para este jogador");
      }

      setPlayerRequests((prev) => ({
        ...prev,
        [playerId]: requests,
      }));
    } catch (err) {
      console.error(
        `Erro ao carregar solicitações do jogador ${playerId}:`,
        err
      );
      toast.error("Erro ao carregar solicitações");
    }
  };

  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesReta =
      selectedReta === "" ||
      selectedReta === "all" ||
      player.reta_id === parseInt(selectedReta);

    return matchesSearch && matchesReta;
  });

  // Paginação
  const totalPages = Math.ceil(filteredPlayers.length / playersPerPage);
  const indexOfLastPlayer = currentPage * playersPerPage;
  const indexOfFirstPlayer = indexOfLastPlayer - playersPerPage;
  const currentPlayers = filteredPlayers.slice(
    indexOfFirstPlayer,
    indexOfLastPlayer
  );

  // Reset para primeira página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedReta]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando jogadores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            👥 Gestão de Jogadores
          </h2>
          <p className="text-muted-foreground">
            Gerencie jogadores e suas retas
          </p>
        </div>
        <Users className="w-8 h-8 text-yellow-500" />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Buscar jogador</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Nome ou username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="reta-filter">Filtrar por reta</Label>
              <Select value={selectedReta} onValueChange={setSelectedReta}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as retas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as retas</SelectItem>
                  {retas.map((reta) => (
                    <SelectItem key={reta.id} value={reta.id.toString()}>
                      {reta.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Jogadores */}
      <Card>
        <CardHeader>
          <CardTitle>Jogadores Cadastrados</CardTitle>
          <CardDescription>
            {filteredPlayers.length} jogador(es) encontrado(s) - Página{" "}
            {currentPage} de {totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead>Reta Atual</TableHead>
                <TableHead>Saldo Total</TableHead>
                <TableHead>P&L Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPlayers.map((player) => (
                <TableRow key={player.id}>
                  <TableCell>
                    <div>
                      <div
                        className={`font-medium ${
                          playerCompleteness[player.id]?.status === "complete"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {player.full_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{player.username}
                      </div>
                      {playerCompleteness[player.id] && (
                        <div className="text-xs mt-1">
                          {playerCompleteness[player.id].status ===
                          "complete" ? (
                            <span className="text-green-600">✓ OK</span>
                          ) : (
                            <span className="text-red-600">
                              {playerCompleteness[player.id].completeness}% -
                              {playerCompleteness[player.id]
                                .has_pending_requests &&
                                " Solicitações pendentes"}
                              {playerCompleteness[player.id].pending_fields
                                .length > 0 &&
                                ` ${
                                  playerCompleteness[player.id].pending_fields
                                    .length
                                } campos pendentes`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRetaColor(player.reta_id)}>
                      <Target className="w-3 h-3 mr-1" />
                      {getRetaName(player.reta_id)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={getStatusColor(getPlayerStatus(player))}>
                      {formatCurrency(player.total_balance || 0)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const pnl =
                        (player.total_balance || 0) -
                        (player.total_investment || 0);
                      return (
                        <span
                          className={
                            pnl < 0
                              ? "text-red-400"
                              : pnl > 0
                              ? "text-green-400"
                              : "text-gray-400"
                          }
                        >
                          {formatCurrency(pnl)}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        getPlayerStatus(player) === "profit"
                          ? "default"
                          : getPlayerStatus(player) === "critical"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {getPlayerStatus(player) === "profit" && (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      )}
                      {getPlayerStatus(player) === "critical" && (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {getPlayerStatus(player) === "profit"
                        ? "Lucro (L)"
                        : getPlayerStatus(player) === "critical"
                        ? "Prejuízo (P)"
                        : "Neutro"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {player.account_count || 0} conta(s)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {userRole === "admin" && (
                      <div className="flex items-center space-x-2">
                        {/* Dropdown de ações */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            {/* Ver Solicitações na Planilha */}
                            <DropdownMenuItem
                              onClick={() => {
                                // Redirecionar para a planilha do jogador
                                sessionStorage.setItem(
                                  "selectedPlayerId",
                                  String(player.id)
                                );
                                sessionStorage.setItem(
                                  "planilhaFocus",
                                  "solicitacoes"
                                );
                                window.dispatchEvent(
                                  new CustomEvent("navigateToTab", {
                                    detail: {
                                      tab: "planilha",
                                      playerId: player.id,
                                    },
                                  })
                                );
                              }}
                            >
                              <FileSpreadsheet className="w-4 h-4 mr-2" />
                              Ver Solicitações
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Editar Reta */}
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingPlayer(player);
                                setShowEditModal(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Editar Reta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>

                  {/* Números das páginas */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={currentPage === pageNumber}
                          className="cursor-pointer"
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição de Reta */}
      {editingPlayer && (
        <Dialog
          open={showEditModal}
          onOpenChange={(open) => {
            setShowEditModal(open);
            if (!open) setEditingPlayer(null);
          }}
        >
          <DialogContent className="player-edit-modal system-harmony-fix">
            <DialogHeader>
              <DialogTitle className="text-yellow-400 font-semibold text-lg">
                ✏️ Editar Jogador
              </DialogTitle>
              <DialogDescription className="text-gray-300">
                Alterar reta de {editingPlayer.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="nova-reta"
                  className="text-gray-200 font-medium flex items-center gap-2"
                >
                  🎯 Nova Reta
                </Label>
                <Select
                  defaultValue={editingPlayer.reta_id?.toString()}
                  onValueChange={(value) =>
                    handleUpdatePlayerReta(editingPlayer.id, value)
                  }
                >
                  <SelectTrigger className="bg-gray-700 border-2 border-yellow-500 text-white">
                    <SelectValue placeholder="Selecione uma reta" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-yellow-500">
                    {retas.map((reta) => (
                      <SelectItem
                        key={reta.id}
                        value={reta.id.toString()}
                        className="text-white hover:bg-gray-700"
                      >
                        {reta.name} (${reta.min_stake} - ${reta.max_stake})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="bg-gray-600 border-gray-500 text-gray-200 hover:bg-gray-500 hover:text-white"
              >
                ❌ Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default PlayerManagement;
