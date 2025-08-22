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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Edit,
  Users,
  DollarSign,
  Target,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

const RetasManagement = ({ userRole }) => {
  const [retas, setRetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingReta, setEditingReta] = useState(null);
  const [error, setError] = useState("");

  const [retaForm, setRetaForm] = useState({
    name: "",
    min_stake: "",
    max_stake: "",
    description: "",
  });

  useEffect(() => {
    fetchRetas();
  }, []);

  const fetchRetas = async () => {
    try {
      const response = await fetch("/api/retas", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setRetas(data.retas);
      }
    } catch (err) {
      console.error("Erro ao carregar retas:", err);
      setError("Erro ao carregar retas");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // Validações
      if (!retaForm.name.trim()) {
        setError("Nome da reta é obrigatório");
        return;
      }

      const minStake = parseFloat(retaForm.min_stake);
      const maxStake = parseFloat(retaForm.max_stake);

      if (minStake <= 0 || maxStake <= 0) {
        setError("Stakes devem ser valores positivos");
        return;
      }

      if (minStake >= maxStake) {
        setError("Stake mínimo deve ser menor que o máximo");
        return;
      }

      const method = editingReta ? "PUT" : "POST";
      const url = editingReta ? `/api/retas/${editingReta.id}` : "/api/retas";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: retaForm.name.trim(),
          min_stake: minStake,
          max_stake: maxStake,
          description: retaForm.description.trim(),
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setShowCreateModal(false);
        setEditingReta(null);
        setRetaForm({
          name: "",
          min_stake: "",
          max_stake: "",
          description: "",
        });
        fetchRetas(); // Recarregar lista
      } else {
        setError(data.error || "Erro ao salvar reta");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    }
  };

  const handleEdit = (reta) => {
    setEditingReta(reta);
    setRetaForm({
      name: reta.name,
      min_stake: reta.min_stake.toString(),
      max_stake: reta.max_stake.toString(),
      description: reta.description || "",
    });
    setShowCreateModal(true);
  };

  const handleChange = (field, value) => {
    setRetaForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const resetForm = () => {
    setRetaForm({
      name: "",
      min_stake: "",
      max_stake: "",
      description: "",
    });
    setEditingReta(null);
    setError("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando retas...</p>
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
              <CardTitle className="gradient-gold-text">
                Gestão de Retas
              </CardTitle>
              <CardDescription>
                Configure os níveis de stakes e permissões por jogador
              </CardDescription>
            </div>
            {userRole === "admin" && (
              <Button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="gradient-gold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Reta
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Total de Retas
                </p>
                <p className="text-2xl font-bold">{retas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Jogadores Ativos
                </p>
                <p className="text-2xl font-bold">
                  {retas.reduce((acc, reta) => acc + reta.player_count, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Range Total
                </p>
                <p className="text-lg font-bold">
                  {retas.length > 0 &&
                    `${formatCurrency(
                      Math.min(...retas.map((r) => r.min_stake))
                    )} - ${formatCurrency(
                      Math.max(...retas.map((r) => r.max_stake))
                    )}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Retas */}
      <Card>
        <CardHeader>
          <CardTitle>📋 Retas Configuradas</CardTitle>
          <CardDescription>
            Clique em uma reta para gerenciar permissões específicas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {retas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-4" />
              <p>Nenhuma reta configurada</p>
              <p className="text-sm">
                Crie a primeira reta para começar a organizar os jogadores
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Range de Stakes</TableHead>
                    <TableHead>Jogadores</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    {userRole === "admin" && (
                      <TableHead className="text-right">Ações</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retas.map((reta) => (
                    <TableRow
                      key={reta.id}
                      className="cursor-pointer hover:bg-secondary/20"
                    >
                      <TableCell className="font-medium">
                        <span>{reta.name}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium">
                            {formatCurrency(reta.min_stake)}
                          </span>
                          <span className="text-muted-foreground">-</span>
                          <span className="text-sm font-medium">
                            {formatCurrency(reta.max_stake)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{reta.player_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {reta.description || "Sem descrição"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={reta.is_active ? "default" : "secondary"}
                        >
                          {reta.is_active ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Ativa
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Inativa
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      {userRole === "admin" && (
                        <TableCell className="text-right">
                          <div className="flex space-x-1 justify-end">
                            <Button
                              size="sm"
                              onClick={() => handleEdit(reta)}
                              className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 shadow-lg"
                              title="Editar Reta"
                            >
                              <Edit className="w-3 h-3" />
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
        <DialogContent className="sm:max-w-md reta-modal-fix">
          <DialogHeader>
            <DialogTitle className="gradient-gold-text text-xl">
              {editingReta ? "✏️ Editar Reta" : "➕ Nova Reta"}
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              {editingReta
                ? "Modifique os dados da reta selecionada"
                : "Configure uma nova reta para organizar os jogadores"}
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
              <Label
                htmlFor="name"
                className="text-gray-200 font-medium flex items-center gap-2"
              >
                🎯 Nome da Reta
              </Label>
              <Input
                id="name"
                placeholder="Ex: Reta 0, Reta 1..."
                value={retaForm.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
                className="bg-gray-700 border-2 border-yellow-500 text-white placeholder:text-gray-400 focus:border-yellow-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="min_stake"
                  className="text-gray-200 font-medium flex items-center gap-2"
                >
                  💰 Stake Mínimo
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-yellow-400" />
                  <Input
                    id="min_stake"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="1.00"
                    value={retaForm.min_stake}
                    onChange={(e) => handleChange("min_stake", e.target.value)}
                    className="pl-10 bg-gray-700 border-2 border-yellow-500 text-white placeholder:text-gray-400 focus:border-yellow-400"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="max_stake"
                  className="text-gray-200 font-medium flex items-center gap-2"
                >
                  💎 Stake Máximo
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-yellow-400" />
                  <Input
                    id="max_stake"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="2.50"
                    value={retaForm.max_stake}
                    onChange={(e) => handleChange("max_stake", e.target.value)}
                    className="pl-10 bg-gray-700 border-2 border-yellow-500 text-white placeholder:text-gray-400 focus:border-yellow-400"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-gray-200 font-medium flex items-center gap-2"
              >
                📝 Descrição (opcional)
              </Label>
              <Textarea
                id="description"
                placeholder="Descrição detalhada da reta, regras específicas..."
                value={retaForm.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                className="bg-gray-700 border-2 border-yellow-500 text-white placeholder:text-gray-400 focus:border-yellow-400 resize-none"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                className="bg-gray-600 border-gray-500 text-gray-200 hover:bg-gray-500 hover:text-white"
                onClick={() => setShowCreateModal(false)}
              >
                ❌ Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-semibold border border-yellow-400"
              >
                {editingReta ? "✅ Atualizar" : "➕ Criar"} Reta
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RetasManagement;
