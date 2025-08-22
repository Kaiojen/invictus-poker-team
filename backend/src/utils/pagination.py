"""
Utilitários de paginação para SQLAlchemy queries.
"""
from flask import request


def paginate_query(query, page=None, per_page=None, max_per_page=100):
    """
    Paginar uma query SQLAlchemy.
    
    Args:
        query: SQLAlchemy query object
        page: Número da página (default: 1 ou request.args.get('page'))
        per_page: Itens por página (default: 20 ou request.args.get('per_page'))
        max_per_page: Máximo de itens por página permitido
    
    Returns:
        dict: {
            'items': [lista de itens],
            'pagination': {
                'page': 1,
                'per_page': 20,
                'total': 100,
                'pages': 5,
                'has_prev': False,
                'has_next': True,
                'prev_num': None,
                'next_num': 2
            }
        }
    """
    # Obter parâmetros de paginação
    if page is None:
        page = request.args.get('page', 1, type=int)
    if per_page is None:
        per_page = request.args.get('per_page', 20, type=int)
    
    # Validar parâmetros
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = 20
    if per_page > max_per_page:
        per_page = max_per_page
    
    # Executar paginação
    pagination = query.paginate(
        page=page,
        per_page=per_page,
        error_out=False
    )
    
    return {
        'items': pagination.items,
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages,
            'has_prev': pagination.has_prev,
            'has_next': pagination.has_next,
            'prev_num': pagination.prev_num,
            'next_num': pagination.next_num
        }
    }


def get_pagination_params(default_per_page=20, max_per_page=100):
    """
    Extrair parâmetros de paginação da request.
    
    Returns:
        tuple: (page, per_page)
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', default_per_page, type=int)
    
    # Validar
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = default_per_page
    if per_page > max_per_page:
        per_page = max_per_page
        
    return page, per_page

