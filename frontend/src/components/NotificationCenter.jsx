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
import NotificationTemplates from "./NotificationTemplates";

const NotificationCenter = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ total: 0, unread: 0, urgent: 0 });
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [filter, setFilter] = useState("all"); // all, unread, urgent
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [entityDetails, setEntityDetails] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Templates de notificação
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateRequest, setTemplateRequest] = useState(null);

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

      const response = await fetch(`/api/notifications/?${params.toString()}`, {
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
      return <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />;

    switch (type) {
      case "success":
        return (
          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
        );
      case "warning":
        return (
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        );
      case "error":
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "urgent":
        return <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
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
      setEntityDetails(null);
      // Carregar detalhes da entidade relacionada (para habilitar botões de ação)
      try {
        if (
          notification.related_entity_type === "reload_request" &&
          notification.related_entity_id
        ) {
          const res = await fetch(
            `/api/reload_requests/${notification.related_entity_id}`,
            { credentials: "include" }
          );
          if (res.ok) {
            const json = await res.json();
            setEntityDetails({ type: "reload", data: json.reload_request });
          }
        } else if (
          notification.related_entity_type === "withdrawal_request" &&
          notification.related_entity_id
        ) {
          const res = await fetch(
            `/api/withdrawal_requests/${notification.related_entity_id}`,
            { credentials: "include" }
          );
          if (res.ok) {
            const json = await res.json();
            setEntityDetails({
              type: "withdrawal",
              data: json.withdrawal_request,
            });
          }
        }
      } catch (e) {
        // Silencioso; ainda mostramos o modal sem ações
      }
    }
  };

  // Templates de notificação
  const openTemplateModal = (action, entityId, entityType) => {
    setTemplateRequest({
      action,
      entityId,
      entityType,
      type: entityType === "reload_request" ? "reload" : "withdrawal",
    });
    setShowTemplateModal(true);
  };

  const handleTemplateSubmit = async (templateData) => {
    const { action, entityId, entityType } = templateRequest;

    setActionLoading(true);
    try {
      let endpoint;
      let payload = {};

      if (entityType === "reload_request") {
        endpoint = `/api/reload_requests/${entityId}/${action}`;
        payload = {
          manager_notes: templateData.message,
          template_id: templateData.templateId,
        };
      } else if (entityType === "withdrawal_request") {
        endpoint = `/api/withdrawal_requests/${entityId}/${action}`;
        if (action === "complete") {
          payload = {
            completion_notes: templateData.message,
            template_id: templateData.templateId,
          };
        } else {
          payload = {
            manager_notes: templateData.message,
            template_id: templateData.templateId,
          };
        }
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Criar notificação personalizada para o jogador
        if (entityDetails?.user_id) {
          await createPlayerNotification(
            entityDetails.user_id,
            templateData.message
          );
        }

        toast.success(
          `Solicitação ${
            action === "approve"
              ? "aprovada"
              : action === "reject"
              ? "rejeitada"
              : "completada"
          } com sucesso!`
        );
        await fetchNotifications();
        setShowDialog(false);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Erro ao processar ação");
      }
    } catch (error) {
      console.error("Erro ao processar ação:", error);
      toast.error("Erro ao processar ação");
    } finally {
      setActionLoading(false);
    }
  };

  const createPlayerNotification = async (userId, message) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_id: userId,
          title: "📋 Atualização da Solicitação",
          message,
          type: "info",
          is_urgent: false,
        }),
      });
    } catch (error) {
      console.error("Erro ao criar notificação:", error);
    }
  };

  // Ações de Reload
  const approveReload = async (id) => {
    openTemplateModal("approve", id, "reload_request");
  };

  const rejectReload = async (id) => {
    openTemplateModal("reject", id, "reload_request");
  };

  // Ações de Saque
  const approveWithdrawal = async (id) => {
    openTemplateModal("approve", id, "withdrawal_request");
  };

  const rejectWithdrawal = async (id) => {
    openTemplateModal("reject", id, "withdrawal_request");
  };

  const completeWithdrawal = async (id) => {
    openTemplateModal("complete", id, "withdrawal_request");
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
                    className={`p-4 cursor-pointer transition-colors notification-light ${
                      !notification.is_read
                        ? "bg-primary/5 dark:bg-primary/10 border-l-2 border-primary"
                        : "hover:bg-muted/30"
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

                          <div className="flex items-center gap-1">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const res = await fetch(
                                  `/api/notifications/${notification.id}`,
                                  { method: "DELETE", credentials: "include" }
                                );
                                if (res.ok) {
                                  setNotifications((prev) =>
                                    prev.filter((n) => n.id !== notification.id)
                                  );
                                  setStats((prev) => ({
                                    ...prev,
                                    total: Math.max(0, prev.total - 1),
                                    unread:
                                      prev.unread -
                                      (notification.is_read ? 0 : 1),
                                  }));
                                }
                              }}
                              className="h-6 px-2 text-rose-600 dark:text-rose-400"
                            >
                              Remover
                            </Button>
                          </div>
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
              <div className="mt-4 p-3 bg-red-600/20 rounded-lg border border-red-500/50">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-red-300">
                    Esta é uma notificação urgente
                  </span>
                </div>
              </div>
            )}

            {entityDetails && (
              <div className="mt-4 text-sm rounded-md border border-border p-3 bg-secondary/30">
                {entityDetails.type === "reload" && (
                  <div className="space-y-1">
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>{" "}
                      Reload
                    </div>
                    {entityDetails.data?.status && (
                      <div>
                        <span className="text-muted-foreground">Status:</span>{" "}
                        {entityDetails.data.status}
                      </div>
                    )}
                    {entityDetails.data?.amount != null && (
                      <div>
                        <span className="text-muted-foreground">Valor:</span> ${" "}
                        {Number(entityDetails.data.amount).toFixed(2)}
                      </div>
                    )}
                    {entityDetails.data?.platform_name && (
                      <div>
                        <span className="text-muted-foreground">
                          Plataforma:
                        </span>{" "}
                        {entityDetails.data.platform_name}
                      </div>
                    )}
                  </div>
                )}
                {entityDetails.type === "withdrawal" && (
                  <div className="space-y-1">
                    <div>
                      <span className="text-muted-foreground">Tipo:</span> Saque
                    </div>
                    {entityDetails.data?.status && (
                      <div>
                        <span className="text-muted-foreground">Status:</span>{" "}
                        {entityDetails.data.status}
                      </div>
                    )}
                    {entityDetails.data?.amount != null && (
                      <div>
                        <span className="text-muted-foreground">Valor:</span> ${" "}
                        {Number(entityDetails.data.amount).toFixed(2)}
                      </div>
                    )}
                    {entityDetails.data?.platform_name && (
                      <div>
                        <span className="text-muted-foreground">
                          Plataforma:
                        </span>{" "}
                        {entityDetails.data.platform_name}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="border-border text-foreground"
            >
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
            {/* Botões de ação diretos */}
            {user?.role &&
              (user.role === "admin" || user.role === "manager") &&
              entityDetails && (
                <>
                  {entityDetails.type === "reload" &&
                    entityDetails.data?.status === "pending" && (
                      <>
                        <Button
                          disabled={actionLoading}
                          onClick={() => approveReload(entityDetails.data.id)}
                        >
                          Aprovar Reload
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={actionLoading}
                          onClick={() => rejectReload(entityDetails.data.id)}
                        >
                          Rejeitar Reload
                        </Button>
                      </>
                    )}
                  {entityDetails.type === "withdrawal" && (
                    <>
                      {entityDetails.data?.status === "pending" && (
                        <>
                          <Button
                            disabled={actionLoading}
                            onClick={() =>
                              approveWithdrawal(entityDetails.data.id)
                            }
                          >
                            Aprovar Saque
                          </Button>
                          <Button
                            variant="destructive"
                            disabled={actionLoading}
                            onClick={() =>
                              rejectWithdrawal(entityDetails.data.id)
                            }
                          >
                            Rejeitar Saque
                          </Button>
                        </>
                      )}
                      {entityDetails.data?.status === "approved" && (
                        <Button
                          disabled={actionLoading}
                          onClick={() =>
                            completeWithdrawal(entityDetails.data.id)
                          }
                        >
                          Marcar como Concluído
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Templates de Notificação */}
      <NotificationTemplates
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        request={templateRequest}
        type={templateRequest?.type}
        onSubmit={handleTemplateSubmit}
      />
    </div>
  );
};

export default NotificationCenter;
