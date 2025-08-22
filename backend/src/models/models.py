from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Numeric
import enum

db = SQLAlchemy()

class UserRole(enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    PLAYER = "player"
    VIEWER = "viewer"

class ReloadStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class TransactionType(enum.Enum):
    RELOAD = "reload"
    WITHDRAWAL = "withdrawal"
    PROFIT = "profit"
    LOSS = "loss"
    ADJUSTMENT = "adjustment"  # Para ajustes manuais

class WithdrawalStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"

class DocumentStatus(enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

class AccountStatus(enum.Enum):
    INACTIVE = "inactive"  # Sem conta
    ACTIVE = "active"      # Conta ativa
    ZEROED = "zeroed"      # Conta zerada
    PROFIT = "profit"      # Em lucro
    LOSS = "loss"          # Em prejuízo

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(200), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.PLAYER)
    is_active = db.Column(db.Boolean, default=True)
    
    # Novos campos para perfil completo
    phone = db.Column(db.String(20))
    document = db.Column(db.String(20))  # CPF/RG
    birth_date = db.Column(db.Date)
    pix_key = db.Column(db.String(100))
    bank_name = db.Column(db.String(100))
    bank_agency = db.Column(db.String(10))
    bank_account = db.Column(db.String(20))
    makeup = db.Column(Numeric(10, 2), default=0.00)  # Makeup atual
    manager_notes = db.Column(db.Text)  # Observações do gestor
    # Segurança
    two_factor_enabled = db.Column(db.Boolean, default=False)
    totp_secret = db.Column(db.String(64))
    recovery_codes = db.Column(db.Text)  # JSON com hashes e status de uso
    password_reset_token = db.Column(db.String(128))
    password_reset_expires_at = db.Column(db.DateTime)
    
    # Reta do jogador
    reta_id = db.Column(db.Integer, db.ForeignKey('retas.id'))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    accounts = db.relationship('Account', backref='user', lazy=True, cascade='all, delete-orphan')
    reload_requests = db.relationship('ReloadRequest', foreign_keys='ReloadRequest.user_id', backref='user', lazy=True, cascade='all, delete-orphan')
    transactions = db.relationship('Transaction', foreign_keys='Transaction.user_id', backref='user', lazy=True, cascade='all, delete-orphan')
    withdrawal_requests = db.relationship('WithdrawalRequest', foreign_keys='WithdrawalRequest.user_id', backref='user', lazy=True, cascade='all, delete-orphan')
    reta = db.relationship('Reta', backref='users')
    uploaded_documents = db.relationship('Document', foreign_keys='Document.user_id', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def set_pix_key(self, pix_key):
        """Definir PIX criptografado"""
        if pix_key:
            from src.utils.encryption import encrypt_bank_data
            self.pix_key = encrypt_bank_data(pix_key)
        else:
            self.pix_key = None
    
    def get_pix_key(self):
        """Obter PIX descriptografado"""
        if self.pix_key:
            from src.utils.encryption import decrypt_bank_data
            return decrypt_bank_data(self.pix_key)
        return None
    
    def set_bank_account(self, account):
        """Definir conta bancária criptografada"""
        if account:
            from src.utils.encryption import encrypt_bank_data
            self.bank_account = encrypt_bank_data(account)
        else:
            self.bank_account = None
    
    def get_bank_account(self):
        """Obter conta bancária descriptografada"""
        if self.bank_account:
            from src.utils.encryption import decrypt_bank_data
            return decrypt_bank_data(self.bank_account)
        return None
    
    def to_dict(self, include_sensitive=False):
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role.value,
            'is_active': self.is_active,
            'phone': self.phone,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'makeup': float(self.makeup) if self.makeup else 0.00,
            'manager_notes': self.manager_notes,
            'reta_id': self.reta_id,
            'reta_name': self.reta.name if self.reta else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        # Incluir dados sensíveis apenas se autorizado
        if include_sensitive:
            data.update({
                'document': self.document,
                'pix_key': self.get_pix_key(),  # Descriptografar para exibição
                'bank_name': self.bank_name,
                'bank_agency': self.bank_agency,
                'bank_account': self.get_bank_account(),  # Descriptografar para exibição
                'two_factor_enabled': self.two_factor_enabled
            })
        else:
            # Dados mascarados para logs/API geral
            from src.utils.encryption import mask_sensitive_data
            data.update({
                'document': mask_sensitive_data(self.document or "", visible_chars=2),
                'pix_key': mask_sensitive_data(self.get_pix_key() or "", visible_chars=4),
                'bank_name': self.bank_name,  # Nome do banco não é sensível
                'bank_agency': mask_sensitive_data(self.bank_agency or "", visible_chars=2),
                'bank_account': mask_sensitive_data(self.get_bank_account() or "", visible_chars=3),
                'two_factor_enabled': self.two_factor_enabled
            })
        
        return data

class Platform(db.Model):
    __tablename__ = 'platforms'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relacionamentos
    accounts = db.relationship('Account', backref='platform', lazy=True)
    reload_requests = db.relationship('ReloadRequest', backref='platform', lazy=True)
    transactions = db.relationship('Transaction', backref='platform', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Account(db.Model):
    __tablename__ = 'accounts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    platform_id = db.Column(db.Integer, db.ForeignKey('platforms.id'), nullable=False, index=True)
    account_name = db.Column(db.String(100), nullable=False)
    
    # Campos da planilha
    initial_balance = db.Column(Numeric(10, 2), default=0.00)  # Banca inicial
    current_balance = db.Column(Numeric(10, 2), default=0.00)  # Banca atual
    total_reloads = db.Column(Numeric(10, 2), default=0.00)
    total_withdrawals = db.Column(Numeric(10, 2), default=0.00)
    # ✅ Campos para investimento e reload manual do time
    manual_team_investment = db.Column(Numeric(10, 2), default=None)
    investment_notes = db.Column(db.Text)
    manual_reload_amount = db.Column(Numeric(10, 2), default=None)
    reload_notes = db.Column(db.Text)
    
    # Status da conta
    status = db.Column(db.Enum(AccountStatus), default=AccountStatus.INACTIVE, index=True)
    has_account = db.Column(db.Boolean, default=False)  # Se tem conta na plataforma
    
    # Controle de atualizações
    last_balance_update = db.Column(db.DateTime)
    balance_verified = db.Column(db.Boolean, default=False)  # Se o saldo foi verificado
    
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraint para evitar contas duplicadas
    __table_args__ = (db.UniqueConstraint('user_id', 'platform_id', name='unique_user_platform'),)
    
    @property
    def pnl(self):
        """
        Calcula o P&L (Profit & Loss) da conta.
        
        Lógica correta conforme ABA Administrador_.md:
        - Luxon: Sempre 0 (não entra no P&L, é apenas carteira de transferência)
        - Sites de poker: current_balance - initial_balance
        
        Exemplo: Time deposita $100 na Luxon → Player distribui: GG $50, PS $30
        Após jogo: GG $100, PS $25
        P&L = (100-50) + (25-30) = +$45 (Luxon NÃO entra)
        """
        if self.platform and self.platform.name.lower() == 'luxon':
            return 0.00  # Luxon NÃO entra no P&L
        
        if not self.has_account:
            return 0.00
            
        # Para sites de poker: P&L = current_balance - initial_balance
        current = float(self.current_balance) if self.current_balance else 0.00
        initial = float(self.initial_balance) if self.initial_balance else 0.00
        return current - initial
    
    @property
    def needs_update(self):
        """Verifica se a conta precisa de atualização (mais de 1 dia)."""
        if not self.last_balance_update:
            return True
        days_since_update = (datetime.utcnow() - self.last_balance_update).days
        return days_since_update > 1
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'platform_id': self.platform_id,
            'platform_name': self.platform.display_name if self.platform else None,
            'account_name': self.account_name,
            'initial_balance': float(self.initial_balance),
            'current_balance': float(self.current_balance),
            'pnl': self.pnl,
            'total_reloads': float(self.total_reloads),
            'total_withdrawals': float(self.total_withdrawals),
            # ✅ Campos manual investment e reload
            'manual_team_investment': float(self.manual_team_investment) if self.manual_team_investment else None,
            'investment_notes': self.investment_notes,
            'manual_reload_amount': float(self.manual_reload_amount) if self.manual_reload_amount else None,
            'reload_notes': self.reload_notes,
            'status': self.status.value,
            'has_account': self.has_account,
            'last_balance_update': self.last_balance_update.isoformat() if self.last_balance_update else None,
            'balance_verified': self.balance_verified,
            'needs_update': self.needs_update,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class ReloadRequest(db.Model):
    __tablename__ = 'reload_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    platform_id = db.Column(db.Integer, db.ForeignKey('platforms.id'), nullable=False, index=True)
    amount = db.Column(Numeric(10, 2), nullable=False)
    status = db.Column(db.Enum(ReloadStatus), default=ReloadStatus.PENDING, index=True)
    # 🚨 TEMPORÁRIO: Comentar até migration ser aplicada
    # paid_back = db.Column(db.Boolean, default=False, index=True)
    # paid_back_at = db.Column(db.DateTime)
    player_notes = db.Column(db.Text)
    manager_notes = db.Column(db.Text)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamento para o usuário que aprovou
    approver = db.relationship('User', foreign_keys=[approved_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'platform_id': self.platform_id,
            'platform_name': self.platform.display_name if self.platform else None,
            'amount': float(self.amount),
            'status': self.status.value,
            # 🚨 TEMPORÁRIO: Comentar até migration
            # 'paid_back': self.paid_back,
            # 'paid_back_at': self.paid_back_at.isoformat() if self.paid_back_at else None,
            'player_notes': self.player_notes,
            'manager_notes': self.manager_notes,
            'approved_by': self.approved_by,
            'approver_name': self.approver.full_name if self.approver else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Transaction(db.Model):
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    platform_id = db.Column(db.Integer, db.ForeignKey('platforms.id'), nullable=False, index=True)
    transaction_type = db.Column(db.Enum(TransactionType), nullable=False, index=True)
    amount = db.Column(Numeric(10, 2), nullable=False)
    description = db.Column(db.String(255))
    reload_request_id = db.Column(db.Integer, db.ForeignKey('reload_requests.id'))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Relacionamentos
    reload_request = db.relationship('ReloadRequest', backref='transactions')
    creator = db.relationship('User', foreign_keys=[created_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'platform_id': self.platform_id,
            'platform_name': self.platform.display_name if self.platform else None,
            'transaction_type': self.transaction_type.value,
            'amount': float(self.amount),
            'description': self.description,
            'reload_request_id': self.reload_request_id,
            'created_by': self.created_by,
            'creator_name': self.creator.full_name if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class PlayerData(db.Model):
    __tablename__ = 'player_data'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    field_name = db.Column(db.String(100), nullable=False)
    field_value = db.Column(db.Text)
    is_required = db.Column(db.Boolean, default=False)
    is_complete = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraint para evitar campos duplicados por usuário
    __table_args__ = (db.UniqueConstraint('user_id', 'field_name', name='unique_user_field'),)
    
    # Relacionamento
    user = db.relationship('User', backref='player_data')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'field_name': self.field_name,
            'field_value': self.field_value,
            'is_required': self.is_required,
            'is_complete': self.is_complete,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Reta(db.Model):
    """Model para controle de retas/stakes dos jogadores"""
    __tablename__ = 'retas'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)  # Ex: "Reta 0", "Reta 1"
    min_stake = db.Column(Numeric(10, 2), nullable=False)  # Stake mínimo
    max_stake = db.Column(Numeric(10, 2), nullable=False)  # Stake máximo
    description = db.Column(db.String(200))  # Descrição da reta
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'min_stake': float(self.min_stake),
            'max_stake': float(self.max_stake),
            'description': self.description,
            'is_active': self.is_active,
            'player_count': len(self.users),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class RetaPermission(db.Model):
    """Permissões específicas por jogador e plataforma"""
    __tablename__ = 'reta_permissions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    platform_id = db.Column(db.Integer, db.ForeignKey('platforms.id'), nullable=False)
    is_allowed = db.Column(db.Boolean, default=True)  # Se pode jogar na plataforma
    special_limit = db.Column(Numeric(10, 2))  # Limite especial temporário
    special_limit_expires = db.Column(db.DateTime)  # Data de expiração do limite
    notes = db.Column(db.Text)  # Observações sobre a permissão
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    user = db.relationship('User', foreign_keys=[user_id])
    platform = db.relationship('Platform')
    creator = db.relationship('User', foreign_keys=[created_by])
    
    # Constraint único por user/platform
    __table_args__ = (
        db.UniqueConstraint('user_id', 'platform_id', name='unique_user_platform_permission'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'platform_id': self.platform_id,
            'platform_name': self.platform.display_name if self.platform else None,
            'is_allowed': self.is_allowed,
            'special_limit': float(self.special_limit) if self.special_limit else None,
            'special_limit_expires': self.special_limit_expires.isoformat() if self.special_limit_expires else None,
            'notes': self.notes,
            'creator_name': self.creator.full_name if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class WithdrawalRequest(db.Model):
    """Solicitações de saque"""
    __tablename__ = 'withdrawal_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    platform_id = db.Column(db.Integer, db.ForeignKey('platforms.id'), nullable=False, index=True)
    amount = db.Column(Numeric(10, 2), nullable=False)
    status = db.Column(db.Enum(WithdrawalStatus), default=WithdrawalStatus.PENDING, index=True)
    player_notes = db.Column(db.Text)
    manager_notes = db.Column(db.Text)
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    approved_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relacionamentos
    platform = db.relationship('Platform')
    approver = db.relationship('User', foreign_keys=[approved_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'platform_id': self.platform_id,
            'platform_name': self.platform.display_name if self.platform else None,
            'amount': float(self.amount),
            'status': self.status.value,
            'player_notes': self.player_notes,
            'manager_notes': self.manager_notes,
            'approved_by': self.approved_by,
            'approver_name': self.approver.full_name if self.approver else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class Document(db.Model):
    """Uploads de comprovantes e documentos"""
    __tablename__ = 'documents'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)  # Tamanho em bytes
    mime_type = db.Column(db.String(100))
    
    # Categoria do documento
    document_type = db.Column(db.String(50))  # 'balance_proof', 'bank_statement', 'id_document', etc.
    
    # Associações opcionais
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'))  # Se for comprovante de saldo
    reload_request_id = db.Column(db.Integer, db.ForeignKey('reload_requests.id'))  # Se for comprovante de reload
    withdrawal_request_id = db.Column(db.Integer, db.ForeignKey('withdrawal_requests.id'))  # Se for comprovante de saque
    
    # Status de verificação
    status = db.Column(db.Enum(DocumentStatus), default=DocumentStatus.PENDING, index=True)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    verified_at = db.Column(db.DateTime)
    verification_notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Relacionamentos
    account = db.relationship('Account')
    reload_request = db.relationship('ReloadRequest')
    withdrawal_request = db.relationship('WithdrawalRequest')
    verifier = db.relationship('User', foreign_keys=[verified_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'document_type': self.document_type,
            'account_id': self.account_id,
            'reload_request_id': self.reload_request_id,
            'withdrawal_request_id': self.withdrawal_request_id,
            'status': self.status.value,
            'verified_by': self.verified_by,
            'verifier_name': self.verifier.full_name if self.verifier else None,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'verification_notes': self.verification_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class BalanceHistory(db.Model):
    """Histórico de alterações de saldo"""
    __tablename__ = 'balance_history'
    
    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id'), nullable=False, index=True)
    old_balance = db.Column(Numeric(10, 2), nullable=False)
    new_balance = db.Column(Numeric(10, 2), nullable=False)
    change_reason = db.Column(db.String(100))  # 'manual_update', 'reload', 'withdrawal', etc.
    notes = db.Column(db.Text)
    changed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    document_id = db.Column(db.Integer, db.ForeignKey('documents.id'))  # Comprovante associado
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Relacionamentos
    account = db.relationship('Account')
    changer = db.relationship('User', foreign_keys=[changed_by])
    document = db.relationship('Document')
    
    @property
    def change_amount(self):
        return float(self.new_balance - self.old_balance)
    
    def to_dict(self):
        return {
            'id': self.id,
            'account_id': self.account_id,
            'account_platform': self.account.platform.display_name if self.account and self.account.platform else None,
            'old_balance': float(self.old_balance),
            'new_balance': float(self.new_balance),
            'change_amount': self.change_amount,
            'change_reason': self.change_reason,
            'notes': self.notes,
            'changed_by': self.changed_by,
            'changer_name': self.changer.full_name if self.changer else None,
            'document_id': self.document_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class AuditLog(db.Model):
    """Log de auditoria para ações críticas"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    action = db.Column(db.String(100), nullable=False, index=True)  # 'user_created', 'balance_updated', etc.
    entity_type = db.Column(db.String(50), nullable=False, index=True)  # 'User', 'Account', 'ReloadRequest', etc.
    entity_id = db.Column(db.Integer, nullable=False)  # ID da entidade afetada
    old_values = db.Column(db.Text)  # JSON com valores antigos
    new_values = db.Column(db.Text)  # JSON com valores novos
    ip_address = db.Column(db.String(45))  # IP do usuário
    user_agent = db.Column(db.String(500))  # User agent do browser
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # Relacionamento
    user = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'old_values': self.old_values,
            'new_values': self.new_values,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class RequiredField(db.Model):
    """Campos obrigatórios da planilha configuráveis pelo admin"""
    __tablename__ = 'required_fields'
    
    id = db.Column(db.Integer, primary_key=True)
    field_name = db.Column(db.String(100), unique=True, nullable=False)
    field_label = db.Column(db.String(200), nullable=False)
    field_type = db.Column(db.String(50), default='text')  # text, number, date, select
    field_category = db.Column(db.String(50))  # personal, banking, gaming, other
    placeholder = db.Column(db.String(200))
    validation_regex = db.Column(db.String(500))
    is_required = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    order = db.Column(db.Integer, default=0)
    options = db.Column(db.Text)  # JSON para campos tipo select
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Relacionamentos
    creator = db.relationship('User', backref='created_fields')
    
    def to_dict(self):
        return {
            'id': self.id,
            'field_name': self.field_name,
            'field_label': self.field_label,
            'field_type': self.field_type,
            'field_category': self.field_category,
            'placeholder': self.placeholder,
            'validation_regex': self.validation_regex,
            'is_required': self.is_required,
            'is_active': self.is_active,
            'order': self.order,
            'options': self.options,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class PlayerFieldValue(db.Model):
    """Valores dos campos preenchidos pelos jogadores"""
    __tablename__ = 'player_field_values'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    field_id = db.Column(db.Integer, db.ForeignKey('required_fields.id'), nullable=False)
    field_value = db.Column(db.Text)
    is_verified = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # Constraint para evitar valores duplicados
    __table_args__ = (db.UniqueConstraint('user_id', 'field_id', name='unique_user_field_value'),)
    
    # Relacionamentos
    user = db.relationship('User', foreign_keys=[user_id], backref='field_values')
    field = db.relationship('RequiredField', backref='values')
    updater = db.relationship('User', foreign_keys=[updated_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'field_id': self.field_id,
            'field_name': self.field.field_name if self.field else None,
            'field_label': self.field.field_label if self.field else None,
            'field_type': self.field.field_type if self.field else None,
            'field_value': self.field_value,
            'is_verified': self.is_verified,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'updated_by': self.updated_by,
            'updater_name': self.updater.full_name if self.updater else None
        }

class TeamMonthlySnapshot(db.Model):
    """Snapshots mensais do saldo total do time para controle histórico"""
    __tablename__ = 'team_monthly_snapshots'
    
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.Integer, nullable=False)  # 1-12
    year = db.Column(db.Integer, nullable=False)   # 2024, 2025, etc
    
    # Dados financeiros do time no fechamento do mês
    total_balance = db.Column(Numeric(10, 2), default=0)  # Saldo total consolidado
    total_pnl = db.Column(Numeric(10, 2), default=0)      # P&L consolidado do mês
    total_investment = db.Column(Numeric(10, 2), default=0) # Total investido pelo time
    
    # Estatísticas do time
    active_players = db.Column(db.Integer, default=0)
    total_accounts = db.Column(db.Integer, default=0)
    profitable_players = db.Column(db.Integer, default=0)
    players_in_makeup = db.Column(db.Integer, default=0)
    
    # Controle operacional
    is_closed = db.Column(db.Boolean, default=False)  # Mês fechado/finalizado
    closed_by = db.Column(db.Integer, db.ForeignKey('users.id'))  # Quem fechou
    notes = db.Column(db.Text)  # Observações do fechamento
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    closed_by_user = db.relationship('User', backref=db.backref('monthly_closures', lazy=True))
    
    # Unique constraint para garantir um snapshot por mês/ano
    __table_args__ = (db.UniqueConstraint('month', 'year', name='unique_month_year'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'month': self.month,
            'year': self.year,
            'period': f"{self.year}-{self.month:02d}",
            'total_balance': float(self.total_balance),
            'total_pnl': float(self.total_pnl),
            'total_investment': float(self.total_investment),
            'active_players': self.active_players,
            'total_accounts': self.total_accounts,
            'profitable_players': self.profitable_players,
            'players_in_makeup': self.players_in_makeup,
            'is_closed': self.is_closed,
            'closed_by': self.closed_by,
            'closed_by_name': self.closed_by_user.full_name if self.closed_by_user else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

