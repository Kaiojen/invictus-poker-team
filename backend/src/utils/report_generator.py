#!/usr/bin/env python3
"""
Gerador de Relatórios - Invictus Poker Team
Gera relatórios em PDF e CSV com dados de jogadores, time e performance.
"""

import os
import io
import csv
from io import BytesIO
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from sqlalchemy import and_, func, or_
from src.models.models import (
    db, User, Account, Platform, Transaction, ReloadRequest, 
    WithdrawalRequest, BalanceHistory, UserRole, Reta
)
import logging

logger = logging.getLogger(__name__)

class ReportGenerator:
    """Gerador de relatórios para o sistema Invictus Poker Team"""
    
    def __init__(self):
        """Inicializa o gerador de relatórios"""
        self.styles = getSampleStyleSheet()
        self.setup_custom_styles()
    
    def setup_custom_styles(self):
        """Define estilos customizados para os relatórios"""
        # Estilo para o título principal
        self.styles.add(ParagraphStyle(
            name='InvictusTitle',
            parent=self.styles['Title'],
            fontSize=24,
            textColor=colors.HexColor('#d4af37'),  # Dourado
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Estilo para subtítulos
        self.styles.add(ParagraphStyle(
            name='InvictusSubtitle',
            parent=self.styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#d4af37'),
            spaceAfter=12,
            spaceBefore=20,
            fontName='Helvetica-Bold'
        ))
        
        # Estilo para seções
        self.styles.add(ParagraphStyle(
            name='InvictusSection',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.black,
            spaceAfter=8,
            spaceBefore=16,
            fontName='Helvetica-Bold'
        ))
        
        # Estilo para texto normal
        self.styles.add(ParagraphStyle(
            name='InvictusNormal',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.black,
            spaceAfter=6,
            fontName='Helvetica'
        ))
    
    def generate_player_report(self, user_id: int, start_date: datetime = None, 
                             end_date: datetime = None, format_type: str = 'pdf') -> Tuple[bytes, str]:
        """
        Gera relatório individual de jogador.
        
        Args:
            user_id: ID do jogador
            start_date: Data de início do período
            end_date: Data de fim do período
            format_type: 'pdf' ou 'csv'
            
        Returns:
            Tuple com (dados_binarios, nome_arquivo)
        """
        # Buscar dados do jogador
        user = User.query.get(user_id)
        if not user or user.role != UserRole.PLAYER:
            raise ValueError("Jogador não encontrado")
        
        # Definir período padrão (últimos 30 dias)
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Coletar dados
        data = self._collect_player_data(user, start_date, end_date)
        
        if format_type.lower() == 'pdf':
            return self._generate_player_pdf(data, start_date, end_date)
        else:
            return self._generate_player_csv(data, start_date, end_date)
    
    def generate_team_report(self, start_date: datetime = None, end_date: datetime = None,
                           reta_id: int = None, format_type: str = 'pdf') -> Tuple[bytes, str]:
        """
        Gera relatório consolidado do time.
        
        Args:
            start_date: Data de início do período
            end_date: Data de fim do período
            reta_id: ID da reta (opcional)
            format_type: 'pdf' ou 'csv'
            
        Returns:
            Tuple com (dados_binarios, nome_arquivo)
        """
        # Definir período padrão (últimos 30 dias)
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Coletar dados do time
        data = self._collect_team_data(start_date, end_date, reta_id)
        
        if format_type.lower() == 'pdf':
            return self._generate_team_pdf(data, start_date, end_date, reta_id)
        else:
            return self._generate_team_csv(data, start_date, end_date, reta_id)
    
    def generate_reta_report(self, reta_id: int, start_date: datetime = None,
                           end_date: datetime = None, format_type: str = 'pdf') -> Tuple[bytes, str]:
        """
        Gera relatório por reta.
        
        Args:
            reta_id: ID da reta
            start_date: Data de início do período
            end_date: Data de fim do período
            format_type: 'pdf' ou 'csv'
            
        Returns:
            Tuple com (dados_binarios, nome_arquivo)
        """
        reta = Reta.query.get(reta_id)
        if not reta:
            raise ValueError("Reta não encontrada")
        
        # Definir período padrão (últimos 30 dias)
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Coletar dados da reta
        data = self._collect_reta_data(reta, start_date, end_date)
        
        if format_type.lower() == 'pdf':
            return self._generate_reta_pdf(data, start_date, end_date)
        else:
            return self._generate_reta_csv(data, start_date, end_date)
    
    def _collect_player_data(self, user: User, start_date: datetime, end_date: datetime) -> Dict:
        """Coleta dados completos de um jogador"""
        # Contas do jogador
        accounts = Account.query.filter_by(user_id=user.id, is_active=True).all()
        
        # Transações no período
        account_ids = [acc.id for acc in accounts]
        
        # Histórico de saldo
        balance_history = BalanceHistory.query.filter(
            and_(
                BalanceHistory.account_id.in_(account_ids),
                BalanceHistory.created_at >= start_date,
                BalanceHistory.created_at <= end_date
            )
        ).order_by(BalanceHistory.created_at.desc()).all()
        
        # Solicitações de reload
        reload_requests = ReloadRequest.query.filter(
            and_(
                ReloadRequest.user_id == user.id,
                ReloadRequest.created_at >= start_date,
                ReloadRequest.created_at <= end_date
            )
        ).order_by(ReloadRequest.created_at.desc()).all()
        
        # Solicitações de saque
        withdrawal_requests = WithdrawalRequest.query.filter(
            and_(
                WithdrawalRequest.user_id == user.id,
                WithdrawalRequest.created_at >= start_date,
                WithdrawalRequest.created_at <= end_date
            )
        ).order_by(WithdrawalRequest.created_at.desc()).all()
        
        # Calcular totais
        total_current_balance = sum(float(acc.current_balance) for acc in accounts)
        total_initial_balance = sum(float(acc.initial_balance) for acc in accounts if acc.has_account)
        total_pnl = total_current_balance - total_initial_balance
        
        total_reloads = sum(float(req.amount) for req in reload_requests if req.status == 'approved')
        total_withdrawals = sum(float(req.amount) for req in withdrawal_requests if req.status == 'completed')
        
        return {
            'user': user,
            'period': {'start': start_date, 'end': end_date},
            'accounts': accounts,
            'balance_history': balance_history,
            'reload_requests': reload_requests,
            'withdrawal_requests': withdrawal_requests,
            'totals': {
                'current_balance': total_current_balance,
                'initial_balance': total_initial_balance,
                'pnl': total_pnl,
                'reloads': total_reloads,
                'withdrawals': total_withdrawals,
                'net_result': total_pnl - total_reloads + total_withdrawals
            }
        }
    
    def _collect_team_data(self, start_date: datetime, end_date: datetime, reta_id: int = None) -> Dict:
        """Coleta dados consolidados do time"""
        # Filtrar jogadores por reta se especificado
        players_query = User.query.filter_by(role=UserRole.PLAYER, is_active=True)
        if reta_id:
            players_query = players_query.filter_by(reta_id=reta_id)
        
        players = players_query.all()
        
        team_data = {
            'period': {'start': start_date, 'end': end_date},
            'reta_filter': reta_id,
            'players': [],
            'totals': {
                'players_count': len(players),
                'total_balance': 0,
                'total_pnl': 0,
                'total_reloads': 0,
                'total_withdrawals': 0,
                'profitable_players': 0,
                'active_accounts': 0
            }
        }
        
        for player in players:
            player_data = self._collect_player_data(player, start_date, end_date)
            team_data['players'].append(player_data)
            
            # Somar totais
            team_data['totals']['total_balance'] += player_data['totals']['current_balance']
            team_data['totals']['total_pnl'] += player_data['totals']['pnl']
            team_data['totals']['total_reloads'] += player_data['totals']['reloads']
            team_data['totals']['total_withdrawals'] += player_data['totals']['withdrawals']
            
            if player_data['totals']['pnl'] > 0:
                team_data['totals']['profitable_players'] += 1
            
            team_data['totals']['active_accounts'] += len([acc for acc in player_data['accounts'] if acc.has_account])
        
        return team_data
    
    def _collect_reta_data(self, reta: Reta, start_date: datetime, end_date: datetime) -> Dict:
        """Coleta dados específicos de uma reta"""
        team_data = self._collect_team_data(start_date, end_date, reta.id)
        team_data['reta'] = reta
        return team_data
    
    def _generate_player_pdf(self, data: Dict, start_date: datetime, end_date: datetime) -> Tuple[bytes, str]:
        """Gera PDF do relatório de jogador"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*inch)
        story = []
        
        # Cabeçalho
        story.append(Paragraph("INVICTUS POKER TEAM", self.styles['InvictusTitle']))
        story.append(Paragraph("Relatório Individual de Jogador", self.styles['InvictusSubtitle']))
        story.append(Spacer(1, 12))
        
        # Informações do jogador
        user = data['user']
        story.append(Paragraph("Informações do Jogador", self.styles['InvictusSection']))
        
        player_info = [
            ['Nome Completo:', user.full_name],
            ['Username:', f"@{user.username}"],
            ['Email:', user.email],
            ['Reta:', user.reta.name if user.reta else 'Não definida'],
            ['Status:', 'Ativo' if user.is_active else 'Inativo'],
            ['Período do Relatório:', f"{start_date.strftime('%d/%m/%Y')} a {end_date.strftime('%d/%m/%Y')}"]
        ]
        
        player_table = Table(player_info, colWidths=[2*inch, 4*inch])
        player_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f8f9fa')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(player_table)
        story.append(Spacer(1, 20))
        
        # Resumo financeiro
        story.append(Paragraph("Resumo Financeiro", self.styles['InvictusSection']))
        
        totals = data['totals']
        financial_summary = [
            ['Métrica', 'Valor'],
            ['Saldo Total Atual', f"$ {totals['current_balance']:,.2f}"],
            ['Saldo Inicial', f"$ {totals['initial_balance']:,.2f}"],
            ['P&L Total', f"$ {totals['pnl']:,.2f}"],
            ['Total de Reloads', f"$ {totals['reloads']:,.2f}"],
            ['Total de Saques', f"$ {totals['withdrawals']:,.2f}"],
            ['Resultado Líquido', f"$ {totals['net_result']:,.2f}"]
        ]
        
        financial_table = Table(financial_summary, colWidths=[3*inch, 2*inch])
        financial_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d4af37')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(financial_table)
        story.append(Spacer(1, 20))
        
        # Contas por plataforma
        if data['accounts']:
            story.append(Paragraph("Contas por Plataforma", self.styles['InvictusSection']))
            
            accounts_data = [['Plataforma', 'Saldo Inicial', 'Saldo Atual', 'P&L', 'Status']]
            for account in data['accounts']:
                pnl = account.pnl
                pnl_color = 'green' if pnl >= 0 else 'red'
                accounts_data.append([
                    account.platform.display_name,
                    f"$ {float(account.initial_balance):,.2f}",
                    f"$ {float(account.current_balance):,.2f}",
                    f"$ {pnl:,.2f}",
                    account.status.value.title()
                ])
            
            accounts_table = Table(accounts_data, colWidths=[1.5*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1*inch])
            accounts_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d4af37')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6')),
                ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(accounts_table)
            story.append(Spacer(1, 20))
        
        # Histórico de solicitações
        if data['reload_requests'] or data['withdrawal_requests']:
            story.append(Paragraph("Histórico de Solicitações", self.styles['InvictusSection']))
            
            # Reloads
            if data['reload_requests']:
                story.append(Paragraph("Solicitações de Reload", self.styles['InvictusNormal']))
                reload_data = [['Data', 'Plataforma', 'Valor', 'Status']]
                for req in data['reload_requests'][:10]:  # Máximo 10
                    reload_data.append([
                        req.created_at.strftime('%d/%m/%Y'),
                        req.platform.display_name,
                        f"$ {float(req.amount):,.2f}",
                        req.status.value.title()
                    ])
                
                reload_table = Table(reload_data, colWidths=[1.2*inch, 2*inch, 1.5*inch, 1.3*inch])
                reload_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e3f2fd')),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6')),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ]))
                story.append(reload_table)
                story.append(Spacer(1, 12))
        
        # Rodapé
        story.append(Spacer(1, 30))
        story.append(Paragraph(f"Relatório gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')}", 
                              self.styles['InvictusNormal']))
        story.append(Paragraph("Invictus Poker Team - Sistema de Gestão", self.styles['InvictusNormal']))
        
        # Gerar PDF
        doc.build(story)
        buffer.seek(0)
        
        filename = f"relatorio_jogador_{user.username}_{start_date.strftime('%Y%m%d')}_a_{end_date.strftime('%Y%m%d')}.pdf"
        return buffer.getvalue(), filename
    
    def _generate_player_csv(self, data: Dict, start_date: datetime, end_date: datetime) -> Tuple[bytes, str]:
        """Gera CSV do relatório de jogador"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        user = data['user']
        
        # Cabeçalho
        writer.writerow(['RELATÓRIO INDIVIDUAL - INVICTUS POKER TEAM'])
        writer.writerow([f"Jogador: {user.full_name} (@{user.username})"])
        writer.writerow([f"Período: {start_date.strftime('%d/%m/%Y')} a {end_date.strftime('%d/%m/%Y')}"])
        writer.writerow([])
        
        # Resumo financeiro
        writer.writerow(['RESUMO FINANCEIRO'])
        totals = data['totals']
        writer.writerow(['Saldo Total Atual', f"$ {totals['current_balance']:,.2f}"])
        writer.writerow(['Saldo Inicial', f"$ {totals['initial_balance']:,.2f}"])
        writer.writerow(['P&L Total', f"$ {totals['pnl']:,.2f}"])
        writer.writerow(['Total de Reloads', f"$ {totals['reloads']:,.2f}"])
        writer.writerow(['Total de Saques', f"$ {totals['withdrawals']:,.2f}"])
        writer.writerow(['Resultado Líquido', f"$ {totals['net_result']:,.2f}"])
        writer.writerow([])
        
        # Contas
        writer.writerow(['CONTAS POR PLATAFORMA'])
        writer.writerow(['Plataforma', 'Saldo Inicial', 'Saldo Atual', 'P&L', 'Status'])
        for account in data['accounts']:
            writer.writerow([
                account.platform.display_name,
                f"$ {float(account.initial_balance):,.2f}",
                f"$ {float(account.current_balance):,.2f}",
                f"$ {account.pnl:,.2f}",
                account.status.value.title()
            ])
        
        output.seek(0)
        content = output.getvalue().encode('utf-8-sig')  # BOM para Excel
        
        filename = f"relatorio_jogador_{user.username}_{start_date.strftime('%Y%m%d')}_a_{end_date.strftime('%Y%m%d')}.csv"
        return content, filename
    
    def _generate_team_pdf(self, data: Dict, start_date: datetime, end_date: datetime, reta_id: int = None) -> Tuple[bytes, str]:
        """Gera PDF do relatório do time"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1*inch)
        story = []
        
        # Cabeçalho
        story.append(Paragraph("INVICTUS POKER TEAM", self.styles['InvictusTitle']))
        title = "Relatório Consolidado do Time"
        if reta_id:
            reta = Reta.query.get(reta_id)
            title += f" - {reta.name}"
        story.append(Paragraph(title, self.styles['InvictusSubtitle']))
        story.append(Spacer(1, 12))
        
        # Período
        story.append(Paragraph(f"Período: {start_date.strftime('%d/%m/%Y')} a {end_date.strftime('%d/%m/%Y')}", 
                              self.styles['InvictusNormal']))
        story.append(Spacer(1, 20))
        
        # Resumo geral
        story.append(Paragraph("Resumo Geral", self.styles['InvictusSection']))
        
        totals = data['totals']
        general_summary = [
            ['Métrica', 'Valor'],
            ['Total de Jogadores', str(totals['players_count'])],
            ['Jogadores Lucrativos', f"{totals['profitable_players']} ({totals['profitable_players']/totals['players_count']*100:.1f}%)"],
            ['Contas Ativas', str(totals['active_accounts'])],
            ['Saldo Total do Time', f"$ {totals['total_balance']:,.2f}"],
            ['P&L Total', f"$ {totals['total_pnl']:,.2f}"],
            ['Total de Reloads', f"$ {totals['total_reloads']:,.2f}"],
            ['Total de Saques', f"$ {totals['total_withdrawals']:,.2f}"]
        ]
        
        general_table = Table(general_summary, colWidths=[3*inch, 2.5*inch])
        general_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d4af37')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(general_table)
        story.append(Spacer(1, 20))
        
        # Detalhamento por jogador
        story.append(Paragraph("Detalhamento por Jogador", self.styles['InvictusSection']))
        
        players_data = [['Jogador', 'Reta', 'Saldo Atual', 'P&L', 'Reloads', 'Status']]
        for player_data in data['players']:
            user = player_data['user']
            totals = player_data['totals']
            
            pnl = totals['pnl']
            status = '📈 Lucro' if pnl > 0 else '📉 Prejuízo' if pnl < 0 else '➖ Neutro'
            
            players_data.append([
                user.full_name,
                user.reta.name if user.reta else 'N/A',
                f"$ {totals['current_balance']:,.2f}",
                f"$ {pnl:,.2f}",
                f"$ {totals['reloads']:,.2f}",
                status
            ])
        
        players_table = Table(players_data, colWidths=[1.8*inch, 0.8*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1*inch])
        players_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d4af37')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(players_table)
        
        # Rodapé
        story.append(Spacer(1, 30))
        story.append(Paragraph(f"Relatório gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')}", 
                              self.styles['InvictusNormal']))
        story.append(Paragraph("Invictus Poker Team - Sistema de Gestão", self.styles['InvictusNormal']))
        
        # Gerar PDF
        doc.build(story)
        buffer.seek(0)
        
        reta_suffix = f"_reta_{reta_id}" if reta_id else ""
        filename = f"relatorio_time{reta_suffix}_{start_date.strftime('%Y%m%d')}_a_{end_date.strftime('%Y%m%d')}.pdf"
        return buffer.getvalue(), filename
    
    def _generate_team_csv(self, data: Dict, start_date: datetime, end_date: datetime, reta_id: int = None) -> Tuple[bytes, str]:
        """Gera CSV do relatório do time"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Cabeçalho
        title = "RELATÓRIO CONSOLIDADO DO TIME - INVICTUS POKER TEAM"
        if reta_id:
            reta = Reta.query.get(reta_id)
            title += f" - {reta.name}"
        writer.writerow([title])
        writer.writerow([f"Período: {start_date.strftime('%d/%m/%Y')} a {end_date.strftime('%d/%m/%Y')}"])
        writer.writerow([])
        
        # Resumo geral
        writer.writerow(['RESUMO GERAL'])
        totals = data['totals']
        writer.writerow(['Total de Jogadores', totals['players_count']])
        writer.writerow(['Jogadores Lucrativos', f"{totals['profitable_players']} ({totals['profitable_players']/totals['players_count']*100:.1f}%)"])
        writer.writerow(['Contas Ativas', totals['active_accounts']])
        writer.writerow(['Saldo Total do Time', f"$ {totals['total_balance']:,.2f}"])
        writer.writerow(['P&L Total', f"$ {totals['total_pnl']:,.2f}"])
        writer.writerow(['Total de Reloads', f"$ {totals['total_reloads']:,.2f}"])
        writer.writerow(['Total de Saques', f"$ {totals['total_withdrawals']:,.2f}"])
        writer.writerow([])
        
        # Detalhamento por jogador
        writer.writerow(['DETALHAMENTO POR JOGADOR'])
        writer.writerow(['Jogador', 'Username', 'Reta', 'Saldo Atual', 'P&L', 'Reloads', 'Saques', 'Resultado Líquido'])
        
        for player_data in data['players']:
            user = player_data['user']
            totals = player_data['totals']
            
            writer.writerow([
                user.full_name,
                f"@{user.username}",
                user.reta.name if user.reta else 'N/A',
                f"$ {totals['current_balance']:,.2f}",
                f"$ {totals['pnl']:,.2f}",
                f"$ {totals['reloads']:,.2f}",
                f"$ {totals['withdrawals']:,.2f}",
                f"$ {totals['net_result']:,.2f}"
            ])
        
        output.seek(0)
        content = output.getvalue().encode('utf-8-sig')  # BOM para Excel
        
        reta_suffix = f"_reta_{reta_id}" if reta_id else ""
        filename = f"relatorio_time{reta_suffix}_{start_date.strftime('%Y%m%d')}_a_{end_date.strftime('%Y%m%d')}.csv"
        return content, filename
    
    def _generate_reta_pdf(self, data: Dict, start_date: datetime, end_date: datetime) -> Tuple[bytes, str]:
        """Gera PDF do relatório da reta"""
        return self._generate_team_pdf(data, start_date, end_date, data['reta'].id)
    
    def _generate_reta_csv(self, data: Dict, start_date: datetime, end_date: datetime) -> Tuple[bytes, str]:
        """Gera CSV do relatório da reta"""
        return self._generate_team_csv(data, start_date, end_date, data['reta'].id)
    
    def generate_monthly_detailed_pdf(self, report_data: Dict[str, any]) -> bytes:
        """
        Gera PDF detalhado do relatório mensal
        
        Args:
            report_data: Dados do relatório mensal
            
        Returns:
            bytes: Conteúdo do PDF
        """
        try:
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
            
            # Container de elementos
            elements = []
            
            # Título
            period = report_data['period']
            title = f"RELATÓRIO MENSAL DETALHADO - {period['month_name'].upper()}"
            elements.append(Paragraph(title, self.styles['InvictusTitle']))
            elements.append(Spacer(1, 20))
            
            # Resumo Financeiro
            financial = report_data['financial_summary']
            elements.append(Paragraph("📊 RESUMO FINANCEIRO", self.styles['InvictusSubtitle']))
            
            financial_data = [
                ['Métrica', 'Valor'],
                ['💰 Total Reloads', self._format_currency(financial['total_reloads'])],
                ['💸 Total Saques', self._format_currency(financial['total_withdrawals'])],
                ['🏦 Total Investimento', self._format_currency(financial['total_team_investment'])],
                ['📈 Total Retirado pelo Time', self._format_currency(financial['total_team_withdrawals'])],
                ['📉 Total Retirado pelos Jogadores', self._format_currency(financial['total_player_withdrawals'])],
                ['🎯 Lucro Líquido do Time', self._format_currency(financial['team_net_result'])],
            ]
            
            financial_table = Table(financial_data, colWidths=[3*inch, 2*inch])
            financial_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#B8860B')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            elements.append(financial_table)
            elements.append(Spacer(1, 20))
            
            # Jogadores Lucrativos
            if report_data.get('profitable_players'):
                elements.append(Paragraph("🏆 JOGADORES LUCRATIVOS", self.styles['InvictusSubtitle']))
                
                profitable_data = [['Jogador', 'P&L']]
                for player in report_data['profitable_players'][:10]:  # Top 10
                    profitable_data.append([
                        player['name'],
                        self._format_currency(player['pnl'])
                    ])
                
                profitable_table = Table(profitable_data, colWidths=[3*inch, 2*inch])
                profitable_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#228B22')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                elements.append(profitable_table)
                elements.append(Spacer(1, 20))
            
            # Saldos por Plataforma
            if report_data.get('platform_balances'):
                elements.append(Paragraph("🏦 SALDOS POR PLATAFORMA", self.styles['InvictusSubtitle']))
                
                platform_data = [['Plataforma', 'Saldo Atual', 'Investido', 'P&L']]
                for platform, data in report_data['platform_balances'].items():
                    platform_data.append([
                        platform,
                        self._format_currency(data['balance']),
                        self._format_currency(data['investment']),
                        self._format_currency(data['pnl'])
                    ])
                
                platform_table = Table(platform_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
                platform_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4169E1')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightblue),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                elements.append(platform_table)
                elements.append(Spacer(1, 20))
            
            # Estatísticas
            if report_data.get('statistics'):
                stats = report_data['statistics']
                elements.append(Paragraph("📊 ESTATÍSTICAS", self.styles['InvictusSubtitle']))
                
                stats_data = [
                    ['Estatística', 'Valor'],
                    ['👥 Total de Jogadores', str(stats['total_players'])],
                    ['🏆 Jogadores Lucrativos', f"{stats['profitable_players_count']} ({stats['profitable_players_percentage']:.1f}%)"],
                    ['🏦 Plataformas Ativas', str(stats['active_platforms'])],
                    ['📈 P&L Médio por Jogador', self._format_currency(stats['avg_player_pnl'])],
                ]
                
                stats_table = Table(stats_data, colWidths=[3*inch, 2*inch])
                stats_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#666666')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                
                elements.append(stats_table)
            
            # Rodapé
            elements.append(Spacer(1, 30))
            footer_text = f"Relatório gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')} | Invictus Poker Team"
            footer_style = ParagraphStyle('FooterStyle', fontSize=8, textColor=colors.grey, alignment=1)
            elements.append(Paragraph(footer_text, footer_style))
            
            # Construir PDF
            doc.build(elements)
            
            # Retornar bytes
            buffer.seek(0)
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Erro ao gerar PDF mensal detalhado: {str(e)}")
            raise

    def _format_currency(self, value):
        """Formata valor como moeda USD"""
        try:
            return f"${float(value):,.2f}"
        except (ValueError, TypeError):
            return "$0.00"

    def generate_audit_logs_pdf(self, audit_data: Dict[str, any]) -> bytes:
        """
        Gera PDF dos logs de auditoria
        
        Args:
            audit_data: Dados dos logs de auditoria
            
        Returns:
            bytes: Conteúdo do PDF
        """
        try:
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
            
            # Container de elementos
            elements = []
            
            # Título
            period = audit_data['period']
            title = f"LOGS DE AUDITORIA - {period['start_date']} a {period['end_date']}"
            elements.append(Paragraph(title, self.styles['InvictusTitle']))
            elements.append(Spacer(1, 20))
            
            # Resumo
            stats = audit_data['stats']
            elements.append(Paragraph("📊 RESUMO", self.styles['InvictusSubtitle']))
            
            stats_data = [
                ['Período', f"{period['days_back']} dias"],
                ['Total de Logs', str(stats['total_logs'])],
                ['Data de Geração', period['end_date']],
            ]
            
            stats_table = Table(stats_data, colWidths=[2*inch, 3*inch])
            stats_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#B8860B')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            elements.append(stats_table)
            elements.append(Spacer(1, 20))
            
            # Logs de Auditoria (máximo 50 para não sobrecarregar)
            if audit_data.get('logs'):
                elements.append(Paragraph("📋 LOGS DE AUDITORIA", self.styles['InvictusSubtitle']))
                
                logs_data = [['Data/Hora', 'Usuário', 'Ação', 'Entidade', 'IP']]
                for log in audit_data['logs'][:50]:  # Máximo 50 logs
                    logs_data.append([
                        log['created_at'],
                        log['user_name'][:20] + '...' if len(log['user_name']) > 20 else log['user_name'],
                        log['action_name'][:15] + '...' if len(log['action_name']) > 15 else log['action_name'],
                        log['entity_type'],
                        log['ip_address'][:12] + '...' if len(log['ip_address']) > 12 else log['ip_address']
                    ])
                
                logs_table = Table(logs_data, colWidths=[1.2*inch, 1.5*inch, 1.2*inch, 1*inch, 1.1*inch])
                logs_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4169E1')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightblue),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('FONTSIZE', (0, 1), (-1, -1), 7),  # Fonte menor para dados
                ]))
                
                elements.append(logs_table)
                
                if len(audit_data['logs']) > 50:
                    elements.append(Spacer(1, 10))
                    note = f"Nota: Mostrando os primeiros 50 logs de {len(audit_data['logs'])} total. Para ver todos, use o filtro na interface."
                    note_style = ParagraphStyle('NoteStyle', fontSize=8, textColor=colors.grey, alignment=1)
                    elements.append(Paragraph(note, note_style))
            
            # Rodapé
            elements.append(Spacer(1, 30))
            footer_text = f"Relatório de auditoria gerado em {datetime.now().strftime('%d/%m/%Y às %H:%M')} | Invictus Poker Team"
            footer_style = ParagraphStyle('FooterStyle', fontSize=8, textColor=colors.grey, alignment=1)
            elements.append(Paragraph(footer_text, footer_style))
            
            # Construir PDF
            doc.build(elements)
            
            # Retornar bytes
            buffer.seek(0)
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Erro ao gerar PDF de auditoria: {str(e)}")
            raise


# Instância global do gerador
report_generator = ReportGenerator()

def get_report_generator() -> ReportGenerator:
    """Retorna a instância global do gerador de relatórios"""
    return report_generator

