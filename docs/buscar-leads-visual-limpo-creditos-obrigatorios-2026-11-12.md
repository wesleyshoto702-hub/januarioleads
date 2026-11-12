# Buscar Leads — apresentação limpa com atribuição obrigatória

## Pedido
Retirar dos resultados visíveis as faixas grandes com "Google Maps",
"Geoapify" e a taxonomia técnica como `commercial.health_and_beauty`,
sem modificar a busca híbrida, os 196 nichos ou os leads existentes.

## Resultado
- Nos cartões de Busca, o nome e a **categoria escolhida pelo usuário**
  aparecem juntos. Código de categoria de APIs externas não aparece.
- Removida a faixa de atribuição entre o nome e a categoria; removido
  o botão/link repetido "Google Maps" da presença online e do modal.
- O modal mostra o segmento em português no cabeçalho e deixa de listar
  códigos de classificação dos provedores em "Categorias relacionadas".
- As descrições automáticas não mencionam serviços externos nem
  imprimem taxonomias; descrições antigas que mencionam nomes de
  fornecedores são reconstruídas **somente para exibição**, sem editar
  registros persistidos.
- Novos leads não recebem nomes de fornecedores nem links de mapas
  nas observações automáticas. A identificação de origem permanece no
  registro técnico de atividade para auditoria.
- Avisos e erros de busca usam mensagens funcionais neutras.
- A solução vale para **todos os 196 nichos**, incluindo Farmácia,
  Academia, Barbearia, Chaveiro, etc. Não muda os nichos disponíveis.

## Atribuição legal não removível
Os provedores têm termos de atribuição que a plataforma precisa cumprir:
- Google Places sem um Google Map exige atribuição Google Maps junto ao
  conteúdo (texto legível é aceitável quando há pouco espaço).
- Geoapify exige **© OpenStreetMap contributors** e seu plano Free
  exige também **Powered by Geoapify**.

Essas indicações continuam, com fonte pequena e legível **no rodapé
de cada cartão de resultado e no final dos detalhes de empresas**.
Eliminá-las completamente enquanto se exibem os dados seria
incompatível com os termos dos serviços. Não usar `display:none`,
opacidade zero, texto inacessível ou esconder em popovers.

## Sem alterações de negócio
- Nenhum sistema de pontos;
- Nenhum retorno do Buscar via Maps;
- Nenhuma alteração em autenticação, CRM, conta, estado, limites ou preço;
- Geoapify continua sendo consultado primeiro quando houver categoria
  compatível e Google continua complementando as buscas.
- Os campos de proveniência são mantidos internamente, não misturados
  entre provedores.

## Verificação
- Os templates não mostram mais rótulos técnicos junto ao nome do lead.
- Os testes `business-description.test.ts` cobrem descrições sem
  marcas e sem códigos de categoria, inclusive registros legados.
- Testes completos do navegador/build e revisão da prévia ainda
  pendentes em ambiente com o projeto instalado.
