import os
from flask import current_app
from src.models.models import db, User, Account, Platform, ReloadRequest, WithdrawalRequest, Transaction, BalanceHistory, UserRole


def is_test_username(username: str) -> bool:
    username_lower = (username or "").lower()
    return (
        "test" in username_lower
        or username_lower.startswith("luxon test user")
        or username_lower.startswith("ps inactive test")
        or username_lower.startswith("ps isolation test")
        or username_lower.startswith("pnl test user")
        or username_lower.startswith("isolation player")
    )


def cleanup_test_data(commit: bool = True) -> dict:
    """Remove usuários e contas de teste em massa, preservando admin/manager reais.

    Critérios:
    - Usuários cujo username ou full_name contenham termos de teste
    - Contas associadas são removidas em cascata
    - Transações, históricos e solicitações vinculadas também são removidas
    """

    removed = {
        "users": 0,
        "accounts": 0,
        "transactions": 0,
        "reload_requests": 0,
        "withdrawal_requests": 0,
        "balance_history": 0,
    }

    # Encontrar usuários de teste
    test_users = (
        User.query.filter(
            (User.role == UserRole.PLAYER)
        ).all()
    )

    test_user_ids = [u.id for u in test_users if is_test_username(u.username) or is_test_username(u.full_name)]

    if not test_user_ids:
        return removed

    # Remover registros dependentes explicitamente por performance/claridade
    removed["transactions"] = Transaction.query.filter(Transaction.user_id.in_(test_user_ids)).delete(synchronize_session=False)
    removed["reload_requests"] = ReloadRequest.query.filter(ReloadRequest.user_id.in_(test_user_ids)).delete(synchronize_session=False)
    removed["withdrawal_requests"] = WithdrawalRequest.query.filter(WithdrawalRequest.user_id.in_(test_user_ids)).delete(synchronize_session=False)

    # Contas e histórico
    account_ids = [a.id for a in Account.query.filter(Account.user_id.in_(test_user_ids)).all()]
    removed["balance_history"] = BalanceHistory.query.filter(BalanceHistory.account_id.in_(account_ids)).delete(synchronize_session=False)
    removed["accounts"] = Account.query.filter(Account.id.in_(account_ids)).delete(synchronize_session=False)

    # Por fim, remover usuários
    removed["users"] = User.query.filter(User.id.in_(test_user_ids)).delete(synchronize_session=False)

    if commit:
        db.session.commit()

    return removed


def cleanup_test_platforms(commit: bool = True) -> dict:
    """Remove plataformas de teste/inativas E todas as contas/lançamentos ligados a elas.

    Passos:
    1) Identificar plataformas de teste (name/display_name contendo 'test', 'inactive', 'isolation') e que não estejam na lista de plataformas reais
    2) Remover BalanceHistory/Transactions/ReloadRequests/WithdrawalRequests dessas plataformas
    3) Remover Accounts dessas plataformas
    4) Remover as próprias Platforms
    """
    kept = {"pokerstars", "ggpoker", "partypoker", "888poker", "luxonpay"}

    test_platforms = []
    for p in Platform.query.all():
        name = (p.name or "").lower()
        disp = (p.display_name or "").lower()
        if name in kept:
            continue
        if any(k in name for k in ("test", "inactive", "isolation")) or any(k in disp for k in ("test", "inactive", "isolation")):
            test_platforms.append(p.id)

    if not test_platforms:
        return {"platforms_removed": 0, "accounts_removed": 0}

    # Apagar dependências
    account_ids = [a.id for a in Account.query.filter(Account.platform_id.in_(test_platforms)).all()]
    BalanceHistory.query.filter(BalanceHistory.account_id.in_(account_ids)).delete(synchronize_session=False)
    Transaction.query.filter(Transaction.platform_id.in_(test_platforms)).delete(synchronize_session=False)
    ReloadRequest.query.filter(ReloadRequest.platform_id.in_(test_platforms)).delete(synchronize_session=False)
    WithdrawalRequest.query.filter(WithdrawalRequest.platform_id.in_(test_platforms)).delete(synchronize_session=False)
    accounts_removed = Account.query.filter(Account.id.in_(account_ids)).delete(synchronize_session=False)

    # Remover plataformas
    platforms_removed = Platform.query.filter(Platform.id.in_(test_platforms)).delete(synchronize_session=False)

    if commit:
        db.session.commit()

    return {"platforms_removed": platforms_removed, "accounts_removed": accounts_removed}


