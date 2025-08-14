# Tela de Aprovação de Reload (Gestor)

## Design
- Layout minimalista e elegante, seguindo o tema preto e dourado.

## Elementos
- Título: "Aprovações de Reload Pendentes".
- Lista de solicitações de reload pendentes:
    - Para cada solicitação:
        - Nome do jogador.
        - Plataforma.
        - Valor solicitado.
        - Data e hora da solicitação.
        - Campo para observações do gestor.
        - Botão "Aprovar" (verde).
        - Botão "Rejeitar" (vermelho).
- Filtros para solicitações (por jogador, por plataforma, por data).

## Comportamento
- A lista de solicitações é atualizada em tempo real.
- Ao clicar em "Aprovar" ou "Rejeitar", a solicitação é processada e removida da lista de pendentes.
- Notificação para o jogador sobre o status da sua solicitação.

