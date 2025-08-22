from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from datetime import datetime

from src.models.models import db, Account, BalanceHistory


@dataclass
class UpdateBalanceDTO:
	account_id: int
	new_balance: float
	changed_by: int
	change_reason: str = 'manual_update'
	notes: str = ''


class AccountService:
	@staticmethod
	def update_balance(dto: UpdateBalanceDTO) -> Account:
		account = Account.query.get(dto.account_id)
		if not account:
			raise ValueError("account not found")
		old = float(account.current_balance)
		new = float(dto.new_balance)
		account.current_balance = new
		
		# ✅ CRIAR HISTÓRICO DE SALDO (para cálculo do previous_balance)
		bh = BalanceHistory(
			account_id=account.id,
			old_balance=old,
			new_balance=new,
			change_reason=dto.change_reason,
			notes=dto.notes,
			changed_by=dto.changed_by
		)
		db.session.add(bh)
		
		# ✅ IMPORTANTE: Marcar que saldo foi verificado e atualizado
		account.balance_verified = True
		
		# ✅ Atualizar timestamp da conta
		account.last_balance_update = datetime.utcnow()
		
		db.session.commit()
		
		# ✅ CRUCIAL: Notificar SSE para atualização em tempo real dos gráficos
		try:
			from src.routes.sse import notify_balance_updated, notify_dashboard_refresh
			# ✅ CORRIGIDO: user_id obtido através de account.user_id
			notify_balance_updated(account.user_id, account.id, old, new)
			notify_dashboard_refresh()  # Atualizar gráficos
		except Exception as e:
			print(f"Aviso: SSE não disponível - {e}")
			
		return account




