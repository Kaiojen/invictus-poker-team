from marshmallow import Schema, fields, pre_load


class UpdateBalanceSchema(Schema):
    new_balance = fields.Decimal(required=True, as_string=True)
    notes = fields.Str(load_default="")
    change_reason = fields.Str(load_default="manual_update")
    
    @pre_load
    def handle_legacy_fields(self, data, **kwargs):
        """✅ CORREÇÃO ROBUSTA: Converter campos antigos automaticamente"""
        # Se veio 'current_balance' em vez de 'new_balance', converter
        if 'current_balance' in data and 'new_balance' not in data:
            data['new_balance'] = data['current_balance']
        
        # Remover campos não aceitos para evitar erros
        legacy_fields = ['current_balance', 'verified']
        for field in legacy_fields:
            data.pop(field, None)
        
        return data




