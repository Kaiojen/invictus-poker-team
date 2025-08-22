from marshmallow import Schema, fields, validate


class CreateUserSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3, max=50))
    email = fields.Email(required=True)
    password = fields.Str(required=True)
    full_name = fields.Str(required=True)
    role = fields.Str(required=True, validate=validate.OneOf(["admin", "manager", "player", "viewer"]))
    phone = fields.Str(load_default=None)
    document = fields.Str(load_default=None)
    birth_date = fields.Str(load_default=None)
    bank_name = fields.Str(load_default=None)
    bank_agency = fields.Str(load_default=None)
    bank_account = fields.Str(load_default=None)
    pix_key = fields.Str(load_default=None)
    reta_id = fields.Int(load_default=None)


class UpdateUserSchema(Schema):
    full_name = fields.Str(load_default=None)
    phone = fields.Str(load_default=None)
    document = fields.Str(load_default=None)
    birth_date = fields.Str(load_default=None)
    bank_name = fields.Str(load_default=None)
    bank_agency = fields.Str(load_default=None)
    bank_account = fields.Str(load_default=None)
    pix_key = fields.Str(load_default=None)
    reta_id = fields.Int(load_default=None)


