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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Database,
  Download,
  Upload,
  Trash2,
  Shield,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const BackupManagement = ({ userRole }) => {
  const [backupStatus, setBackupStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupDescription, setBackupDescription] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10 });

  useEffect(() => {
    if (userRole === "admin") {
      fetchBackupStatus();
      fetchBackups();
    }
  }, [userRole, pagination.page]);

  const fetchBackupStatus = async () => {
    try {
      const response = await fetch("/api/backup/status", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setBackupStatus(data);
      } else {
        toast.error("Erro ao carregar status do backup");
      }
    } catch (error) {
      console.error("Erro ao buscar status:", error);
      toast.error("Erro de conexão");
    }
  };

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/backup/list?page=${pagination.page}&per_page=${pagination.per_page}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups);
        setPagination((prev) => ({ ...prev, ...data.pagination }));
      } else {
        toast.error("Erro ao carregar lista de backups");
      }
    } catch (error) {
      console.error("Erro ao buscar backups:", error);
      toast.error("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      const response = await fetch("/api/backup/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          description: backupDescription || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Backup criado com sucesso!", {
          description: `Arquivo: ${data.backup_info.filename}`,
        });
        setBackupDescription("");
        setShowCreateDialog(false);
        fetchBackupStatus();
        fetchBackups();
      } else {
        const error = await response.json();
        toast.error("Erro ao criar backup", {
          description: error.error,
        });
      }
    } catch (error) {
      console.error("Erro ao criar backup:", error);
      toast.error("Erro de conexão");
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = async (filename) => {
    try {
      const response = await fetch(`/api/backup/download/${filename}`, {
        credentials: "include",
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Download iniciado");
      } else {
        toast.error("Erro ao fazer download do backup");
      }
    } catch (error) {
      console.error("Erro no download:", error);
      toast.error("Erro de conexão");
    }
  };

  const deleteBackup = async (filename) => {
    try {
      const response = await fetch(`/api/backup/delete/${filename}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Backup deletado com sucesso");
        fetchBackupStatus();
        fetchBackups();
      } else {
        const error = await response.json();
        toast.error("Erro ao deletar backup", {
          description: error.error,
        });
      }
    } catch (error) {
      console.error("Erro ao deletar backup:", error);
      toast.error("Erro de conexão");
    }
  };

  const toggleAutoBackup = async (action) => {
    try {
      const response = await fetch(`/api/backup/auto-backup/${action}`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchBackupStatus();
      } else {
        const error = await response.json();
        toast.error(`Erro ao ${action} backup automático`, {
          description: error.error,
        });
      }
    } catch (error) {
      console.error(`Erro ao ${action} backup automático:`, error);
      toast.error("Erro de conexão");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString("pt-BR");
  };

  if (userRole !== "admin") {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Acesso restrito a administradores
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status do Sistema de Backup */}
      {backupStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Status do Banco
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {backupStatus.database_info.wal_mode ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span className="text-sm">
                  {backupStatus.database_info.wal_mode ? "WAL Mode" : "Normal"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tamanho: {formatFileSize(backupStatus.database_info.size)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Backup Automático
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {backupStatus.automatic_backup_running ? (
                  <Badge variant="default" className="bg-green-500">
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inativo</Badge>
                )}
              </div>
              <div className="mt-2 space-x-1">
                {backupStatus.automatic_backup_running ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAutoBackup("stop")}
                  >
                    <Pause className="w-3 h-3 mr-1" />
                    Parar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAutoBackup("start")}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Iniciar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Backups
              </CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold invictus-gold">
                {backupStatus.total_backups}
              </div>
              <p className="text-xs text-muted-foreground">
                Máximo: {backupStatus.max_backups_retained}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ações</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setShowCreateDialog(true)}
                  disabled={creating}
                >
                  {creating ? (
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3 mr-1" />
                  )}
                  Backup Manual
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    fetchBackupStatus();
                    fetchBackups();
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Backups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Backups Disponíveis</span>
          </CardTitle>
          <CardDescription>
            Lista de todos os backups do sistema com opções de download e
            restauração
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando backups...</p>
            </div>
          ) : backups.length > 0 ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.filename}>
                      <TableCell className="font-medium">
                        {formatDate(backup.datetime)}
                      </TableCell>
                      <TableCell>{backup.description}</TableCell>
                      <TableCell>{formatFileSize(backup.size)}</TableCell>
                      <TableCell>
                        {backup.verified ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verificado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Não verificado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadBackup(backup.filename)}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Deletar Backup
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja deletar o backup{" "}
                                  <strong>{backup.filename}</strong>? Esta ação
                                  não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    deleteBackup(backup.filename)
                                  }
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Deletar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginação */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Página {pagination.page} de {pagination.pages} ({pagination.total} backups)
                  </div>
                  <div className="space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pagination.has_prev}
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page - 1,
                        }))
                      }
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!pagination.has_next}
                      onClick={() =>
                        setPagination((prev) => ({
                          ...prev,
                          page: prev.page + 1,
                        }))
                      }
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum backup encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Criar Backup */}
      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar Backup Manual</AlertDialogTitle>
            <AlertDialogDescription>
              Criar um backup manual do banco de dados. O backup será salvo com
              timestamp automático.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (Opcional)</Label>
              <Input
                id="description"
                placeholder="Ex: Backup antes da atualização..."
                value={backupDescription}
                onChange={(e) => setBackupDescription(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={createBackup}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {creating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Criar Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BackupManagement;

