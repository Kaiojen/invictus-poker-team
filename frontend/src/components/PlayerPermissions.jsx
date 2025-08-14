import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Shield,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

const PlayerPermissions = ({ userId, userName, userRole }) => {
  const [permissions, setPermissions] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [error, setError] = useState("");

  const [permissionForm, setPermissionForm] = useState({
    platform_id: "",
    is_allowed: true,
    special_limit: "",
    special_limit_expires: "",
    notes: "",
  });

  useEffect(() => {
    fetchPermissions();
    fetchPlatforms();
  }, [userId]);

  const fetchPermissions = async () => {
    try {
      const response = await fetch(`/api/retas/permissions?user_id=${userId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      }
    } catch (err) {
      console.error("Erro ao carregar permissões:", err);
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
        setPlatforms(data.platforms.filter((p) => p.is_active));
      }
    } catch (err) {
      console.error("Erro ao carregar plataformas:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // Validações
      if (!permissionForm.platform_id) {
        setError("Selecione uma plataforma");
        return;
      }

      // Preparar dados
      const requestData = {
        user_id: userId,
        platform_id: parseInt(permissionForm.platform_id),
        is_allowed: permissionForm.is_allowed,
        notes: permissionForm.notes.trim(),
      };

      // Adicionar limite especial se fornecido
      if (permissionForm.special_limit) {
        const specialLimit = parseFloat(permissionForm.special_limit);
        if (specialLimit <= 0) {
          setError("Limite especial deve ser um valor positivo");
          return;
        }
        requestData.special_limit = specialLimit;
      }

      // Adicionar data de expiração se fornecida
      if (permissionForm.special_limit_expires) {
        requestData.special_limit_expires = new Date(
          permissionForm.special_limit_expires
        ).toISOString();
      }

      const response = await fetch("/api/retas/permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setShowCreateModal(false);
        setEditingPermission(null);
        resetForm();
        fetchPermissions(); // Recarregar lista
      } else {
        setError(data.error || "Erro ao salvar permissão");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    }
  };

  const handleDelete = async (permissionId) => {
    if (!confirm("Tem certeza que deseja remover esta permissão?")) return;

    try {
      const response = await fetch(`/api/retas/permissions/${permissionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        fetchPermissions(); // Recarregar lista
      } else {
        setError("Erro ao remover permissão");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    }
  };

  const handleEdit = (permission) => {
    setEditingPermission(permission);
    setPermissionForm({
      platform_id: permission.platform_id.toString(),
      is_allowed: permission.is_allowed,
      special_limit: permission.special_limit?.toString() || "",
      special_limit_expires: permission.special_limit_expires
        ? new Date(permission.special_limit_expires).toISOString().split("T")[0]
        : "",
      notes: permission.notes || "",
    });
    setShowCreateModal(true);
  };

  const handleChange = (field, value) => {
    setPermissionForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setPermissionForm({
      platform_id: "",
      is_allowed: true,
      special_limit: "",
      special_limit_expires: "",
      notes: "",
    });
    setEditingPermission(null);
    setError("");
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="gradient-gold-text flex items-center">
                <Shield className="w-6 h-6 mr-2" />
                🛡️ Permissões - {userName}
              </CardTitle>
              <CardDescription>
                Gerencie permissões específicas e liberações temporárias
              </CardDescription>
            </div>
            {userRole !== "player" && (
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="gradient-gold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Permissão
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Permissões */}
      <Card>
        <CardHeader>
          <CardTitle>🎮 Permissões por Plataforma</CardTitle>
          <CardDescription>
            Permissões específicas e liberações temporárias para cada site
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-4" />
              <p>Nenhuma permissão específica configurada</p>
              <p className="text-sm">
                O jogador seguirá as regras padrão da sua reta
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Limite Especial</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead>Criado por</TableHead>
                    {userRole !== "player" && (
                      <TableHead className="text-right">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="font-medium">
                        {permission.platform_name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            permission.is_allowed ? "default" : "destructive"
                          }
                        >
                          {permission.is_allowed ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Permitido
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Bloqueado
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {permission.special_limit ? (
                          <div className="flex items-center space-x-1">
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium invictus-gold">
                              {formatCurrency(permission.special_limit)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {permission.special_limit_expires ? (
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span
                              className={
                                isExpired(permission.special_limit_expires)
                                  ? "text-destructive"
                                  : "text-foreground"
                              }
                            >
                              {formatDate(permission.special_limit_expires)}
                            </span>
                            {isExpired(permission.special_limit_expires) && (
                              <Badge variant="destructive" className="ml-2">
                                Expirado
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {permission.notes || "Sem observações"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">
                            {permission.creator_name}
                          </div>
                          <div className="text-muted-foreground">
                            {formatDate(permission.created_at)}
                          </div>
                        </div>
                      </TableCell>
                      {userRole !== "player" && (
                        <TableCell className="text-right">
                          <div className="flex space-x-1 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(permission)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(permission.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="gradient-gold-text">
              {editingPermission ? "Editar Permissão" : "Nova Permissão"}
            </DialogTitle>
            <DialogDescription>
              Configure permissões específicas para {userName}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="platform">Plataforma</Label>
              <Select
                value={permissionForm.platform_id}
                onValueChange={(value) => handleChange("platform_id", value)}
                disabled={!!editingPermission}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem
                      key={platform.id}
                      value={platform.id.toString()}
                    >
                      {platform.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={permissionForm.is_allowed.toString()}
                onValueChange={(value) =>
                  handleChange("is_allowed", value === "true")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                      Permitido
                    </div>
                  </SelectItem>
                  <SelectItem value="false">
                    <div className="flex items-center">
                      <XCircle className="w-4 h-4 mr-2 text-red-500" />
                      Bloqueado
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {permissionForm.is_allowed && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="special_limit">
                    Limite Especial (opcional)
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="special_limit"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Ex: 7.50"
                      value={permissionForm.special_limit}
                      onChange={(e) =>
                        handleChange("special_limit", e.target.value)
                      }
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Limite maior que o da reta para liberações temporárias
                  </p>
                </div>

                {permissionForm.special_limit && (
                  <div className="space-y-2">
                    <Label htmlFor="expires">Data de Expiração</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="expires"
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={permissionForm.special_limit_expires}
                        onChange={(e) =>
                          handleChange("special_limit_expires", e.target.value)
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Motivo da permissão, contexto da liberação..."
                value={permissionForm.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="gradient-gold">
                {editingPermission ? "Atualizar" : "Criar"} Permissão
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlayerPermissions;
