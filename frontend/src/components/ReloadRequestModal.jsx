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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [userAccounts, setUserAccounts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchUserAccounts();
      setError("");
      setSuccess(false);
      setAmount("");
      setNotes("");
    }
  }, [isOpen, userId]);

  const fetchUserAccounts = async () => {
    try {
      const response = await fetch(`/api/accounts/?user_id=${userId}`, {
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
      if (!amount || parseFloat(amount) <= 0) {
        setError("Informe um valor válido");
        return;
      }

      // Encontrar LuxonPay ou primeira conta ativa
      let targetPlatform = userAccounts.find(
        (acc) =>
          acc.platform_name && acc.platform_name.toLowerCase().includes("luxon")
      );

      if (!targetPlatform) {
        targetPlatform = userAccounts.find((acc) => acc.has_account);
      }

      if (!targetPlatform) {
        setError("Nenhuma conta disponível para reload");
        return;
      }

      const response = await fetch("/api/reload-requests/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform_id: targetPlatform.platform_id,
          amount: parseFloat(amount),
          player_notes: notes || "Solicitação de reload",
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess && onSuccess(data.reload_request);
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
            💰 Solicitar Reload
          </DialogTitle>
          <DialogDescription className="text-foreground/70">
            Solicite um reload para sua conta
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

            <div>
              <Label
                htmlFor="amount"
                className="text-base font-bold text-foreground"
              >
                💵 Valor do Reload
              </Label>
              <div className="relative mt-2">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-green-600" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
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
                📝 Motivo (opcional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Ex: Sessão perdida, preciso de mais bankroll..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={loading}
                className="mt-2 text-foreground bg-background border-2"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1 border-2 text-foreground hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/20"
              >
                ❌ Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || !amount}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
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

export default ReloadRequestModal;
