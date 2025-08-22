from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from src.models.models import db, Transaction, TransactionType


@dataclass
class CreateTransactionDTO:
	user_id: int
	platform_id: int
	transaction_type: str
	amount: Decimal
	description: Optional[str] = None
	created_by: Optional[int] = None


class TransactionService:
	"""Regras de negócio para transações."""

	@staticmethod
	def create(dto: CreateTransactionDTO) -> Transaction:
		if dto.amount is None:
			raise ValueError("amount is required")
		if Decimal(dto.amount) <= 0:
			raise ValueError("amount must be positive")
		try:
			type_enum = TransactionType(dto.transaction_type)
		except Exception:
			raise ValueError("invalid transaction_type")

		transaction = Transaction(
			user_id=dto.user_id,
			platform_id=dto.platform_id,
			transaction_type=type_enum,
			amount=Decimal(dto.amount),
			description=dto.description or "",
			created_by=dto.created_by,
		)
		db.session.add(transaction)
		db.session.commit()
		return transaction




