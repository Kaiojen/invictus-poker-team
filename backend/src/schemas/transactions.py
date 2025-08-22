from marshmallow import Schema, fields, validate


class CreateTransactionSchema(Schema):
	user_id = fields.Int(required=True)
	platform_id = fields.Int(required=True)
	transaction_type = fields.Str(required=True, validate=validate.OneOf([
		"RELOAD", "WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT", "ADJUSTMENT"
	]))
	amount = fields.Decimal(required=True, as_string=True)
	description = fields.Str(load_default="")




