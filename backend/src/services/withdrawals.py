from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional
from datetime import datetime

from src.models.models import db, WithdrawalRequest, WithdrawalStatus, Account, BalanceHistory
from src.routes.sse import broadcast_to_user


@dataclass
class ApproveWithdrawalDTO:
	withdrawal_id: int
	manager_id: int
	manager_notes: str = ""


@dataclass
class RejectWithdrawalDTO:
	withdrawal_id: int
	manager_id: int
	manager_notes: str


@dataclass
class CompleteWithdrawalDTO:
	withdrawal_id: int
	completion_notes: str = ""


class WithdrawalService:
	@staticmethod
	def approve(dto: ApproveWithdrawalDTO) -> WithdrawalRequest:
		req = WithdrawalRequest.query.get(dto.withdrawal_id)
		if not req:
			raise ValueError("withdrawal not found")
		if req.status != WithdrawalStatus.PENDING:
			raise ValueError("request is not pending")

		req.status = WithdrawalStatus.APPROVED
		req.manager_notes = dto.manager_notes
		req.approved_by = dto.manager_id
		req.approved_at = datetime.utcnow()

		account = Account.query.filter_by(user_id=req.user_id, platform_id=req.platform_id).first()
		if account:
			if account.current_balance < req.amount:
				raise ValueError("insufficient balance")
			
			# 🚨 CORREÇÃO CRÍTICA: Implementar divisão 50%/50% nos saques
			withdrawal_amount = Decimal(str(req.amount))
			
			# 50% do saque vai para o jogador (sai da banca)
			player_portion = withdrawal_amount / 2
			
			# 50% do saque fica para o time (reduz investimento - será tratado na planilha)
			team_portion = withdrawal_amount / 2
			
			old_balance = account.current_balance
			
			# Apenas a parte do jogador sai da banca (50%)
			account.current_balance = account.current_balance - player_portion
			account.total_withdrawals += withdrawal_amount  # Registra saque total para histórico
			
			# 🚨 TEMPORÁRIO: Comentar até migration ser aplicada
			# account.team_withdrawal_credits += team_portion
			
			bh = BalanceHistory(
				account_id=account.id,
				old_balance=old_balance,
				new_balance=account.current_balance,
				change_reason='withdrawal_approved',
				notes=f'Saque aprovado: {dto.manager_notes} | Total: ${withdrawal_amount}, Player: ${player_portion}, Team: ${team_portion}',
				changed_by=dto.manager_id
			)
			db.session.add(bh)

		db.session.commit()

		try:
			broadcast_to_user(req.user_id, 'withdrawal_status', {
				'id': req.id,
				'status': 'approved',
				'message': 'Seu saque foi aprovado',
				'timestamp': datetime.utcnow().timestamp()
			})
		except Exception:
			pass

		return req

	@staticmethod
	def reject(dto: RejectWithdrawalDTO) -> WithdrawalRequest:
		req = WithdrawalRequest.query.get(dto.withdrawal_id)
		if not req:
			raise ValueError("withdrawal not found")
		if req.status != WithdrawalStatus.PENDING:
			raise ValueError("request is not pending")
		req.status = WithdrawalStatus.REJECTED
		req.manager_notes = dto.manager_notes
		req.approved_by = dto.manager_id
		req.approved_at = datetime.utcnow()
		db.session.commit()
		return req

	@staticmethod
	def complete(dto: CompleteWithdrawalDTO) -> WithdrawalRequest:
		req = WithdrawalRequest.query.get(dto.withdrawal_id)
		if not req:
			raise ValueError("withdrawal not found")
		if req.status != WithdrawalStatus.APPROVED:
			raise ValueError("request must be approved first")
		req.status = WithdrawalStatus.COMPLETED
		req.completed_at = datetime.utcnow()
		if dto.completion_notes:
			req.manager_notes = (req.manager_notes or "") + f" | {dto.completion_notes}"
		db.session.commit()
		return req


