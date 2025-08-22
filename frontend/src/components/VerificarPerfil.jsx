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
import AdminPlayerProfile from "./AdminPlayerProfile";

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
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [selectedPlayerForAdmin, setSelectedPlayerForAdmin] = useState(null);

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
    // P&L baseado: negativo = crítico, positivo = lucro, zero = neutro
    const pnl = (player.total_balance || 0) - (player.total_investment || 0);
    if (pnl < 0) return "critical"; // Prejuízo (P)
    if (pnl > 0) return "profit"; // Lucro (L)
    return "even"; // Neutro
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
                        ? "Lucro (L)"
                        : getPlayerStatus(player) === "critical"
                        ? "Prejuízo (P)"
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
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePlayerSelect(player)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Perfil
                      </Button>
                      {userRole === "admin" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPlayerForAdmin(player);
                            setShowAdminProfile(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          👑 Admin
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Detalhes - Layout Limpo */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden verify-profile-modal">
          <DialogHeader className="pb-6 border-b border-border">
            <DialogTitle className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold gradient-gold-text">
                  {selectedPlayer?.full_name}
                </h3>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-sm text-muted-foreground">
                    @{selectedPlayer?.username}
                  </p>
                  <div className="w-1 h-1 rounded-full bg-muted-foreground"></div>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlayer?.email}
                  </p>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedPlayer && (
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="overview" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-4 mb-8 bg-muted/50">
                  <TabsTrigger
                    value="overview"
                    className="flex items-center gap-2"
                  >
                    <span>📊</span>
                    <span className="hidden sm:inline">Visão Geral</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="accounts"
                    className="flex items-center gap-2"
                  >
                    <span>💰</span>
                    <span className="hidden sm:inline">Contas</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="evolution"
                    className="flex items-center gap-2"
                  >
                    <span>📈</span>
                    <span className="hidden sm:inline">Evolução</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="personal"
                    className="flex items-center gap-2"
                  >
                    <span>👤</span>
                    <span className="hidden sm:inline">Dados</span>
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto space-y-6">
                  <TabsContent value="overview" className="mt-0 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <Card className="h-fit">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-2 gradient-gold-text">
                            <span>👤</span>
                            Informações Básicas
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4">
                          <div className="space-y-4">
                            <div className="flex flex-col space-y-2 border-b border-border pb-3">
                              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                Nome Completo
                              </span>
                              <span className="text-sm font-semibold text-foreground break-words">
                                {selectedPlayer.full_name}
                              </span>
                            </div>
                            <div className="flex flex-col space-y-2 border-b border-border pb-3">
                              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                Username
                              </span>
                              <span className="text-sm font-semibold text-primary">
                                @{selectedPlayer.username}
                              </span>
                            </div>
                            <div className="flex flex-col space-y-2">
                              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                Email
                              </span>
                              <span className="text-sm font-medium text-foreground break-all">
                                {selectedPlayer.email}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="h-fit">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-2 gradient-gold-text">
                            <span>💰</span>
                            Status Financeiro
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 p-4">
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-green-900/30 to-green-800/30 p-6 rounded-lg border border-green-500/30">
                              <div className="text-center space-y-2">
                                <p className="text-xs text-green-300 font-medium mb-3 uppercase tracking-wide">
                                  💳 Saldo Total
                                </p>
                                <p className="text-3xl font-bold text-green-400 tracking-tight">
                                  {formatCurrency(selectedPlayer.total_balance)}
                                </p>
                              </div>
                            </div>
                            <div
                              className={`p-6 rounded-lg border ${
                                (selectedPlayer.total_balance || 0) -
                                  (selectedPlayer.total_investment || 0) >=
                                0
                                  ? "bg-gradient-to-r from-green-900/30 to-green-800/30 border-green-500/30"
                                  : "bg-gradient-to-r from-red-900/30 to-red-800/30 border-red-500/30"
                              }`}
                            >
                              <div className="text-center space-y-2">
                                <p
                                  className={`text-xs font-medium mb-3 uppercase tracking-wide ${
                                    (selectedPlayer.total_balance || 0) -
                                      (selectedPlayer.total_investment || 0) >=
                                    0
                                      ? "text-green-300"
                                      : "text-red-300"
                                  }`}
                                >
                                  📈 P&L Total
                                </p>
                                <p
                                  className={`text-3xl font-bold tracking-tight ${
                                    (selectedPlayer.total_balance || 0) -
                                      (selectedPlayer.total_investment || 0) >=
                                    0
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {formatCurrency(
                                    (selectedPlayer.total_balance || 0) -
                                      (selectedPlayer.total_investment || 0)
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="h-fit">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center gap-2 gradient-gold-text">
                            <span>📊</span>
                            Estatísticas
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-blue-900/30 to-blue-800/30 p-4 rounded-lg border border-blue-500/30">
                              <div className="flex flex-col space-y-2">
                                <span className="text-xs text-blue-300 font-medium">
                                  🏦 Contas Ativas:
                                </span>
                                <span className="text-2xl font-bold text-blue-400">
                                  {selectedPlayer.account_count || 0}
                                </span>
                              </div>
                            </div>

                            <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/30 p-4 rounded-lg border border-purple-500/30">
                              <div className="flex flex-col space-y-2">
                                <span className="text-xs text-purple-300 font-medium">
                                  📊 Status:
                                </span>
                                <Badge
                                  className={`w-fit ${getStatusColor(
                                    getPlayerStatus(selectedPlayer)
                                  )}`}
                                >
                                  {getPlayerStatus(selectedPlayer) === "profit"
                                    ? "✅ Lucro (L)"
                                    : getPlayerStatus(selectedPlayer) ===
                                      "critical"
                                    ? "❌ Prejuízo (P)"
                                    : "⚪ Neutro"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="accounts" className="mt-0 space-y-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span>💰</span>
                          Contas por Plataforma
                        </CardTitle>
                        <CardDescription>
                          Detalhes das contas em cada plataforma de poker
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PlatformAccountsView playerId={selectedPlayer.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="evolution" className="mt-0 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <span>📈</span>
                            Evolução do Bankroll
                          </CardTitle>
                          <CardDescription>
                            Histórico de 30 dias
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <BankrollChart playerId={selectedPlayer.id} />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <span>📅</span>
                            Calendário de Atividade
                          </CardTitle>
                          <CardDescription>
                            Preenchimento da planilha
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <CalendarTracker playerId={selectedPlayer.id} />
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="personal" className="mt-0 space-y-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span>👤</span>
                          Dados Pessoais e Bancários
                        </CardTitle>
                        <CardDescription>
                          Informações completas do perfil do jogador
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="max-h-96 overflow-y-auto">
                        <PlanilhaCompleta
                          userId={selectedPlayer.id}
                          userRole={userRole}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 🚨 NOVO: Modal Admin Completo */}
      <AdminPlayerProfile
        player={selectedPlayerForAdmin}
        isOpen={showAdminProfile}
        onClose={() => {
          setShowAdminProfile(false);
          setSelectedPlayerForAdmin(null);
        }}
        onSave={() => {
          fetchPlayers(); // Refresh list after saving
          toast.success("Dados atualizados com sucesso!");
        }}
      />
    </div>
  );
};

export default VerificarPerfil;
