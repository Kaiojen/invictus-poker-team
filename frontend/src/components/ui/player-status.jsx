import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

/**
 * Determina o status de um jogador baseado em suas pendências
 * @param {Object} player - Dados do jogador
 * @returns {string} - 'complete', 'pending', ou 'critical'
 */
export const getPlayerStatus = (player) => {
  if (!player) return "complete";

  // Status crítico: solicitações pendentes ou dados críticos em falta
  if (
    (player.pending_reloads && player.pending_reloads > 0) ||
    (player.pending_withdrawals && player.pending_withdrawals > 0) ||
    player.needs_attention === true
  ) {
    return "critical";
  }

  // Status pendente: dados incompletos ou não verificados
  if (
    (player.incomplete_data && player.incomplete_data > 0) ||
    player.status === "pending" ||
    (player.last_update && isStaleData(player.last_update))
  ) {
    return "pending";
  }

  // Status completo: tudo OK
  return "complete";
};

/**
 * Verifica se os dados estão desatualizados (mais de 7 dias)
 */
const isStaleData = (lastUpdate) => {
  if (!lastUpdate) return true;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(lastUpdate) < sevenDaysAgo;
};

/**
 * Retorna as classes CSS para o status do jogador
 */
export const getPlayerStatusClasses = (status) => {
  const baseClasses = "transition-all duration-300 rounded-lg p-4";

  switch (status) {
    case "critical":
      return `${baseClasses} player-status-critical`;
    case "pending":
      return `${baseClasses} player-status-pending`;
    case "complete":
      return `${baseClasses} player-status-complete`;
    default:
      return baseClasses;
  }
};

/**
 * Retorna o badge de status apropriado
 */
export const getStatusBadge = (status, props = {}) => {
  const config = {
    complete: {
      variant: "default",
      className: "badge-status-complete",
      text: "Completo",
      icon: CheckCircle,
    },
    pending: {
      variant: "secondary",
      className: "badge-status-pending",
      text: "Pendente",
      icon: AlertTriangle,
    },
    critical: {
      variant: "destructive",
      className: "badge-status-critical",
      text: "Crítico",
      icon: XCircle,
    },
  };

  const statusConfig = config[status] || config.complete;
  const Icon = statusConfig.icon;

  return (
    <Badge
      variant={statusConfig.variant}
      className={`${statusConfig.className} flex items-center space-x-1`}
      {...props}
    >
      <Icon className="w-3 h-3" />
      <span>{statusConfig.text}</span>
    </Badge>
  );
};

/**
 * Retorna o indicador visual de status
 */
export const getStatusIndicator = (status) => {
  const classMap = {
    complete: "status-indicator status-indicator-complete",
    pending: "status-indicator status-indicator-pending",
    critical: "status-indicator status-indicator-critical",
  };

  return <div className={classMap[status] || classMap.complete} />;
};

/**
 * Retorna a mensagem explicativa do status
 */
export const getStatusMessage = (player) => {
  const status = getPlayerStatus(player);

  const messages = {
    complete: "Planilha em ordem",
    pending: buildPendingMessage(player),
    critical: buildCriticalMessage(player),
  };

  return messages[status] || messages.complete;
};

const buildPendingMessage = (player) => {
  const issues = [];

  if (player.incomplete_data > 0) {
    issues.push(`${player.incomplete_data} dados incompletos`);
  }

  if (player.last_update && isStaleData(player.last_update)) {
    issues.push("dados desatualizados (+ 7 dias)");
  }

  return `⚠️ Pendências: ${issues.join(", ")}`;
};

const buildCriticalMessage = (player) => {
  const issues = [];

  if (player.pending_reloads > 0) {
    issues.push(`${player.pending_reloads} reload(s) pendente(s)`);
  }

  if (player.pending_withdrawals > 0) {
    issues.push(`${player.pending_withdrawals} saque(s) pendente(s)`);
  }

  if (player.accounts_outdated > 0) {
    issues.push(
      `${player.accounts_outdated} conta(s) desatualizada(s) há mais de 24h`
    );
  }

  return `🚨 Ação necessária: ${issues.join(", ")}`;
};

/**
 * Componente completo de status do jogador com tooltip
 */
export const PlayerStatusIndicator = ({
  player,
  showBadge = true,
  showIndicator = true,
}) => {
  const status = getPlayerStatus(player);
  const message = getStatusMessage(player);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center space-x-2">
            {showIndicator && getStatusIndicator(status)}
            {showBadge && getStatusBadge(status)}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm max-w-xs">{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Hook personalizado para gerenciar status de jogadores
 */
export const usePlayerStatus = (players = []) => {
  const playersWithStatus = players.map((player) => ({
    ...player,
    computedStatus: getPlayerStatus(player),
    statusMessage: getStatusMessage(player),
  }));

  const stats = {
    total: playersWithStatus.length,
    complete: playersWithStatus.filter((p) => p.computedStatus === "complete")
      .length,
    pending: playersWithStatus.filter((p) => p.computedStatus === "pending")
      .length,
    critical: playersWithStatus.filter((p) => p.computedStatus === "critical")
      .length,
  };

  return {
    players: playersWithStatus,
    stats,
  };
};

export default PlayerStatusIndicator;
