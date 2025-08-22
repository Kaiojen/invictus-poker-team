from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from datetime import datetime

from src.models.models import db, User, UserRole


@dataclass
class CreateUserDTO:
	username: str
	email: str
	password: str
	full_name: str
	role: str
	phone: Optional[str] = None
	document: Optional[str] = None
	birth_date: Optional[str] = None
	bank_name: Optional[str] = None
	bank_agency: Optional[str] = None
	bank_account: Optional[str] = None
	pix_key: Optional[str] = None
	reta_id: Optional[int] = None


@dataclass
class UpdateUserDTO:
	user_id: int
	full_name: Optional[str] = None
	phone: Optional[str] = None
	document: Optional[str] = None
	birth_date: Optional[str] = None
	bank_name: Optional[str] = None
	bank_agency: Optional[str] = None
	bank_account: Optional[str] = None
	pix_key: Optional[str] = None
	reta_id: Optional[int] = None


class UserService:
	@staticmethod
	def create(dto: CreateUserDTO) -> User:
		if not dto.username or not dto.email or not dto.password:
			raise ValueError("missing required fields")
		user = User(
			username=dto.username,
			email=dto.email,
			full_name=dto.full_name,
			role=UserRole(dto.role),
			phone=dto.phone,
			document=dto.document,
			birth_date=datetime.fromisoformat(dto.birth_date) if dto.birth_date else None,
			bank_name=dto.bank_name,
			bank_agency=dto.bank_agency,
			reta_id=dto.reta_id
		)
		
		# Criptografar dados bancários sensíveis
		if dto.pix_key:
			user.set_pix_key(dto.pix_key)
		if dto.bank_account:
			user.set_bank_account(dto.bank_account)
		user.set_password(dto.password)
		db.session.add(user)
		db.session.commit()
		return user

	@staticmethod
	def update(dto: UpdateUserDTO) -> User:
		user = User.query.get(dto.user_id)
		if not user:
			raise ValueError("user not found")
		
		if dto.full_name is not None:
			user.full_name = dto.full_name
		if dto.phone is not None:
			user.phone = dto.phone
		if dto.document is not None:
			user.document = dto.document
		if dto.birth_date is not None:
			user.birth_date = datetime.fromisoformat(dto.birth_date)
		if dto.bank_name is not None:
			user.bank_name = dto.bank_name
		if dto.bank_agency is not None:
			user.bank_agency = dto.bank_agency
		if dto.bank_account is not None:
			user.set_bank_account(dto.bank_account)
		if dto.pix_key is not None:
			user.set_pix_key(dto.pix_key)
		if dto.reta_id is not None:
			user.reta_id = dto.reta_id
		
		db.session.commit()
		return user


