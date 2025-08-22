import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import { formatUSD } from "@/lib/utils";

const WithdrawalRequestModal = ({ isOpen, onClose, userId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [bestAccount, setBestAccount] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchBestAccount();
      setError("");
      setSuccess(false);
      setAmount("");
      setNotes("");
    }
  }, [isOpen, userId]);

  const fetchBestAccount = async () => {
    try {
      const response = await fetch(`/api/accounts/?user_id=${userId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Encontrar conta com maior saldo disponível para saque
        const availableAccounts = data.accounts.filter(
          (acc) => acc.is_active && acc.has_account && acc.current_balance > 0
        );

        if (availableAccounts.length > 0) {
          // Pegar conta com maior saldo
          const best = availableAccounts.reduce((prev, current) =>
            current.current_balance > prev.current_balance ? current : prev
          );
          setBestAccount(best);
        }
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
      if (!amount || parseFloat(amount) <= 0) {
        setError("Informe um valor válido");
        return;
      }

      if (!bestAccount) {
        setError("Nenhuma conta disponível para saque");
        return;
      }

      if (parseFloat(amount) > bestAccount.current_balance) {
        setError(`Valor máximo: $${bestAccount.current_balance.toFixed(2)}`);
        return;
      }

      const response = await fetch("/api/withdrawal-requests/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform_id: bestAccount.platform_id,
          amount: parseFloat(amount),
          player_notes: notes || "Solicitação de saque",
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess && onSuccess(data.withdrawal_request);
          onClose();
          setAmount("");
          setNotes("");
        }, 1500);
      } else {
        setError(data.error || "Erro ao criar solicitação");
      }
    } catch (err) {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => formatUSD(value);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            💸 Solicitar Saque
          </DialogTitle>
          <DialogDescription className="text-foreground/70">
            Solicite um saque da sua melhor conta
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2 text-foreground">
              Solicitação Enviada!
            </h3>
            <p className="text-sm text-foreground/70">
              Aguardando aprovação do admin
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-700 dark:text-red-300 font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Info da Conta Selecionada Automaticamente */}
            {bestAccount && (
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-200">
                      💳 {bestAccount.platform_name}
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Saldo disponível:{" "}
                      {formatCurrency(bestAccount.current_balance)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="amount"
                  className="text-base font-bold text-foreground"
                >
                  💸 Valor do Saque
                </Label>
                {bestAccount && (
                  <button
                    type="button"
                    onClick={() =>
                      setAmount(bestAccount.current_balance.toString())
                    }
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Sacar Tudo ({formatCurrency(bestAccount.current_balance)})
                  </button>
                )}
              </div>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-blue-600" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={bestAccount?.current_balance || 0}
                  placeholder="100.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10 h-12 text-lg text-foreground bg-background border-2"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="notes"
                className="text-base font-bold text-foreground"
              >
                📝 Motivo do Saque
              </Label>
              <Textarea
                id="notes"
                placeholder="Ex: Lucro da sessão, pagamento..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={loading}
                className="mt-2 text-foreground bg-background border-2"
                required={parseFloat(amount) > 500}
              />
              {parseFloat(amount) > 500 && (
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1 font-medium">
                  * Motivo obrigatório para valores acima de $500
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1 border-2 text-foreground hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/20 font-medium"
              >
                ❌ Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  loading ||
                  !bestAccount ||
                  !amount ||
                  parseFloat(amount) > (bestAccount?.current_balance || 0) ||
                  (parseFloat(amount) > 500 && !notes.trim())
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {loading ? "Enviando..." : "🚀 Solicitar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalRequestModal;
