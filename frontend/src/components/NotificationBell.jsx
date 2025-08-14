import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  Zap,
  Eye,
  CheckCheck,
} from "lucide-react";

const NotificationBell = ({ onOpenCenter }) => {
  const [stats, setStats] = useState({ total: 0, unread: 0, urgent: 0 });
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentNotifications();

    // Auto-refresh a cada 60 segundos
    const interval = setInterval(() => {
      fetchStats();
      fetchRecentNotifications();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/notifications/stats", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas de notificações:", error);
    }
  };

  const fetchRecentNotifications = async () => {
    try {
      const response = await fetch("/api/notifications?limit=5", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setRecentNotifications(data.notifications);
      }
    } catch (error) {
      console.error("Erro ao buscar notificações recentes:", error);
    } finally {
      setLoading(false);
    }
  };

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
        // Atualizar localmente
        setRecentNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
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
        setRecentNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true }))
        );
        setStats((prev) => ({ ...prev, unread: 0 }));
      }
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-3 h-3 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="w-3 h-3 text-amber-500" />;
      case "error":
        return <XCircle className="w-3 h-3 text-rose-500" />;
      case "urgent":
        return <Zap className="w-3 h-3 text-amber-500" />;
      default:
        return <Info className="w-3 h-3 text-blue-400" />;
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      window.location.href = notification.action_url;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          {stats.unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
            >
              {stats.unread > 9 ? "9+" : stats.unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80" align="end">
        <div className="px-4 py-2 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Notificações</h4>
            {stats.unread > 0 && (
              <Badge variant="secondary" className="text-xs">
                {stats.unread} nova{stats.unread !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : recentNotifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma notificação
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-64">
              <div className="py-1">
                {recentNotifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`px-4 py-3 cursor-pointer ${
                      !notification.is_read
                        ? "bg-blue-50 dark:bg-blue-950/20"
                        : ""
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3 w-full">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.notification_type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p
                            className={`text-sm font-medium truncate ${
                              !notification.is_read
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {notification.title}
                          </p>

                          {notification.is_urgent && (
                            <Zap className="w-3 h-3 text-orange-500 flex-shrink-0 ml-1" />
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>

                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.time_ago}
                        </p>
                      </div>

                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            </ScrollArea>

            <DropdownMenuSeparator />

            <div className="px-2 py-1">
              <div className="flex items-center justify-between space-x-2">
                {stats.unread > 0 && (
                  <DropdownMenuItem
                    onClick={markAllAsRead}
                    className="flex-1 justify-center text-xs"
                  >
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Marcar todas como lidas
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={onOpenCenter}
                  className="flex-1 justify-center text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Ver todas
                </DropdownMenuItem>
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
