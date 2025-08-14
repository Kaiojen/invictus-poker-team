from flask import Blueprint, request, jsonify
from src.models.models import db, Platform
from src.routes.auth import login_required, admin_required

platforms_bp = Blueprint('platforms', __name__)

@platforms_bp.route('/', methods=['GET'])
@login_required
def get_platforms():
    try:
        platforms = Platform.query.filter_by(is_active=True).all()
        return jsonify({'platforms': [platform.to_dict() for platform in platforms]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@platforms_bp.route('/', methods=['POST'])
@admin_required
def create_platform():
    try:
        data = request.get_json()
        
        required_fields = ['name', 'display_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Verificar se a plataforma já existe
        existing_platform = Platform.query.filter_by(name=data['name']).first()
        if existing_platform:
            return jsonify({'error': 'Platform already exists'}), 400
        
        platform = Platform(
            name=data['name'],
            display_name=data['display_name']
        )
        
        db.session.add(platform)
        db.session.commit()
        
        return jsonify({
            'message': 'Platform created successfully',
            'platform': platform.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@platforms_bp.route('/<int:platform_id>', methods=['GET'])
@login_required
def get_platform(platform_id):
    try:
        platform = Platform.query.get(platform_id)
        if not platform:
            return jsonify({'error': 'Platform not found'}), 404
        
        return jsonify({'platform': platform.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@platforms_bp.route('/<int:platform_id>', methods=['PUT'])
@admin_required
def update_platform(platform_id):
    try:
        platform = Platform.query.get(platform_id)
        if not platform:
            return jsonify({'error': 'Platform not found'}), 404
        
        data = request.get_json()
        
        if 'name' in data:
            # Verificar se o nome já existe para outra plataforma
            existing_platform = Platform.query.filter(
                Platform.name == data['name'], 
                Platform.id != platform_id
            ).first()
            if existing_platform:
                return jsonify({'error': 'Platform name already exists'}), 400
            platform.name = data['name']
        
        if 'display_name' in data:
            platform.display_name = data['display_name']
        
        if 'is_active' in data:
            platform.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Platform updated successfully',
            'platform': platform.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@platforms_bp.route('/<int:platform_id>', methods=['DELETE'])
@admin_required
def delete_platform(platform_id):
    try:
        platform = Platform.query.get(platform_id)
        if not platform:
            return jsonify({'error': 'Platform not found'}), 404
        
        # Soft delete - apenas marcar como inativo
        platform.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Platform deactivated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

