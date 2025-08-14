import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const formatUSD = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value || 0
  );

const TeamProfitChart = ({ days = 30, refreshMs = 60000 }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ totalBalance: 0, monthlyProfit: 0 });

  useEffect(() => {
    let timer;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Resumo geral (saldo total e lucro mensal) para bater com cards da planilha
        const teamRes = await fetch("/api/dashboard/team-financials", {
          credentials: "include",
        });
        if (teamRes.ok) {
          const team = await teamRes.json();
          setSummary({
            totalBalance: team.totalBalance || 0,
            monthlyProfit: team.monthlyProfit || 0,
          });
        }

        const res = await fetch(`/api/dashboard/team-pnl-series?days=${days}`, {
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          const series = (json.series || []).map((d) => ({
            date: d.date,
            pnl: d.delta,
            cumulative: d.cumulative,
            dateFormatted: new Date(d.date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
          }));
          setData(series);
        }
      } catch (e) {
        console.error("Erro ao carregar dados de P&L do time", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    if (refreshMs > 0) {
      timer = setInterval(fetchData, refreshMs);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [days, refreshMs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Lucro do Time (últimos {days} dias)
        </CardTitle>
        <CardDescription>Evolução acumulada do P&L</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Resumo vinculado ao backend */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <div className="text-muted-foreground">Saldo Total do Time</div>
            <div className="font-semibold">
              {formatUSD(summary.totalBalance)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Lucro Mensal</div>
            <div
              className={`font-semibold ${
                summary.monthlyProfit >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {summary.monthlyProfit > 0 ? "+" : ""}
              {formatUSD(summary.monthlyProfit)}
            </div>
          </div>
        </div>
        <div className="h-64">
          {loading ? (
            <div className="w-full h-full grid place-items-center text-muted-foreground">
              Carregando gráfico...
            </div>
          ) : data.length === 0 ? (
            <div className="w-full h-full grid place-items-center text-muted-foreground">
              Sem dados no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="dateFormatted"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v, name) => [formatUSD(v), name || "Valor"]}
                  labelFormatter={(l) => `Data: ${l}`}
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #374151",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  name="Diário"
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name="Acumulado"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamProfitChart;
