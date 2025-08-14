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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar, CheckCircle, X } from "lucide-react";

const CalendarTracker = ({ playerId }) => {
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDays: 0,
    filledDays: 0,
    consecutiveDays: 0,
    fillRate: 0,
  });

  useEffect(() => {
    if (playerId) {
      fetchCalendarData();
    }
  }, [playerId]);

  const fetchCalendarData = async () => {
    try {
      const response = await fetch(
        `/api/users/${playerId}/calendar-tracker?days=30`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const calendar = data.calendar || [];

        setCalendarData(calendar);

        // Calcular estatísticas
        const totalDays = calendar.length;
        const filledDays = calendar.filter((day) => day.filled).length;
        const fillRate = totalDays > 0 ? (filledDays / totalDays) * 100 : 0;

        // Calcular dias consecutivos (streak atual)
        let consecutiveDays = 0;
        for (let i = calendar.length - 1; i >= 0; i--) {
          if (calendar[i].filled) {
            consecutiveDays++;
          } else {
            break;
          }
        }

        setStats({
          totalDays,
          filledDays,
          consecutiveDays,
          fillRate,
        });
      }
    } catch (err) {
      console.error("Erro ao carregar calendário:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDayOfWeek = (dateString) => {
    const date = new Date(dateString);
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return days[date.getDay()];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const getDayColor = (day) => {
    if (day.filled) {
      return "bg-green-500 hover:bg-green-600 text-white";
    } else {
      return "bg-red-500 hover:bg-red-600 text-white";
    }
  };

  const getStreakBadge = (streak) => {
    if (streak >= 7) return { variant: "default", label: "🔥 Excelente!" };
    if (streak >= 3) return { variant: "secondary", label: "👍 Muito bem!" };
    if (streak >= 1) return { variant: "outline", label: "👌 Continue!" };
    return { variant: "destructive", label: "⚠️ Atenção!" };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            📅 Calendário de Preenchimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>Carregando calendário...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const streakConfig = getStreakBadge(stats.consecutiveDays);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          📅 Calendário de Preenchimento
          <Calendar className="w-4 h-4" />
        </CardTitle>
        <CardDescription>Últimos 30 dias</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Taxa de Preenchimento</div>
            <div className="font-medium text-blue-400">
              {stats.fillRate.toFixed(1)}% ({stats.filledDays}/{stats.totalDays}
              )
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Sequência Atual</div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{stats.consecutiveDays} dias</span>
              <Badge variant={streakConfig.variant} className="text-xs">
                {streakConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>✅ Preenchido</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>❌ Não preenchido</span>
          </div>
        </div>

        {/* Calendário */}
        <div className="grid grid-cols-7 gap-1">
          {calendarData.map((day, index) => (
            <TooltipProvider key={index}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`
                      aspect-square rounded text-xs font-medium cursor-pointer
                      flex flex-col items-center justify-center
                      transition-colors
                      ${getDayColor(day)}
                    `}
                  >
                    <div className="text-xs font-bold">
                      {formatDate(day.date)}
                    </div>
                    <div className="text-[10px] opacity-75">
                      {getDayOfWeek(day.date)}
                    </div>
                    <div className="text-lg leading-none">{day.status}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <p className="font-medium">
                      {new Date(day.date).toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                      })}
                    </p>
                    <p className="text-sm">
                      {day.filled
                        ? "✅ Planilha preenchida"
                        : "❌ Planilha não preenchida"}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Dica */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          💡 <strong>Dica:</strong> Manter uma sequência de preenchimento diário
          ajuda a acompanhar melhor a evolução e identificar padrões de jogo.
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarTracker;
