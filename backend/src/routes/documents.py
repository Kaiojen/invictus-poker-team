import os
import uuid
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, session, send_from_directory
from src.models.models import (
    db, Document, User, Account, ReloadRequest, WithdrawalRequest,
    UserRole, DocumentStatus
)
from src.routes.auth import login_required, admin_required

documents_bp = Blueprint('documents', __name__)

# Configurações de upload
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'uploads')
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_size(file):
    file.seek(0, 2)  # Seek to end of file
    size = file.tell()
    file.seek(0)  # Reset to beginning
    return size

@documents_bp.route('/', methods=['POST'])
@login_required
def upload_document():
    """Upload de documento/comprovante"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Verificar se arquivo foi enviado
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validar arquivo
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        file_size = get_file_size(file)
        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'File size exceeds maximum limit (16MB)'}), 400
        
        # Obter dados do formulário
        document_type = request.form.get('document_type', 'general')
        account_id = request.form.get('account_id', type=int)
        reload_request_id = request.form.get('reload_request_id', type=int)
        withdrawal_request_id = request.form.get('withdrawal_request_id', type=int)
        user_id = request.form.get('user_id', type=int)
        
        # Determinar user_id
        if user_id:
            # Apenas admins/managers podem fazer upload para outros usuários
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                return jsonify({'error': 'Access denied'}), 403
        else:
            user_id = current_user.id
        
        # Verificar permissões para as associações
        if account_id:
            account = Account.query.get(account_id)
            if not account or (current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and account.user_id != user_id):
                return jsonify({'error': 'Invalid account or access denied'}), 403
        
        if reload_request_id:
            reload_req = ReloadRequest.query.get(reload_request_id)
            if not reload_req or (current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and reload_req.user_id != user_id):
                return jsonify({'error': 'Invalid reload request or access denied'}), 403
        
        if withdrawal_request_id:
            withdrawal_req = WithdrawalRequest.query.get(withdrawal_request_id)
            if not withdrawal_req or (current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and withdrawal_req.user_id != user_id):
                return jsonify({'error': 'Invalid withdrawal request or access denied'}), 403
        
        # Gerar nome único para o arquivo
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Criar diretório se não existir
        user_upload_dir = os.path.join(UPLOAD_FOLDER, str(user_id))
        os.makedirs(user_upload_dir, exist_ok=True)
        
        # Salvar arquivo
        file_path = os.path.join(user_upload_dir, unique_filename)
        file.save(file_path)
        
        # Criar registro no banco
        document = Document(
            user_id=user_id,
            filename=unique_filename,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=file.content_type,
            document_type=document_type,
            account_id=account_id,
            reload_request_id=reload_request_id,
            withdrawal_request_id=withdrawal_request_id
        )
        
        db.session.add(document)
        db.session.commit()
        
        return jsonify({
            'message': 'Document uploaded successfully',
            'document': document.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        # Tentar remover arquivo se foi criado
        try:
            if 'file_path' in locals():
                os.remove(file_path)
        except:
            pass
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/', methods=['GET'])
@login_required
def get_documents():
    """Listar documentos"""
    try:
        current_user = User.query.get(session['user_id'])
        
        # Parâmetros de filtro
        user_id = request.args.get('user_id', type=int)
        document_type = request.args.get('document_type')
        status = request.args.get('status')
        account_id = request.args.get('account_id', type=int)
        
        query = Document.query
        
        # Filtrar por usuário
        if user_id:
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            query = query.filter_by(user_id=user_id)
        else:
            # Jogadores veem apenas seus próprios documentos
            if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
                query = query.filter_by(user_id=current_user.id)
        
        # Aplicar outros filtros
        if document_type:
            query = query.filter_by(document_type=document_type)
        
        if status:
            try:
                status_enum = DocumentStatus(status)
                query = query.filter_by(status=status_enum)
            except ValueError:
                return jsonify({'error': 'Invalid status'}), 400
        
        if account_id:
            query = query.filter_by(account_id=account_id)
        
        documents = query.order_by(Document.created_at.desc()).all()
        return jsonify({'documents': [doc.to_dict() for doc in documents]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>', methods=['GET'])
@login_required
def get_document(document_id):
    """Obter detalhes de um documento"""
    try:
        current_user = User.query.get(session['user_id'])
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != document.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({'document': document.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>/download', methods=['GET'])
@login_required
def download_document(document_id):
    """Download de documento"""
    try:
        current_user = User.query.get(session['user_id'])
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != document.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Verificar se arquivo existe
        if not os.path.exists(document.file_path):
            return jsonify({'error': 'File not found on disk'}), 404
        
        directory = os.path.dirname(document.file_path)
        filename = os.path.basename(document.file_path)
        
        return send_from_directory(
            directory, 
            filename, 
            as_attachment=True, 
            download_name=document.original_filename
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>/verify', methods=['POST'])
@admin_required
def verify_document(document_id):
    """Verificar documento"""
    try:
        current_user = User.query.get(session['user_id'])
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        data = request.get_json() or {}
        status = data.get('status', 'verified')
        verification_notes = data.get('verification_notes', '')
        
        # Validar status
        try:
            status_enum = DocumentStatus(status)
        except ValueError:
            return jsonify({'error': 'Invalid status'}), 400
        
        # Atualizar documento
        document.status = status_enum
        document.verified_by = current_user.id
        document.verified_at = datetime.utcnow()
        document.verification_notes = verification_notes
        
        db.session.commit()
        
        return jsonify({
            'message': 'Document verification updated successfully',
            'document': document.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/<int:document_id>', methods=['DELETE'])
@login_required
def delete_document(document_id):
    """Deletar documento"""
    try:
        current_user = User.query.get(session['user_id'])
        document = Document.query.get(document_id)
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Verificar permissões
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER] and current_user.id != document.user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Documentos verificados só podem ser deletados por admins
        if document.status == DocumentStatus.VERIFIED and current_user.role != UserRole.ADMIN:
            return jsonify({'error': 'Cannot delete verified documents'}), 403
        
        # Remover arquivo do disco
        try:
            if os.path.exists(document.file_path):
                os.remove(document.file_path)
        except Exception as e:
            print(f"Error removing file: {e}")
        
        # Remover registro do banco
        db.session.delete(document)
        db.session.commit()
        
        return jsonify({'message': 'Document deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/pending', methods=['GET'])
@admin_required
def get_pending_documents():
    """Listar documentos pendentes de verificação"""
    try:
        pending_docs = Document.query.filter_by(status=DocumentStatus.PENDING)\
            .order_by(Document.created_at.asc()).all()
        
        return jsonify({
            'pending_documents': [doc.to_dict() for doc in pending_docs],
            'count': len(pending_docs)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/stats', methods=['GET'])
@admin_required
def get_document_stats():
    """Estatísticas de documentos"""
    try:
        from sqlalchemy import func
        
        # Contar por status
        status_counts = db.session.query(
            Document.status, func.count(Document.id)
        ).group_by(Document.status).all()
        
        # Contar por tipo
        type_counts = db.session.query(
            Document.document_type, func.count(Document.id)
        ).group_by(Document.document_type).all()
        
        # Documentos por usuário (top 10)
        user_counts = db.session.query(
            User.full_name, func.count(Document.id)
        ).join(Document).group_by(User.id, User.full_name)\
         .order_by(func.count(Document.id).desc()).limit(10).all()
        
        return jsonify({
            'status_counts': dict(status_counts),
            'type_counts': dict(type_counts),
            'top_users': [{'name': name, 'count': count} for name, count in user_counts]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
