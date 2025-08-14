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
} from "lucide-react";
import { toast } from "sonner";

const PlayerManagement = ({ userRole }) => {
  const [players, setPlayers] = useState([]);
  const [retas, setRetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReta, setSelectedReta] = useState("");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [playerCompleteness, setPlayerCompleteness] = useState({});

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
      1: "bg-green-500", // Reta 0
      2: "bg-blue-500", // Reta 1
      3: "bg-yellow-500", // Reta 2
      4: "bg-red-500", // Reta 3
    };
    return colors[retaId] || "bg-gray-500";
  };

  const getPlayerStatus = (player) => {
    if (player.makeup > 0) return "critical";
    if (player.total_balance > 0) return "profit";
    return "even";
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
            {filteredPlayers.length} jogador(es) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead>Reta Atual</TableHead>
                <TableHead>Saldo Total</TableHead>
                <TableHead>Makeup</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Contas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => (
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
                            <span className="text-green-600">
                              ✓ 100% Completo
                            </span>
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
                    <Badge
                      className={`${getRetaColor(player.reta_id)} text-white`}
                    >
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
                    {player.makeup > 0 ? (
                      <span className="text-red-400">
                        {formatCurrency(player.makeup)}
                      </span>
                    ) : (
                      <span className="text-green-400">$ 0.00</span>
                    )}
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
                        ? "Lucro"
                        : getPlayerStatus(player) === "critical"
                        ? "Makeup"
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
                      <Dialog
                        open={showEditModal && editingPlayer?.id === player.id}
                        onOpenChange={(open) => {
                          setShowEditModal(open);
                          if (!open) setEditingPlayer(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPlayer(player)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Jogador</DialogTitle>
                            <DialogDescription>
                              Alterar reta de {player.full_name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="nova-reta">Nova Reta</Label>
                              <Select
                                defaultValue={player.reta_id?.toString()}
                                onValueChange={(value) =>
                                  handleUpdatePlayerReta(player.id, value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione uma reta" />
                                </SelectTrigger>
                                <SelectContent>
                                  {retas.map((reta) => (
                                    <SelectItem
                                      key={reta.id}
                                      value={reta.id.toString()}
                                    >
                                      {reta.name} (${reta.min_stake} - $
                                      {reta.max_stake})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlayerManagement;
