# Dashboard do Gestor (Admin)

## Design
- Layout minimalista e elegante.
- Tema: Preto e dourado (tons ouro metálico).
- Tipografia limpa e sofisticada.

## Elementos
- Cabeçalho com logo do Invictus Poker Team e nome do gestor.
- Menu de navegação lateral ou superior (opções: Jogadores, Relatórios, Configurações).
- Área principal com a lista de todos os jogadores.
- Para cada jogador na lista:
    - Nome do jogador.
    - Status visual (verde = completo, amarelo = pendente, vermelho = crítico).
    - Ícone com tooltip explicando a pendência ao passar o mouse.
    - Botão/link para acessar o perfil individual do jogador.
- Filtros:
    - Por status (Completo, Pendente, Crítico).
    - Por nome (campo de busca).
    - Por data de atualização.
- Contadores ou resumos visuais de pendências gerais.

## Comportamento
- A lista de jogadores deve ser atualizada em tempo real.
- Cliques nos filtros devem atualizar a lista dinamicamente.
- Ao clicar no nome do jogador ou no botão de acesso ao perfil, o gestor é redirecionado para a tela de perfil do jogador.

