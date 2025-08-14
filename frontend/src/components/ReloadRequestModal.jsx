import { formatUSD } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";

const ReloadRequestModal = ({ isOpen, onClose, userId, onSuccess }) => {
  const [platforms, setPlatforms] = useState([]);
  const [userAccounts, setUserAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    platform_id: "",
    amount: "",
    player_notes: "",
  });

  useEffect(() => {
    if (isOpen) {
      fetchPlatforms();
      fetchUserAccounts();
      setError("");
      setSuccess(false);
      setFormData({
        platform_id: "",
        amount: "",
        player_notes: "",
      });
    }
  }, [isOpen, userId]);

  // Auto-selecionar Luxon quando as plataformas são carregadas
  useEffect(() => {
    if (platforms.length > 0 && !formData.platform_id) {
      const luxonPlatform = platforms.find((p) => p.name === "luxon");
      if (luxonPlatform) {
        setFormData((prev) => ({
          ...prev,
          platform_id: luxonPlatform.id.toString(),
        }));
      }
    }
  }, [platforms, formData.platform_id]);

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

  const fetchUserAccounts = async () => {
    try {
      const response = await fetch(`/api/accounts?user_id=${userId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setUserAccounts(data.accounts.filter((acc) => acc.is_active));
      }
    } catch (err) {
      console.error("Erro ao carregar contas:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validações
      if (!formData.platform_id) {
        setError("Selecione uma plataforma");
        return;
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setError("Informe um valor válido maior que zero");
        return;
      }

      // Para Luxon, não é necessário verificar conta (vai direto para aprovação)
      const selectedPlatform = platforms.find(
        (p) => p.id === parseInt(formData.platform_id)
      );
      const isLuxon = selectedPlatform?.name === "luxon";

      if (!isLuxon) {
        // Verificar se usuário tem conta na plataforma apenas para outras plataformas
        const hasAccount = userAccounts.some(
          (acc) =>
            acc.platform_id === parseInt(formData.platform_id) &&
            acc.has_account
        );

        if (!hasAccount) {
          setError("Você não possui conta ativa nesta plataforma");
          return;
        }
      }

      const response = await fetch("/api/reload-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          platform_id: parseInt(formData.platform_id),
          amount: parseFloat(formData.amount),
          user_id: userId,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess && onSuccess(data.reload_request);
          onClose();
        }, 2000);
      } else {
        setError(data.error || "Erro ao criar solicitação");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getSelectedPlatform = () => {
    return platforms.find((p) => p.id === parseInt(formData.platform_id));
  };

  const getAccountForPlatform = () => {
    return userAccounts.find(
      (acc) => acc.platform_id === parseInt(formData.platform_id)
    );
  };

  const formatCurrency = (value) => formatUSD(value);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="gradient-gold-text flex items-center">
            <Upload className="w-5 h-5 mr-2" />
            Solicitar Reload
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para solicitar um reload em sua conta.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Solicitação Criada!</h3>
            <p className="text-muted-foreground">
              Sua solicitação de reload foi enviada e está aguardando aprovação.
            </p>
          </div>
        ) : (
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
                value={formData.platform_id}
                onValueChange={(value) => handleChange("platform_id", value)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => {
                    const account = userAccounts.find(
                      (acc) => acc.platform_id === platform.id
                    );
                    const hasAccount = account && account.has_account;

                    return (
                      <SelectItem
                        key={platform.id}
                        value={platform.id.toString()}
                        disabled={!hasAccount}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{platform.display_name}</span>
                          {hasAccount ? (
                            <span className="text-xs text-green-500 ml-2">
                              {formatCurrency(account.current_balance)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground ml-2">
                              Sem conta
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {formData.platform_id && (
                <div className="text-sm text-muted-foreground">
                  {(() => {
                    const account = getAccountForPlatform();
                    if (account && account.has_account) {
                      return (
                        <div className="flex justify-between bg-secondary/20 p-2 rounded">
                          <span>Saldo atual:</span>
                          <span className="font-medium invictus-gold">
                            {formatCurrency(account.current_balance)}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor do Reload</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => handleChange("amount", e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Motivo do reload, observações adicionais..."
                value={formData.player_notes}
                onChange={(e) => handleChange("player_notes", e.target.value)}
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !formData.platform_id || !formData.amount}
                className="gradient-gold"
              >
                {loading ? "Enviando..." : "Solicitar Reload"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReloadRequestModal;
