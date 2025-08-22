import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  RefreshCw,
  AlertCircle,
  User,
  CreditCard,
  Shield,
} from "lucide-react";
import { debounce } from "lodash";

const PlanilhaCompleta = ({ userId, userRole }) => {
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState({});
  const [loading, setLoading] = useState(true);
  const [completeness, setCompleteness] = useState(null);

  useEffect(() => {
    fetchFields();
    fetchCompleteness();
  }, [userId]);

  const fetchFields = async () => {
    try {
      const response = await fetch(`/api/planilhas/user/${userId}/fields`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setFields(data.fields);

        // Preencher valores existentes
        const existingValues = {};
        data.fields.forEach((field) => {
          if (field.value !== null) {
            existingValues[field.id] = field.value;
          }
        });
        setValues(existingValues);
      }
    } catch (err) {
      console.error("Erro ao carregar campos:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompleteness = async () => {
    try {
      const response = await fetch(
        `/api/planilhas/user/${userId}/completeness`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCompleteness(data);
      }
    } catch (err) {
      console.error("Erro ao carregar completude:", err);
    }
  };

  // Salvamento automático com debounce
  const saveField = useCallback(
    debounce(async (fieldId, value) => {
      setSaving((prev) => ({ ...prev, [fieldId]: true }));

      try {
        const response = await fetch(`/api/planilhas/user/${userId}/field`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_id: fieldId,
            value: value,
          }),
          credentials: "include",
        });

        if (response.ok) {
          // Mostrar ícone de sucesso por 2 segundos
          setTimeout(() => {
            setSaving((prev) => ({ ...prev, [fieldId]: false }));
          }, 2000);

          // Atualizar completude após salvar
          fetchCompleteness();
        } else {
          console.error("Erro ao salvar campo");
          setSaving((prev) => ({ ...prev, [fieldId]: false }));
        }
      } catch (error) {
        console.error("Erro ao salvar:", error);
        setSaving((prev) => ({ ...prev, [fieldId]: false }));
      }
    }, 1000),
    [userId]
  );

  const handleFieldChange = (fieldId, value) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    saveField(fieldId, value);
    // Atualizar URL com ancora do campo para deep-link
    try {
      const anchor = `#field-${fieldId}`;
      if (!window.location.hash || window.location.hash !== anchor) {
        history.replaceState(null, "", anchor);
      }
    } catch {}
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case "personal":
        return <User className="w-4 h-4" />;
      case "banking":
        return <CreditCard className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getCategoryTitle = (category) => {
    switch (category) {
      case "personal":
        return "Dados Pessoais";
      case "banking":
        return "Dados Bancários";
      default:
        return "Outros Dados";
    }
  };

  // Agrupar campos por categoria
  const groupedFields = fields.reduce((acc, field) => {
    const category = field.field_category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(field);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2">Carregando campos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pendências relacionadas à planilha - não dados pessoais */}
      {/* Removido: dados pessoais não são pendências da planilha */}

      {/* Campos da planilha - apenas campos de poker/gaming, não dados pessoais */}
      {Object.entries(groupedFields)
        .filter(([category]) => !["personal", "banking"].includes(category))
        .map(([category, categoryFields]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {getCategoryIcon(category)}
                <span>{getCategoryTitle(category)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label
                      htmlFor={`field-${field.id}`}
                      id={`field-${field.field_name}`}
                    >
                      {field.field_label}
                      {field.is_required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`field-${field.id}`}
                        type={field.field_type}
                        value={values[field.id] || ""}
                        onChange={(e) =>
                          handleFieldChange(field.id, e.target.value)
                        }
                        placeholder={field.placeholder}
                        className={
                          !values[field.id] && field.is_required
                            ? "border-red-500"
                            : ""
                        }
                        disabled={
                          userRole === "manager" || userRole === "viewer"
                        }
                      />
                      {saving[field.id] && (
                        <div className="absolute right-2 top-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        </div>
                      )}
                      {values[field.id] && !saving[field.id] && (
                        <div className="absolute right-2 top-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </div>
                    {field.is_verified && userRole !== "player" && (
                      <div className="text-xs text-green-600">
                        ✓ Verificado pelo admin
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

      {/* Removido: "Gerenciar Campos" - substituído pelo gráfico de evolução mensal já implementado na planilha principal */}
    </div>
  );
};

export default PlanilhaCompleta;
