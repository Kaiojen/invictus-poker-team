from marshmallow import Schema, fields


class ApproveReloadSchema(Schema):
    manager_notes = fields.Str(load_default="")


class RejectReloadSchema(Schema):
    manager_notes = fields.Str(required=True)




