import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Copy,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

const NotificationTemplates = ({
  isOpen,
  onClose,
  request,
  type,
  onSubmit,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Templates pré-definidos
  const templates = {
    reload: {
      approved: [
        {
          id: "reload_sent",
          title: "✅ Reload Enviado",
          message:
            "Seu reload de ${amount} foi processado e enviado para sua conta. Bom jogo! 🎯",
        },
        {
          id: "reload_processed",
          title: "✅ Reload Confirmado",
          message:
            "Reload de ${amount} processado com sucesso. Valor disponível em sua conta. Boa sorte nas mesas! 🔥",
        },
        {
          id: "reload_custom",
          title: "✅ Reload Personalizado",
          message: "", // Will be filled by customMessage
        },
      ],
      rejected: [
        {
          id: "reload_insufficient_docs",
          title: "❌ Reload Rejeitado - Documentação",
          message:
            "Seu reload foi rejeitado por falta de documentação válida. Por favor, entre em contato para regularizar.",
        },
        {
          id: "reload_limit_exceeded",
          title: "❌ Reload Rejeitado - Limite",
          message:
            "Reload rejeitado: limite diário/semanal excedido. Aguarde o próximo período ou entre em contato.",
        },
        {
          id: "reload_custom_reject",
          title: "❌ Reload Rejeitado",
          message: "", // Will be filled by customMessage
        },
      ],
    },
    withdrawal: {
      approved: [
        {
          id: "withdrawal_processing",
          title: "✅ Saque Aprovado - Em Processamento",
          message:
            "Seu saque de ${amount} foi aprovado e está sendo processado. Prazo: 1-3 dias úteis. 💰",
        },
        {
          id: "withdrawal_sent",
          title: "✅ Saque Realizado",
          message:
            "Saque de ${amount} foi enviado para sua conta. Verifique seu extrato bancário em até 24h. ✅",
        },
        {
          id: "withdrawal_custom",
          title: "✅ Saque Personalizado",
          message: "", // Will be filled by customMessage
        },
      ],
      rejected: [
        {
          id: "withdrawal_insufficient_balance",
          title: "❌ Saque Rejeitado - Saldo Insuficiente",
          message:
            "Saque rejeitado: saldo insuficiente ou makeup pendente. Verifique sua planilha.",
        },
        {
          id: "withdrawal_docs_pending",
          title: "❌ Saque Rejeitado - Documentação",
          message:
            "Saque rejeitado: documentação pendente ou inválida. Regularize para liberar saques.",
        },
        {
          id: "withdrawal_custom_reject",
          title: "❌ Saque Rejeitado",
          message: "", // Will be filled by customMessage
        },
      ],
      completed: [
        {
          id: "withdrawal_completed",
          title: "🏁 Saque Concluído",
          message:
            "Seu saque de ${amount} foi processado e concluído com sucesso! O valor já deve estar disponível em sua conta. ✅",
        },
        {
          id: "withdrawal_completed_custom",
          title: "🏁 Saque Concluído - Personalizado",
          message: "", // Will be filled by customMessage
        },
      ],
    },
  };

  const currentTemplates = templates[type]?.[request?.action] || [];

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    const template = currentTemplates.find((t) => t.id === templateId);
    if (
      template &&
      template.message &&
      !template.message.includes("${amount}")
    ) {
      setCustomMessage(template.message);
    } else {
      setCustomMessage("");
    }
  };

  const generateMessage = () => {
    const template = currentTemplates.find((t) => t.id === selectedTemplate);
    if (!template) return customMessage;

    if (template.message.includes("${amount}")) {
      return template.message.replace("${amount}", amount || "[VALOR]");
    }

    return template.message || customMessage;
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) {
      toast.error("Selecione um template");
      return;
    }

    const finalMessage = generateMessage();
    if (!finalMessage.trim()) {
      toast.error("Mensagem não pode estar vazia");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        templateId: selectedTemplate,
        message: finalMessage,
        amount: amount,
      });
      toast.success("Notificação enviada com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao enviar notificação");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    const message = generateMessage();
    navigator.clipboard.writeText(message);
    toast.success("Mensagem copiada!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {request?.action === "approve" || request?.action === "complete" ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            Templates de Notificação - {type === "reload" ? "Reload" : "Saque"}{" "}
            (
            {request?.action === "complete"
              ? "Concluir"
              : request?.action === "approve"
              ? "Aprovar"
              : "Rejeitar"}
            )
          </DialogTitle>
          <DialogDescription>
            Escolha um template para notificar o jogador sobre a decisão
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção de Template */}
          <div>
            <Label htmlFor="template">Template</Label>
            <Select
              value={selectedTemplate}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template..." />
              </SelectTrigger>
              <SelectContent>
                {currentTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo de valor se necessário */}
          {selectedTemplate &&
            currentTemplates
              .find((t) => t.id === selectedTemplate)
              ?.message?.includes("${amount}") && (
              <div>
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  placeholder="Ex: $1,500.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            )}

          {/* Mensagem personalizada para templates custom */}
          {selectedTemplate && selectedTemplate.includes("custom") && (
            <div>
              <Label htmlFor="custom-message">Mensagem Personalizada</Label>
              <Textarea
                id="custom-message"
                placeholder="Digite sua mensagem personalizada..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Preview da mensagem */}
          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Preview da Mensagem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-line">
                    {generateMessage() ||
                      "Selecione um template ou digite uma mensagem..."}
                  </p>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copiar
                  </Button>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Será enviada como notificação no sistema
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedTemplate || isSubmitting}
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? "Enviando..." : "Enviar Notificação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationTemplates;
