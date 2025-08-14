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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlanilhaCompleta from "./PlanilhaCompleta";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  Target,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Edit,
  Search,
  Eye,
  Settings,
  Calendar,
  TrendingUp,
  DollarSign,
  Plus,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import PlatformAccountsView from "./PlatformAccountsView";
import BankrollChart from "./BankrollChart";
import CalendarTracker from "./CalendarTracker";

const VerificarPerfil = ({ userRole }) => {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [bankrollData, setBankrollData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [permissions, setPermissions] = useState([]);

  useEffect(() => {
    fetchPlayers();
    fetchPlatforms();
  }, []);

  // Deep link: ao abrir, se houver playerSearchQuery ou openProfileUserId, aplicar
  useEffect(() => {
    const q = sessionStorage.getItem("playerSearchQuery");
    if (q) {
      setSearchTerm(q);
      sessionStorage.removeItem("playerSearchQuery");
    }
    const openId = sessionStorage.getItem("openProfileUserId");
    if (openId && players.length > 0) {
      const found = players.find((p) => String(p.id) === openId);
      if (found) handlePlayerSelect(found);
      sessionStorage.removeItem("openProfileUserId");
    }
  }, [players]);

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

  const fetchPlatforms = async () => {
    try {
      const response = await fetch("/api/platforms", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPlatforms(data.platforms || []);
      }
    } catch (err) {
      console.error("Erro ao carregar plataformas:", err);
    }
  };

  const fetchPlayerDetails = async (playerId) => {
    try {
      // Buscar dados do bankroll
      const bankrollResponse = await fetch(
        `/api/users/${playerId}/bankroll-history`,
        {
          credentials: "include",
        }
      );
      if (bankrollResponse.ok) {
        const bankrollData = await bankrollResponse.json();
        setBankrollData(bankrollData.history || []);
      }

      // Buscar dados do calendário
      const calendarResponse = await fetch(
        `/api/users/${playerId}/calendar-tracker`,
        {
          credentials: "include",
        }
      );
      if (calendarResponse.ok) {
        const calendarData = await calendarResponse.json();
        setCalendarData(calendarData.calendar || []);
      }

      // Buscar permissões
      const permissionsResponse = await fetch(
        `/api/retas/permissions?user_id=${playerId}`,
        {
          credentials: "include",
        }
      );
      if (permissionsResponse.ok) {
        const permissionsData = await permissionsResponse.json();
        setPermissions(permissionsData.permissions || []);
      }
    } catch (err) {
      console.error("Erro ao carregar detalhes do jogador:", err);
    }
  };

  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player);
    setShowDetailModal(true);
    fetchPlayerDetails(player.id);
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

  const getPlayerStatus = (player) => {
    if (player.makeup > 0) return "critical";
    if (player.total_balance > 0) return "profit";
    return "even";
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const filteredPlayers = players.filter(
    (player) =>
      player.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupByPlatform = (accounts) => {
    const grouped = {};
    accounts.forEach((account) => {
      const platform = platforms.find((p) => p.id === account.platform_id);
      const platformName = platform ? platform.display_name : "Desconhecida";

      if (!grouped[platformName]) {
        grouped[platformName] = [];
      }
      grouped[platformName].push(account);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando perfis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            👥 Verificar Perfil
          </h2>
          <p className="text-muted-foreground">
            Visualize e gerencie perfis dos jogadores
          </p>
        </div>
        <Users className="w-8 h-8 text-yellow-500" />
      </div>

      {/* Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Buscar Jogador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou username do jogador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
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
                <TableHead>Status</TableHead>
                <TableHead>Saldo Total</TableHead>
                <TableHead>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>Pendências ⚠️</TooltipTrigger>
                      <TooltipContent>
                        <p>Reloads, saques e aprovações pendentes</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => (
                <TableRow key={player.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{player.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        @{player.username}
                      </div>
                    </div>
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
                        <AlertTriangle className="w-3 h-3 mr-1" />
                      )}
                      {getPlayerStatus(player) === "profit"
                        ? "Lucro"
                        : getPlayerStatus(player) === "critical"
                        ? "Makeup"
                        : "Neutro"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={getStatusColor(getPlayerStatus(player))}>
                      {formatCurrency(player.total_balance || 0)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />3 pendentes
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlayerSelect(player)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Ver Perfil
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Perfil de {selectedPlayer?.full_name}
            </DialogTitle>
            <DialogDescription>
              Informações detalhadas e histórico do jogador
            </DialogDescription>
          </DialogHeader>

          {selectedPlayer && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">📊 Visão Geral</TabsTrigger>
                <TabsTrigger value="personal">👤 Dados Completos</TabsTrigger>
                <TabsTrigger value="accounts">
                  💰 Contas por Plataforma
                </TabsTrigger>
                <TabsTrigger value="evolution">📈 Evolução</TabsTrigger>
                <TabsTrigger value="permissions">🛡️ Permissões</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Dados Pessoais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <strong>Nome:</strong> {selectedPlayer.full_name}
                      </div>
                      <div>
                        <strong>Username:</strong> @{selectedPlayer.username}
                      </div>
                      <div>
                        <strong>Email:</strong> {selectedPlayer.email}
                      </div>
                      <div>
                        <strong>Contas Ativas:</strong>{" "}
                        {selectedPlayer.account_count}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        Status Financeiro
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <strong>Saldo Total:</strong>
                        <span
                          className={getStatusColor(
                            getPlayerStatus(selectedPlayer)
                          )}
                        >
                          {formatCurrency(selectedPlayer.total_balance)}
                        </span>
                      </div>
                      <div>
                        <strong>Makeup:</strong>
                        <span
                          className={
                            selectedPlayer.makeup > 0
                              ? "text-red-400"
                              : "text-green-400"
                          }
                        >
                          {formatCurrency(selectedPlayer.makeup)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="accounts" className="space-y-4">
                <PlatformAccountsView playerId={selectedPlayer.id} />
              </TabsContent>

              <TabsContent value="evolution" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <BankrollChart playerId={selectedPlayer.id} />
                  <CalendarTracker playerId={selectedPlayer.id} />
                </div>
              </TabsContent>

              <TabsContent value="personal" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>👤 Dados Pessoais e Bancários</CardTitle>
                    <CardDescription>
                      Formulário completo com todos os dados obrigatórios do
                      jogador
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PlanilhaCompleta
                      userId={selectedPlayer.id}
                      userRole={userRole}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="permissions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>🛡️ Permissões Especiais</span>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Permissão
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="w-12 h-12 mx-auto mb-4" />
                      <p>Sistema de permissões será implementado</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerificarPerfil;
