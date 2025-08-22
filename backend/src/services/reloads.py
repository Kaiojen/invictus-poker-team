from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from datetime import datetime

from src.models.models import db, ReloadRequest, ReloadStatus, Account, Transaction, TransactionType
from src.routes.sse import notify_reload_approved


@dataclass
class ApproveReloadDTO:
	reload_id: int
	manager_id: int
	manager_notes: str = ""


@dataclass
class RejectReloadDTO:
	reload_id: int
	manager_id: int
	manager_notes: str


class ReloadService:
	"""Regras de negócio de reload."""

	@staticmethod
	def approve(dto: ApproveReloadDTO) -> ReloadRequest:
		req = ReloadRequest.query.get(dto.reload_id)
		if not req:
			raise ValueError("reload not found")
		if req.status != ReloadStatus.PENDING:
			raise ValueError("request is not pending")

		req.status = ReloadStatus.APPROVED
		req.manager_notes = dto.manager_notes
		req.approved_by = dto.manager_id
		req.approved_at = datetime.utcnow()

		account = Account.query.filter_by(user_id=req.user_id, platform_id=req.platform_id).first()
		if account:
			account.current_balance += Decimal(str(req.amount))
			account.total_reloads += Decimal(str(req.amount))

		transaction = Transaction(
			user_id=req.user_id,
			platform_id=req.platform_id,
			transaction_type=TransactionType.RELOAD,
			amount=req.amount,
			description=f"Reload aprovado - Solicitação #{req.id}",
			reload_request_id=req.id,
			created_by=dto.manager_id
		)
		db.session.add(transaction)
		db.session.commit()

		try:
			notify_reload_approved(req)
		except Exception:
			pass

		return req

	@staticmethod
	def reject(dto: RejectReloadDTO) -> ReloadRequest:
		req = ReloadRequest.query.get(dto.reload_id)
		if not req:
			raise ValueError("reload not found")
		if req.status != ReloadStatus.PENDING:
			raise ValueError("request is not pending")
		req.status = ReloadStatus.REJECTED
		req.manager_notes = dto.manager_notes
		req.approved_by = dto.manager_id
		req.approved_at = datetime.utcnow()
		db.session.commit()
		return req


