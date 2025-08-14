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
import {
  Download,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import { formatUSD } from "@/lib/utils";

const WithdrawalRequestModal = ({ isOpen, onClose, userId, onSuccess }) => {
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
        // Filtrar apenas contas ativas com saldo positivo (sem makeup)
        setUserAccounts(
          data.accounts.filter(
            (acc) => acc.is_active && acc.has_account && acc.current_balance > 0
          )
        );
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

      // Verificar se usuário tem conta na plataforma e saldo suficiente
      const account = userAccounts.find(
        (acc) => acc.platform_id === parseInt(formData.platform_id)
      );

      if (!account) {
        setError(
          "Você não possui conta ativa com saldo disponível nesta plataforma"
        );
        return;
      }

      if (account.current_balance <= 0) {
        setError("Não é possível sacar de contas com saldo negativo ou zerado");
        return;
      }

      if (parseFloat(formData.amount) > account.current_balance) {
        setError("Valor solicitado excede o saldo disponível");
        return;
      }

      const response = await fetch("/api/withdrawal-requests", {
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
          onSuccess && onSuccess(data.withdrawal_request);
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

  const getAccountForPlatform = () => {
    return userAccounts.find(
      (acc) => acc.platform_id === parseInt(formData.platform_id)
    );
  };

  const formatCurrency = (value) => formatUSD(value);

  const getMaxWithdrawal = () => {
    const account = getAccountForPlatform();
    return account ? account.current_balance : 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="gradient-gold-text flex items-center">
            <Download className="w-5 h-5 mr-2" />
            Solicitar Saque
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para solicitar um saque de sua conta.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Solicitação Criada!</h3>
            <p className="text-muted-foreground">
              Sua solicitação de saque foi enviada e está aguardando aprovação.
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
                  {userAccounts
                    .filter((acc) => acc.current_balance > 0)
                    .map((account) => {
                      const platform = platforms.find(
                        (p) => p.id === account.platform_id
                      );

                      return platform ? (
                        <SelectItem
                          key={account.platform_id}
                          value={account.platform_id.toString()}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{platform.display_name}</span>
                            <span className="text-xs status-complete ml-2">
                              {formatCurrency(account.current_balance)}
                            </span>
                          </div>
                        </SelectItem>
                      ) : null;
                    })}
                </SelectContent>
              </Select>

              {formData.platform_id && (
                <div className="text-sm">
                  {(() => {
                    const account = getAccountForPlatform();
                    if (account) {
                      return (
                        <div className="bg-secondary/20 p-3 rounded space-y-2">
                          <div className="flex justify-between">
                            <span>Saldo disponível:</span>
                            <span className="font-medium invictus-gold">
                              {formatCurrency(account.current_balance)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Valor máximo:</span>
                            <span>
                              {formatCurrency(account.current_balance)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor do Saque</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={getMaxWithdrawal()}
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => handleChange("amount", e.target.value)}
                  className="pl-10"
                  disabled={loading}
                  required
                />
              </div>

              {formData.platform_id && getMaxWithdrawal() > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Máximo disponível:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleChange("amount", getMaxWithdrawal().toString())
                    }
                    className="text-primary hover:underline"
                  >
                    {formatCurrency(getMaxWithdrawal())} (sacar tudo)
                  </button>
                </div>
              )}

              {parseFloat(formData.amount) > getMaxWithdrawal() &&
                formData.amount && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      O valor não pode exceder o saldo disponível.
                    </AlertDescription>
                  </Alert>
                )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Motivo do Saque</Label>
              <Textarea
                id="notes"
                placeholder="Explique o motivo do saque (obrigatório para valores altos)..."
                value={formData.player_notes}
                onChange={(e) => handleChange("player_notes", e.target.value)}
                rows={3}
                disabled={loading}
                required={parseFloat(formData.amount) > 500}
              />
            </div>

            {parseFloat(formData.amount) > 500 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Saques acima de $500 precisam de justificativa e podem demorar
                  mais para ser aprovados.
                </AlertDescription>
              </Alert>
            )}

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
                disabled={
                  loading ||
                  !formData.platform_id ||
                  !formData.amount ||
                  parseFloat(formData.amount) > getMaxWithdrawal() ||
                  (parseFloat(formData.amount) > 500 &&
                    !formData.player_notes.trim())
                }
                className="gradient-gold"
              >
                {loading ? "Enviando..." : "Solicitar Saque"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalRequestModal;
