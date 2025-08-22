"""
Utilitários de criptografia para dados sensíveis.
"""
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional


class DataEncryption:
    """Criptografia simétrica para dados sensíveis usando Fernet"""
    
    def __init__(self, password: str, salt: Optional[bytes] = None):
        """
        Inicializar criptografia com senha.
        
        Args:
            password: Senha principal para derivar chave
            salt: Salt opcional (será gerado se não fornecido)
        """
        if salt is None:
            salt = os.urandom(16)
        
        self.salt = salt
        
        # Derivar chave criptográfica usando PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        self.fernet = Fernet(key)
    
    def encrypt(self, data: str) -> str:
        """
        Criptografar string.
        
        Args:
            data: Dados em texto plano
            
        Returns:
            Dados criptografados em base64 (salt + dados)
        """
        if not data:
            return ""
        
        encrypted_data = self.fernet.encrypt(data.encode())
        
        # Combinar salt + dados criptografados
        combined = self.salt + encrypted_data
        return base64.urlsafe_b64encode(combined).decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """
        Descriptografar string.
        
        Args:
            encrypted_data: Dados criptografados em base64
            
        Returns:
            Dados em texto plano
        """
        if not encrypted_data:
            return ""
        
        try:
            # Decodificar base64
            combined = base64.urlsafe_b64decode(encrypted_data.encode())
            
            # Separar salt (primeiros 16 bytes) dos dados
            salt = combined[:16]
            encrypted = combined[16:]
            
            # Recriar Fernet com salt correto
            if salt != self.salt:
                kdf = PBKDF2HMAC(
                    algorithm=hashes.SHA256(),
                    length=32,
                    salt=salt,
                    iterations=100000,
                )
                key = base64.urlsafe_b64encode(kdf.derive(
                    os.environ.get('ENCRYPTION_KEY', 'default-key').encode()
                ))
                fernet = Fernet(key)
            else:
                fernet = self.fernet
            
            # Descriptografar
            decrypted = fernet.decrypt(encrypted)
            return decrypted.decode()
            
        except Exception:
            # Em caso de erro, retornar vazio (dados podem estar não criptografados)
            return ""


# Instância global para dados bancários
_bank_encryption = None


def get_bank_encryption() -> DataEncryption:
    """Obter instância de criptografia para dados bancários"""
    global _bank_encryption
    
    if _bank_encryption is None:
        encryption_key = os.environ.get('ENCRYPTION_KEY', 'invictus-bank-data-key-2024')
        _bank_encryption = DataEncryption(encryption_key)
    
    return _bank_encryption


def encrypt_bank_data(data: str) -> str:
    """Criptografar dados bancários (PIX, conta, etc.)"""
    if not data or data.strip() == "":
        return ""
    
    encryptor = get_bank_encryption()
    return encryptor.encrypt(data.strip())


def decrypt_bank_data(encrypted_data: str) -> str:
    """Descriptografar dados bancários"""
    if not encrypted_data or encrypted_data.strip() == "":
        return ""
    
    encryptor = get_bank_encryption()
    return encryptor.decrypt(encrypted_data.strip())


def mask_sensitive_data(data: str, mask_char: str = "*", visible_chars: int = 4) -> str:
    """
    Mascarar dados sensíveis para logs/display.
    
    Args:
        data: Dados originais
        mask_char: Caractere para mascarar
        visible_chars: Número de caracteres visíveis no final
        
    Returns:
        Dados mascarados (ex: ****1234)
    """
    if not data or len(data) <= visible_chars:
        return mask_char * len(data) if data else ""
    
    return mask_char * (len(data) - visible_chars) + data[-visible_chars:]


def is_encrypted(data: str) -> bool:
    """Verificar se string parece estar criptografada (base64)"""
    if not data:
        return False
    
    try:
        # Tentar decodificar como base64
        decoded = base64.urlsafe_b64decode(data.encode())
        # Se decodificar e tiver pelo menos 16 bytes (salt), provavelmente é criptografado
        return len(decoded) >= 16
    except:
        return False


