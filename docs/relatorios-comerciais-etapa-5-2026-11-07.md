# Relatórios comerciais — etapa 5/5

## Escopo

Relatórios internos ao **Dashboard**, alimentados exclusivamente pelos leads já salvos na conta e pelos pagamentos já registrados no CRM. Não há consultas novas ao Google Places.

## Períodos

- **30 dias**: data atual brasileira e 29 dias anteriores, inclusivos.
- **90 dias**: data atual brasileira e 89 dias anteriores, inclusivos.
- **Tudo**: todo o histórico disponível até a data de hoje.
- Registros com datas inválidas ou no futuro não entram nas contagens.

## Métricas e interpretações

- **Leads cadastrados**: empresas criadas no período escolhido (pela data de criação).
- **Em acompanhamento**: entre esses leads, os que hoje estão como Aguardando, Aceito ou Recusado.
- **Aceitos**: quantos leads da mesma coorte têm status atual Aceito.
- **Taxa de aceite indicativa**: Aceitos ÷ (Aguardando + Aceitos + Recusados), com base nos *status atuais*. Não equivale à taxa histórica de conversão nem à quantidade de vendas fechadas.
- **Recebimentos**: somatório dos pagamentos com data dentro do período. Esse recorte é **independente da data de criação dos leads**.
- **Por segmento e cidade**: seis maiores grupos de leads cadastrados no período, com a quantidade e os status Aceito atuais.
- **Distribuição de status**: contagem da situação atual dos leads cadastrados no período.

## Limitações deliberadas

A plataforma não presume confirmação de envio pelo WhatsApp, taxas de resposta, propostas emitidas nem atribuição financeira a canais. Não há histórico temporal de funil reconstruído a partir de status atuais. Se o carregamento financeiro falhar, o painel não exibe recebimento zero falsamente; mostra indisponibilidade.

## Segurança e experiência

As métricas vêm do workspace privado autorizado, respeitando o isolamento já existente no backend. Não há exportação, compartilhamento ou cache adicional de dados de terceiros. As barras são implementadas com CSS e acessibilidade sem bibliotecas gráficas novas.

## Evoluções futuras

Analisar taxas de resposta, vendas fechadas e tempos entre etapas somente quando houver eventos próprios explicitamente confirmados pelo usuário e persistidos com carimbos de data.