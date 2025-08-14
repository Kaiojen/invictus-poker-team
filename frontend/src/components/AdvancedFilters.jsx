import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Filter,
  X,
  Search,
  Calendar,
  DollarSign,
  Users,
  Settings,
  RefreshCw,
  Download,
  SlidersHorizontal,
} from "lucide-react";

const AdvancedFilters = ({
  data = [],
  onFilterChange,
  filterConfig = {},
  className = "",
  showExport = false,
  onExport,
  isMobile = false,
}) => {
  const [filters, setFilters] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [activeFilters, setActiveFilters] = useState([]);
  const [filteredData, setFilteredData] = useState(data);

  useEffect(() => {
    applyFilters();
  }, [data, filters, searchTerm, sortBy, sortOrder]);

  const applyFilters = () => {
    let result = [...data];

    // Aplicar filtro de busca
    if (searchTerm) {
      const searchFields = filterConfig.searchFields || ['name', 'title', 'username'];
      result = result.filter(item =>
        searchFields.some(field =>
          item[field]?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Aplicar filtros específicos
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        const filterDef = filterConfig.filters?.find(f => f.key === key);
        
        if (filterDef) {
          switch (filterDef.type) {
            case 'select':
              result = result.filter(item => item[key] === value);
              break;
            case 'multiselect':
              if (Array.isArray(value) && value.length > 0) {
                result = result.filter(item => value.includes(item[key]));
              }
              break;
            case 'range':
              if (value.min !== undefined) {
                result = result.filter(item => Number(item[key]) >= Number(value.min));
              }
              if (value.max !== undefined) {
                result = result.filter(item => Number(item[key]) <= Number(value.max));
              }
              break;
            case 'date_range':
              if (value.start) {
                result = result.filter(item => new Date(item[key]) >= new Date(value.start));
              }
              if (value.end) {
                result = result.filter(item => new Date(item[key]) <= new Date(value.end));
              }
              break;
            case 'boolean':
              result = result.filter(item => Boolean(item[key]) === value);
              break;
            default:
              result = result.filter(item => 
                item[key]?.toString().toLowerCase().includes(value.toLowerCase())
              );
          }
        }
      }
    });

    // Aplicar ordenação
    if (sortBy) {
      result.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];
        
        // Tratar números
        if (!isNaN(aVal) && !isNaN(bVal)) {
          aVal = Number(aVal);
          bVal = Number(bVal);
        }
        
        // Tratar datas
        if (sortBy.includes('date') || sortBy.includes('_at')) {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(result);
    
    // Atualizar lista de filtros ativos
    const active = [];
    if (searchTerm) {
      active.push({ key: 'search', label: `Busca: "${searchTerm}"`, value: searchTerm });
    }
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        const filterDef = filterConfig.filters?.find(f => f.key === key);
        if (filterDef) {
          let label = `${filterDef.label}: `;
          
          if (filterDef.type === 'range') {
            label += `${value.min || '0'} - ${value.max || '∞'}`;
          } else if (filterDef.type === 'date_range') {
            label += `${value.start || ''} - ${value.end || ''}`;
          } else if (Array.isArray(value)) {
            label += value.join(', ');
          } else {
            label += value;
          }
          
          active.push({ key, label, value });
        }
      }
    });
    
    setActiveFilters(active);
    onFilterChange?.(result);
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const removeFilter = (key) => {
    if (key === 'search') {
      setSearchTerm("");
    } else {
      setFilters(prev => {
        const newFilters = { ...prev };
        delete newFilters[key];
        return newFilters;
      });
    }
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearchTerm("");
    setSortBy("");
    setSortOrder("asc");
  };

  const renderFilterInput = (filterDef) => {
    const { key, type, label, options, placeholder } = filterDef;
    const value = filters[key];

    switch (type) {
      case 'select':
        return (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <Select value={value || 'all'} onValueChange={(val) => updateFilter(key, val)}>
              <SelectTrigger>
                <SelectValue placeholder={placeholder || `Selecione ${label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'multiselect':
        return (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${key}-${option.value}`}
                    checked={value?.includes(option.value) || false}
                    onCheckedChange={(checked) => {
                      const current = value || [];
                      if (checked) {
                        updateFilter(key, [...current, option.value]);
                      } else {
                        updateFilter(key, current.filter(v => v !== option.value));
                      }
                    }}
                  />
                  <Label htmlFor={`${key}-${option.value}`} className="text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'range':
        return (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <div className="flex space-x-2">
              <Input
                type="number"
                placeholder="Mín"
                value={value?.min || ''}
                onChange={(e) => updateFilter(key, { ...value, min: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Máx"
                value={value?.max || ''}
                onChange={(e) => updateFilter(key, { ...value, max: e.target.value })}
              />
            </div>
          </div>
        );

      case 'date_range':
        return (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <div className="flex space-x-2">
              <Input
                type="date"
                placeholder="Data inicial"
                value={value?.start || ''}
                onChange={(e) => updateFilter(key, { ...value, start: e.target.value })}
              />
              <Input
                type="date"
                placeholder="Data final"
                value={value?.end || ''}
                onChange={(e) => updateFilter(key, { ...value, end: e.target.value })}
              />
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={key}
                checked={value === true}
                onCheckedChange={(checked) => updateFilter(key, checked)}
              />
              <Label htmlFor={key}>{label}</Label>
            </div>
          </div>
        );

      default:
        return (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <Input
              placeholder={placeholder || `Digite ${label.toLowerCase()}`}
              value={value || ''}
              onChange={(e) => updateFilter(key, e.target.value)}
            />
          </div>
        );
    }
  };

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Busca geral */}
      <div className="space-y-2">
        <Label>Busca Geral</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Ordenação */}
      {filterConfig.sortFields && (
        <div className="space-y-2">
          <Label>Ordenar por</Label>
          <div className="flex space-x-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {filterConfig.sortFields.map((field) => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">↑ Crescente</SelectItem>
                <SelectItem value="desc">↓ Decrescente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Filtros específicos */}
      {filterConfig.filters?.map(renderFilterInput)}

      {/* Ações */}
      <div className="flex space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={clearAllFilters} className="flex-1">
          <RefreshCw className="w-4 h-4 mr-2" />
          Limpar Tudo
        </Button>
        {showExport && (
          <Button variant="outline" onClick={() => onExport?.(filteredData)}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className={className}>
        {/* Header com busca e filtros ativos */}
        <div className="space-y-3 mb-4">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="mobile-modal-content">
                <SheetHeader>
                  <SheetTitle>Filtros Avançados</SheetTitle>
                  <SheetDescription>
                    Configure os filtros para encontrar exatamente o que precisa
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Filtros ativos */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <Badge
                  key={filter.key}
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <span className="text-xs">{filter.label}</span>
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => removeFilter(filter.key)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Resultados */}
        <div className="text-sm text-muted-foreground mb-4">
          {filteredData.length} resultado{filteredData.length !== 1 ? 's' : ''} encontrado{filteredData.length !== 1 ? 's' : ''}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="w-5 h-5" />
                <span>Filtros Avançados</span>
              </CardTitle>
              <CardDescription>
                {filteredData.length} de {data.length} item{data.length !== 1 ? 's' : ''} exibido{data.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Filtros
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-96 overflow-y-auto">
                <FilterContent />
              </PopoverContent>
            </Popover>
          </div>

          {/* Busca principal */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros ativos */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-3 border-t">
              {activeFilters.map((filter) => (
                <Badge
                  key={filter.key}
                  variant="secondary"
                  className="flex items-center space-x-1"
                >
                  <span>{filter.label}</span>
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => removeFilter(filter.key)}
                  />
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 px-2 text-xs"
              >
                Limpar todos
              </Button>
            </div>
          )}
        </CardHeader>
      </Card>
    </div>
  );
};

export default AdvancedFilters;

