import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";

const BankrollChart = ({ playerId }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalChange: 0,
    percentChange: 0,
    highestBalance: 0,
    lowestBalance: 0,
  });

  useEffect(() => {
    if (playerId) {
      fetchBankrollHistory();
    }
  }, [playerId]);

  const fetchBankrollHistory = async () => {
    try {
      const response = await fetch(
        `/api/users/${playerId}/bankroll-history?days=30`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const history = data.history || [];

        // Processar dados para o gráfico
        const processedData = history.map((item, index) => ({
          date: new Date(item.date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          balance: item.balance,
          change: index > 0 ? item.balance - history[index - 1].balance : 0,
          originalDate: item.date,
        }));

        setChartData(processedData);

        // Calcular estatísticas
        if (processedData.length > 0) {
          const firstBalance = processedData[0].balance;
          const lastBalance = processedData[processedData.length - 1].balance;
          const totalChange = lastBalance - firstBalance;
          const percentChange =
            firstBalance > 0 ? (totalChange / firstBalance) * 100 : 0;

          const balances = processedData.map((d) => d.balance);
          const highestBalance = Math.max(...balances);
          const lowestBalance = Math.min(...balances);

          setStats({
            totalChange,
            percentChange,
            highestBalance,
            lowestBalance,
          });
        }
      }
    } catch (err) {
      console.error("Erro ao carregar histórico do bankroll:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getChangeColor = (value) => {
    if (value > 0) return "text-green-400";
    if (value < 0) return "text-red-400";
    return "text-gray-400";
  };

  const getChangeIcon = (value) => {
    if (value > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (value < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <BarChart3 className="w-4 h-4 text-gray-400" />;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{`Data: ${label}`}</p>
          <p className="text-sm">
            <span className="text-blue-400">Saldo: </span>
            <span className="font-medium">
              {formatCurrency(payload[0].value)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📈 Evolução do Bankroll</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>Carregando gráfico...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📈 Evolução do Bankroll</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-4" />
            <p>Nenhum histórico encontrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          📈 Evolução do Bankroll
          {getChangeIcon(stats.totalChange)}
        </CardTitle>
        <CardDescription>Últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Variação Total</div>
            <div className={`font-medium ${getChangeColor(stats.totalChange)}`}>
              {stats.totalChange > 0 ? "+" : ""}
              {formatCurrency(stats.totalChange)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Variação %</div>
            <div className={`font-medium ${getChangeColor(stats.totalChange)}`}>
              {stats.percentChange > 0 ? "+" : ""}
              {stats.percentChange.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Maior Saldo</div>
            <div className="font-medium text-green-400">
              {formatCurrency(stats.highestBalance)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Menor Saldo</div>
            <div className="font-medium text-red-400">
              {formatCurrency(stats.lowestBalance)}
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            >
              <defs>
                <linearGradient
                  id="bankrollGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$ ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#bankrollGradient)"
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: "#3b82f6", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default BankrollChart;
