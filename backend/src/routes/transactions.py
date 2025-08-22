from flask import Blueprint, request, jsonify, session
from datetime import datetime, timedelta
from src.models.models import db, Transaction, User, Platform, Account, UserRole, TransactionType
from src.schemas.transactions import CreateTransactionSchema
from src.services.transactions import TransactionService, CreateTransactionDTO
from src.utils.pagination import paginate_query
from src.middleware.rate_limiter import sensitive_rate_limit
import bleach
from src.routes.auth import login_required, admin_required
from src.middleware.audit_middleware import audit_transaction_creation
from src.middleware.csrf_protection import csrf_protect

transactions_bp = Blueprint('transactions', __name__)

@transactions_bp.route('/', methods=['GET'])
@login_required
def get_transactions():
    try:
        current_user = User.query.get(session['user_id'])
        
        # Parâmetros de filtro
        user_id = request.args.get('user_id', type=int)
        platform_id = request.args.get('platform_id', type=int)
        transaction_type = request.args.get('transaction_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = Transaction.query
        
        # Filtrar por usuário
        if user_id:
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            query = query.filter_by(user_id=user_id)
        else:
            # Jogadores veem apenas suas próprias transações
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                query = query.filter_by(user_id=current_user.id)
        
        # Filtrar por plataforma
        if platform_id:
            query = query.filter_by(platform_id=platform_id)
        
        # Filtrar por tipo de transação
        if transaction_type:
            try:
                type_enum = TransactionType(transaction_type)
                query = query.filter_by(transaction_type=type_enum)
            except ValueError:
                return jsonify({'error': 'Invalid transaction type'}), 400
        
        # Filtrar por data
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(Transaction.created_at >= start_dt)
            except ValueError:
                return jsonify({'error': 'Invalid start_date format'}), 400
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(Transaction.created_at <= end_dt)
            except ValueError:
                return jsonify({'error': 'Invalid end_date format'}), 400
        
        # Aplicar paginação
        query = query.order_by(Transaction.created_at.desc())
        result = paginate_query(query, max_per_page=500)
        
        return jsonify({
            'transactions': [transaction.to_dict() for transaction in result['items']],
            'pagination': result['pagination']
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/', methods=['POST'])
@admin_required
@sensitive_rate_limit
@csrf_protect
@audit_transaction_creation
def create_transaction():
    try:
        current_user = User.query.get(session['user_id'])
        raw = request.get_json() or {}

        # Validar payload com Marshmallow
        schema = CreateTransactionSchema()
        payload = schema.load(raw)

        # Sanitização de descrição
        if 'description' in payload and payload['description']:
            payload['description'] = bleach.clean(payload['description'], tags=[], strip=True)

        # Verificações de existência
        user = User.query.get(payload['user_id'])
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or inactive'}), 404

        platform = Platform.query.get(payload['platform_id'])
        if not platform or not platform.is_active:
            return jsonify({'error': 'Platform not found or inactive'}), 404

        account = Account.query.filter_by(
            user_id=payload['user_id'], platform_id=payload['platform_id'], is_active=True
        ).first()
        if not account:
            return jsonify({'error': 'User does not have an active account on this platform'}), 400

        # Criar via serviço (regras de negócio centralizadas)
        dto = CreateTransactionDTO(
            user_id=payload['user_id'],
            platform_id=payload['platform_id'],
            transaction_type=payload['transaction_type'],
            amount=payload['amount'],
            description=payload.get('description', ''),
            created_by=current_user.id,
        )
        transaction = TransactionService.create(dto)

        return jsonify({
            'message': 'Transaction created successfully',
            'transaction': transaction.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/<int:transaction_id>', methods=['GET'])
@login_required
def get_transaction(transaction_id):
    try:
        current_user = User.query.get(session['user_id'])
        transaction = Transaction.query.get(transaction_id)
        
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != transaction.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({'transaction': transaction.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/<int:transaction_id>', methods=['PUT'])
@admin_required
@csrf_protect
def update_transaction(transaction_id):
    try:
        transaction = Transaction.query.get(transaction_id)
        
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        data = request.get_json()
        
        # Apenas descrição pode ser atualizada para manter integridade
        if 'description' in data:
            transaction.description = data['description']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Transaction updated successfully',
            'transaction': transaction.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/summary', methods=['GET'])
@login_required
def get_transaction_summary():
    try:
        current_user = User.query.get(session['user_id'])
        
        user_id = request.args.get('user_id', type=int)
        platform_id = request.args.get('platform_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Verificar permissões
        if user_id:
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
        else:
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                user_id = current_user.id
        
        query = Transaction.query
        
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        if platform_id:
            query = query.filter_by(platform_id=platform_id)
        
        # Filtrar por data (padrão: últimos 30 dias)
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(Transaction.created_at >= start_dt)
            except ValueError:
                return jsonify({'error': 'Invalid start_date format'}), 400
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(Transaction.created_at <= end_dt)
            except ValueError:
                return jsonify({'error': 'Invalid end_date format'}), 400
        
        transactions = query.all()
        
        # Calcular resumo
        summary = {
            'total_transactions': len(transactions),
            'total_reloads': 0,
            'total_withdrawals': 0,
            'total_profits': 0,
            'total_losses': 0,
            'net_result': 0
        }
        
        for transaction in transactions:
            amount = float(transaction.amount)
            if transaction.transaction_type == TransactionType.RELOAD:
                summary['total_reloads'] += amount
            elif transaction.transaction_type == TransactionType.WITHDRAWAL:
                summary['total_withdrawals'] += amount
            elif transaction.transaction_type == TransactionType.PROFIT:
                summary['total_profits'] += amount
            elif transaction.transaction_type == TransactionType.LOSS:
                summary['total_losses'] += amount
        
        summary['net_result'] = summary['total_profits'] - summary['total_losses']
        
        return jsonify({'summary': summary}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

