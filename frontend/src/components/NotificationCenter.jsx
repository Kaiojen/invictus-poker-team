import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  X,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Zap,
  Settings,
  Filter,
  MoreVertical,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const NotificationCenter = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ total: 0, unread: 0, urgent: 0 });
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [filter, setFilter] = useState("all"); // all, unread, urgent
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchNotifications();

    // Auto-refresh a cada 30 segundos se habilitado
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchNotifications, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [filter, autoRefresh]);

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === "unread") {
        params.append("unread_only", "true");
      }

      const response = await fetch(`/api/notifications?${params.toString()}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();

        let filteredNotifications = data.notifications;
        if (filter === "urgent") {
          filteredNotifications = data.notifications.filter((n) => n.is_urgent);
        }

        setNotifications(filteredNotifications);
        setStats(data.stats);
      } else {
        console.error("Erro ao carregar notificações");
      }
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(
        `/api/notifications/${notificationId}/read`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
        setStats((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
      }
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            is_read: true,
            read_at: new Date().toISOString(),
          }))
        );
        setStats((prev) => ({ ...prev, unread: 0 }));
        toast.success(`${data.count} notificações marcadas como lidas`);
      }
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
      toast.error("Erro ao marcar notificações como lidas");
    }
  };

  const getNotificationIcon = (type, category) => {
    if (category === "urgent")
      return <Zap className="w-4 h-4 text-amber-500" />;

    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "error":
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case "urgent":
        return <Zap className="w-4 h-4 text-amber-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getNotificationBadgeColor = (type, isUrgent) => {
    if (isUrgent) return "destructive";

    switch (type) {
      case "success":
        return "default";
      case "warning":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getCategoryDisplayName = (category) => {
    const names = {
      reload_request: "Reload",
      withdrawal_request: "Saque",
      account_update: "Conta",
      system_message: "Sistema",
      player_alert: "Alerta",
      compliance: "Compliance",
      performance: "Performance",
    };
    return names[category] || category;
  };

  const handleNotificationClick = async (notification) => {
    // Marcar como lida se não estiver
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Se há URL de ação, navegar
    if (notification.action_url) {
      const url = new URL(notification.action_url, window.location.origin);
      window.location.href = url.pathname + url.search;
    } else {
      // Mostrar detalhes no modal
      setSelectedNotification(notification);
      setShowDialog(true);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Carregando notificações...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com estatísticas e controles */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5" />
              <CardTitle>Central de Notificações</CardTitle>
              {stats.unread > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stats.unread}
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {/* Filtros */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    {filter === "all" && "Todas"}
                    {filter === "unread" && "Não lidas"}
                    {filter === "urgent" && "Urgentes"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFilter("all")}>
                    Todas ({stats.total})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("unread")}>
                    Não lidas ({stats.unread})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilter("urgent")}>
                    Urgentes ({stats.urgent})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Ações */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={markAllAsRead}
                    disabled={stats.unread === 0}
                  >
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Marcar todas como lidas
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    {autoRefresh ? (
                      <BellOff className="w-4 h-4 mr-2" />
                    ) : (
                      <Bell className="w-4 h-4 mr-2" />
                    )}
                    {autoRefresh ? "Desativar" : "Ativar"} auto-refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={fetchNotifications}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Atualizar agora
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <CardDescription>
            {stats.total === 0
              ? "Nenhuma notificação encontrada"
              : `${stats.total} notificação${
                  stats.total !== 1 ? "ões" : ""
                } • ${stats.unread} não lida${stats.unread !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Lista de notificações */}
      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {filter === "all" && "Nenhuma notificação encontrada"}
                {filter === "unread" && "Nenhuma notificação não lida"}
                {filter === "urgent" && "Nenhuma notificação urgente"}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 cursor-pointer transition-colors hover:bg-secondary/50 ${
                      !notification.is_read
                        ? "bg-blue-50 dark:bg-blue-950/20"
                        : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Ícone da notificação */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(
                          notification.notification_type,
                          notification.category
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4
                            className={`text-sm font-medium ${
                              !notification.is_read
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {notification.title}
                          </h4>

                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={getNotificationBadgeColor(
                                notification.notification_type,
                                notification.is_urgent
                              )}
                              className="text-xs"
                            >
                              {getCategoryDisplayName(notification.category)}
                            </Badge>

                            {notification.is_urgent && (
                              <Badge variant="destructive" className="text-xs">
                                Urgente
                              </Badge>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {notification.message}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {notification.time_ago}
                          </span>

                          {!notification.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="h-6 px-2"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {selectedNotification &&
                getNotificationIcon(
                  selectedNotification.notification_type,
                  selectedNotification.category
                )}
              <span>{selectedNotification?.title}</span>
            </DialogTitle>
            <DialogDescription>
              {selectedNotification &&
                getCategoryDisplayName(selectedNotification.category)}{" "}
              • {selectedNotification?.time_ago}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm">{selectedNotification?.message}</p>

            {selectedNotification?.is_urgent && (
              <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    Esta é uma notificação urgente
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Fechar
            </Button>
            {selectedNotification?.action_url && (
              <Button
                onClick={() => {
                  window.location.href = selectedNotification.action_url;
                }}
              >
                Ir para ação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationCenter;
