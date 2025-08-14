#!/usr/bin/env python3
"""
Sistema de Backup Automático para SQLite - Invictus Poker Team
Implementa backup automático, restore e manutenção do banco de dados.
"""

import os
import shutil
import sqlite3
import schedule
import time
import threading
from datetime import datetime, timedelta
from importlib import import_module
from typing import Optional, List, Dict
import json
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BackupManager:
    """Gerenciador de backup automático para SQLite"""
    
    def __init__(self, 
                 database_path: str, 
                 backup_dir: str = None,
                 max_backups: int = 30):
        """
        Inicializa o gerenciador de backup.
        
        Args:
            database_path: Caminho para o arquivo SQLite
            backup_dir: Diretório para armazenar backups (default: database_dir/backups)
            max_backups: Número máximo de backups a manter
        """
        self.database_path = database_path
        self.backup_dir = backup_dir or os.path.join(os.path.dirname(database_path), 'backups')
        self.max_backups = max_backups
        
        # Criar diretório de backup se não existir
        os.makedirs(self.backup_dir, exist_ok=True)
        
        # Arquivo de metadados dos backups
        self.metadata_file = os.path.join(self.backup_dir, 'backup_metadata.json')
        
        # Thread para execução de backups automáticos
        self.backup_thread = None
        self.running = False
    
    def create_backup(self, description: str = None) -> Dict[str, str]:
        """
        Cria um backup do banco de dados.
        
        Args:
            description: Descrição opcional do backup
            
        Returns:
            Dicionário com informações do backup criado
        """
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"invictus_backup_{timestamp}.db"
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            # Criar backup usando SQLite .backup()
            with sqlite3.connect(self.database_path) as source_conn:
                with sqlite3.connect(backup_path) as backup_conn:
                    source_conn.backup(backup_conn)
            
            # Verificar integridade do backup
            if self._verify_backup_integrity(backup_path):
                # Salvar metadados
                backup_info = {
                    'filename': backup_filename,
                    'path': backup_path,
                    'timestamp': timestamp,
                    'datetime': datetime.now().isoformat(),
                    'description': description or f"Backup automático - {timestamp}",
                    'size': os.path.getsize(backup_path),
                    'verified': True
                }
                
                self._save_backup_metadata(backup_info)
                self._cleanup_old_backups()
                
                logger.info(f"Backup criado com sucesso: {backup_filename}")
                return backup_info
            else:
                # Remover backup corrompido
                if os.path.exists(backup_path):
                    os.remove(backup_path)
                raise Exception("Backup falhou na verificação de integridade")
                
        except Exception as e:
            logger.error(f"Erro ao criar backup: {str(e)}")
            raise
    
    def restore_backup(self, backup_filename: str) -> bool:
        """
        Restaura um backup específico.
        
        Args:
            backup_filename: Nome do arquivo de backup
            
        Returns:
            True se restaurado com sucesso, False caso contrário
        """
        try:
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            if not os.path.exists(backup_path):
                raise FileNotFoundError(f"Arquivo de backup não encontrado: {backup_filename}")
            
            # Verificar integridade antes do restore
            if not self._verify_backup_integrity(backup_path):
                raise Exception("Backup corrompido, não é possível restaurar")
            
            # Criar backup do estado atual antes do restore
            current_backup = self.create_backup("Backup antes do restore")
            
            # Fazer backup do arquivo atual
            current_backup_path = f"{self.database_path}.before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.copy2(self.database_path, current_backup_path)
            
            # Restaurar backup
            shutil.copy2(backup_path, self.database_path)
            
            logger.info(f"Backup restaurado com sucesso: {backup_filename}")
            logger.info(f"Backup do estado anterior salvo em: {current_backup_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"Erro ao restaurar backup: {str(e)}")
            return False
    
    def list_backups(self) -> List[Dict[str, str]]:
        """
        Lista todos os backups disponíveis.
        
        Returns:
            Lista de dicionários com informações dos backups
        """
        try:
            if os.path.exists(self.metadata_file):
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    return sorted(metadata.get('backups', []), 
                                key=lambda x: x['datetime'], reverse=True)
            return []
        except Exception as e:
            logger.error(f"Erro ao listar backups: {str(e)}")
            return []
    
    def delete_backup(self, backup_filename: str) -> bool:
        """
        Remove um backup específico.
        
        Args:
            backup_filename: Nome do arquivo de backup
            
        Returns:
            True se removido com sucesso, False caso contrário
        """
        try:
            backup_path = os.path.join(self.backup_dir, backup_filename)
            
            if os.path.exists(backup_path):
                os.remove(backup_path)
                
                # Atualizar metadados
                metadata = self._load_backup_metadata()
                metadata['backups'] = [b for b in metadata['backups'] 
                                     if b['filename'] != backup_filename]
                self._save_backup_metadata_full(metadata)
                
                logger.info(f"Backup removido: {backup_filename}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"Erro ao remover backup: {str(e)}")
            return False
    
    def start_automatic_backup(self, interval_hours: int = 6):
        """
        Inicia sistema de backup automático.
        
        Args:
            interval_hours: Intervalo entre backups em horas
        """
        if self.running:
            logger.warning("Sistema de backup automático já está em execução")
            return
        
        self.running = True
        
        # Agendar backup automático
        schedule.every(interval_hours).hours.do(
            lambda: self.create_backup(f"Backup automático - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        )
        
        # Agendar limpeza diária
        schedule.every().day.at("02:00").do(self._cleanup_old_backups)

        # Agendar verificação diária de dados incompletos às 09:00
        def _notify_incomplete():
            try:
                notif_module = import_module('src.utils.notification_service')
                notif_module.NotificationService.notify_incomplete_data()
            except Exception as e:
                logger.error(f"Erro ao executar verificação diária de pendências: {e}")
        schedule.every().day.at("09:00").do(_notify_incomplete)
        
        # Thread para executar agendamentos
        def run_scheduler():
            logger.info(f"Sistema de backup automático iniciado (intervalo: {interval_hours}h)")
            while self.running:
                schedule.run_pending()
                time.sleep(60)  # Verificar a cada minuto
        
        self.backup_thread = threading.Thread(target=run_scheduler, daemon=True)
        self.backup_thread.start()
    
    def stop_automatic_backup(self):
        """Para o sistema de backup automático."""
        self.running = False
        schedule.clear()
        logger.info("Sistema de backup automático parado")
    
    def get_database_info(self) -> Dict[str, any]:
        """
        Obtém informações sobre o banco de dados.
        
        Returns:
            Dicionário com informações do banco
        """
        try:
            info = {
                'database_path': self.database_path,
                'exists': os.path.exists(self.database_path),
                'size': 0,
                'wal_mode': False,
                'backup_dir': self.backup_dir,
                'total_backups': len(self.list_backups())
            }
            
            if info['exists']:
                info['size'] = os.path.getsize(self.database_path)
                
                # Verificar se está em WAL mode
                try:
                    with sqlite3.connect(self.database_path) as conn:
                        cursor = conn.cursor()
                        cursor.execute("PRAGMA journal_mode")
                        result = cursor.fetchone()
                        info['wal_mode'] = result[0].upper() == 'WAL' if result else False
                except Exception:
                    pass
            
            return info
            
        except Exception as e:
            logger.error(f"Erro ao obter informações do banco: {str(e)}")
            return {}
    
    def _verify_backup_integrity(self, backup_path: str) -> bool:
        """Verifica a integridade de um backup."""
        try:
            with sqlite3.connect(backup_path) as conn:
                cursor = conn.cursor()
                cursor.execute("PRAGMA integrity_check")
                result = cursor.fetchone()
                return result[0] == 'ok' if result else False
        except Exception:
            return False
    
    def _save_backup_metadata(self, backup_info: Dict[str, str]):
        """Salva metadados de um backup."""
        metadata = self._load_backup_metadata()
        metadata['backups'].append(backup_info)
        metadata['last_backup'] = backup_info['datetime']
        self._save_backup_metadata_full(metadata)
    
    def _load_backup_metadata(self) -> Dict[str, any]:
        """Carrega metadados dos backups."""
        try:
            if os.path.exists(self.metadata_file):
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        
        return {
            'backups': [],
            'created': datetime.now().isoformat(),
            'last_backup': None
        }
    
    def _save_backup_metadata_full(self, metadata: Dict[str, any]):
        """Salva metadados completos."""
        try:
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Erro ao salvar metadados: {str(e)}")
    
    def _cleanup_old_backups(self):
        """Remove backups antigos baseado no limite configurado."""
        try:
            backups = self.list_backups()
            if len(backups) > self.max_backups:
                # Manter apenas os backups mais recentes
                backups_to_remove = backups[self.max_backups:]
                
                for backup in backups_to_remove:
                    self.delete_backup(backup['filename'])
                
                logger.info(f"Removidos {len(backups_to_remove)} backups antigos")
                
        except Exception as e:
            logger.error(f"Erro na limpeza de backups: {str(e)}")


# Instância global do gerenciador de backup
backup_manager = None

def init_backup_manager(database_path: str, auto_start: bool = True) -> BackupManager:
    """
    Inicializa o gerenciador global de backup.
    
    Args:
        database_path: Caminho para o banco de dados
        auto_start: Se deve iniciar backup automático
        
    Returns:
        Instância do BackupManager
    """
    global backup_manager
    
    backup_manager = BackupManager(database_path)
    
    if auto_start:
        # Criar backup inicial
        backup_manager.create_backup("Backup inicial - Sistema iniciado")
        
        # Iniciar backup automático a cada 6 horas
        backup_manager.start_automatic_backup(interval_hours=6)
    
    return backup_manager

def get_backup_manager() -> Optional[BackupManager]:
    """Retorna a instância global do gerenciador de backup."""
    return backup_manager

