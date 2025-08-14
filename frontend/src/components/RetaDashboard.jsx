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
  Target,
  Users,
  TrendingUp,
  TrendingDown,
  Crown,
  AlertTriangle,
  Calendar,
  BarChart3,
  DollarSign,
} from "lucide-react";

const RetaDashboard = () => {
  const [retaStats, setRetaStats] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("7");
  const [selectedReta, setSelectedReta] = useState("");

  useEffect(() => {
    fetchRetaStats();
    fetchPlayerPerformance();
  }, [selectedPeriod]);

  const fetchRetaStats = async () => {
    try {
      const response = await fetch(
        `/api/retas/dashboard-stats?days=${selectedPeriod}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRetaStats(data.reta_stats || []);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas das retas:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayerPerformance = async () => {
    try {
      const response = await fetch(
        `/api/users/performance-ranking?days=${selectedPeriod}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players || []);
      }
    } catch (err) {
      console.error("Erro ao carregar performance dos jogadores:", err);
    }
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getPerformanceIcon = (profit) => {
    if (profit > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (profit < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <BarChart3 className="w-4 h-4 text-gray-400" />;
  };

  const getPerformanceColor = (profit) => {
    if (profit > 0) return "text-green-400";
    if (profit < 0) return "text-red-400";
    return "text-gray-400";
  };

  const filteredPlayers = selectedReta
    ? selectedReta === "all"
      ? players
      : players.filter((p) => p.reta_id === parseInt(selectedReta))
    : players;

  const totalPlayers = retaStats.reduce(
    (sum, reta) => sum + reta.player_count,
    0
  );
  const totalProfit = retaStats.reduce(
    (sum, reta) => sum + reta.total_profit,
    0
  );
  const profitableRetas = retaStats.filter(
    (reta) => reta.total_profit > 0
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold gradient-gold-text">
            📊 Dashboard de Retas
          </h2>
          <p className="text-muted-foreground">
            Análise de performance e gestão de retas
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total de Jogadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {totalPlayers}
            </div>
            <p className="text-xs text-muted-foreground">Ativos no sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Lucro Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getPerformanceColor(
                totalProfit
              )}`}
            >
              {formatCurrency(totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos {selectedPeriod} dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Retas Lucrativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {profitableRetas}/{retaStats.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {((profitableRetas / retaStats.length) * 100 || 0).toFixed(0)}% do
              total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedPeriod}</div>
            <p className="text-xs text-muted-foreground">Dias analisados</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance por Reta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Performance por Reta
          </CardTitle>
          <CardDescription>
            Estatísticas detalhadas de cada reta nos últimos {selectedPeriod}{" "}
            dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {retaStats.map((reta) => (
              <Card key={reta.reta_id} className="border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      className={`${getRetaColor(reta.reta_id)} text-white`}
                    >
                      {reta.reta_name}
                    </Badge>
                    {getPerformanceIcon(reta.total_profit)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Jogadores:</span>
                    <span className="font-medium">{reta.player_count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Stakes:</span>
                    <span className="font-medium">
                      ${reta.min_stake} - ${reta.max_stake}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Lucro Total:</span>
                    <span
                      className={`font-medium ${getPerformanceColor(
                        reta.total_profit
                      )}`}
                    >
                      {formatCurrency(reta.total_profit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Média/Jogador:</span>
                    <span
                      className={`font-medium ${getPerformanceColor(
                        reta.avg_profit_per_player
                      )}`}
                    >
                      {formatCurrency(reta.avg_profit_per_player)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ranking de Jogadores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Ranking de Performance
              </CardTitle>
              <CardDescription>
                Top performers dos últimos {selectedPeriod} dias
              </CardDescription>
            </div>
            <Select value={selectedReta} onValueChange={setSelectedReta}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por reta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as retas</SelectItem>
                {retaStats.map((reta) => (
                  <SelectItem
                    key={reta.reta_id}
                    value={reta.reta_id.toString()}
                  >
                    {reta.reta_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posição</TableHead>
                <TableHead>Jogador</TableHead>
                <TableHead>Reta</TableHead>
                <TableHead>Lucro</TableHead>
                <TableHead>ROI</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.slice(0, 10).map((player, index) => (
                <TableRow key={player.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{index + 1}</span>
                      {index === 0 && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                      {index === 1 && (
                        <Crown className="w-4 h-4 text-gray-400" />
                      )}
                      {index === 2 && (
                        <Crown className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                  </TableCell>
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
                      className={`${getRetaColor(
                        player.reta_id
                      )} text-white text-xs`}
                    >
                      {player.reta_name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-medium ${getPerformanceColor(
                        player.profit
                      )}`}
                    >
                      {formatCurrency(player.profit)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-medium ${getPerformanceColor(
                        player.roi
                      )}`}
                    >
                      {player.roi > 0 ? "+" : ""}
                      {player.roi.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getPerformanceIcon(player.profit)}
                      {player.makeup > 0 && (
                        <AlertTriangle
                          className="w-4 h-4 text-orange-400"
                          title="Com makeup"
                        />
                      )}
                    </div>
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

export default RetaDashboard;
