from flask import Blueprint, request, jsonify, session
from datetime import datetime, timedelta
from src.models.models import db, Transaction, User, Platform, Account, UserRole, TransactionType
from src.routes.auth import login_required, admin_required

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
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)
        
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
        
        # Aplicar paginação e ordenação
        transactions = query.order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
        total_count = query.count()
        
        return jsonify({
            'transactions': [transaction.to_dict() for transaction in transactions],
            'total_count': total_count,
            'limit': limit,
            'offset': offset
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transactions_bp.route('/', methods=['POST'])
@admin_required
def create_transaction():
    try:
        current_user = User.query.get(session['user_id'])
        data = request.get_json()
        
        required_fields = ['user_id', 'platform_id', 'transaction_type', 'amount']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Verificar se o usuário existe
        user = User.query.get(data['user_id'])
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or inactive'}), 404
        
        # Verificar se a plataforma existe
        platform = Platform.query.get(data['platform_id'])
        if not platform or not platform.is_active:
            return jsonify({'error': 'Platform not found or inactive'}), 404
        
        # Verificar se o usuário tem conta nesta plataforma
        account = Account.query.filter_by(
            user_id=data['user_id'],
            platform_id=data['platform_id'],
            is_active=True
        ).first()
        if not account:
            return jsonify({'error': 'User does not have an active account on this platform'}), 400
        
        # Validar tipo de transação
        try:
            transaction_type = TransactionType(data['transaction_type'])
        except ValueError:
            return jsonify({'error': 'Invalid transaction type'}), 400
        
        # Validar valor
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than zero'}), 400
        
        # Criar transação
        transaction = Transaction(
            user_id=data['user_id'],
            platform_id=data['platform_id'],
            transaction_type=transaction_type,
            amount=amount,
            description=data.get('description', ''),
            created_by=current_user.id
        )
        
        # Atualizar saldo da conta baseado no tipo de transação
        if transaction_type == TransactionType.RELOAD:
            account.current_balance += amount
            account.total_reloads += amount
        elif transaction_type == TransactionType.WITHDRAWAL:
            if account.current_balance < amount:
                return jsonify({'error': 'Insufficient balance for withdrawal'}), 400
            account.current_balance -= amount
            account.total_withdrawals += amount
        elif transaction_type == TransactionType.PROFIT:
            account.current_balance += amount
        elif transaction_type == TransactionType.LOSS:
            account.current_balance -= amount
            if account.current_balance < 0:
                account.current_balance = 0  # Não permitir saldo negativo
        
        db.session.add(transaction)
        db.session.commit()
        
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

