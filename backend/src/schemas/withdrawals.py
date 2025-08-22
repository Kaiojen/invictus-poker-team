from marshmallow import Schema, fields


class ApproveWithdrawalSchema(Schema):
    manager_notes = fields.Str(load_default="")


class RejectWithdrawalSchema(Schema):
    manager_notes = fields.Str(required=True)


class CompleteWithdrawalSchema(Schema):
    completion_notes = fields.Str(load_default="")




