import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, AlertTriangle, ChevronRight } from "lucide-react";

const ApprovalAlert = ({ onNavigateToApproval }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingCount();
    // Verificar a cada 30 segundos
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingCount = async () => {
    try {
      const response = await fetch("/api/registration/pending", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setPendingCount(data.total_pending || 0);
      }
    } catch (error) {
      console.error("Erro ao buscar aprovações pendentes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || pendingCount === 0) {
    return null;
  }

  return (
    <Alert className="border-orange-400/50 bg-orange-50/60 dark:bg-orange-950/20 mb-4">
      <AlertTriangle className="h-4 w-4 text-orange-500" />
      <AlertDescription className="flex items-center justify-between">
        <div className="text-orange-600 dark:text-orange-400">
          <div className="font-semibold text-orange-700 dark:text-orange-300 mb-1">
            🔔 Aprovações Pendentes
          </div>
          Você tem{" "}
          <Badge
            variant="outline"
            className="text-orange-600 border-orange-400"
          >
            {pendingCount}
          </Badge>{" "}
          {pendingCount === 1 ? "solicitação" : "solicitações"} de cadastro
          aguardando aprovação.
        </div>
        <Button
          size="sm"
          onClick={onNavigateToApproval}
          className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1"
        >
          <UserCheck className="w-3 h-3" />
          Aprovar Agora
          <ChevronRight className="w-3 h-3" />
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default ApprovalAlert;

