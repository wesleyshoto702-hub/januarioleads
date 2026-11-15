# Buscar Leads — cobertura Overture, etapa 3 (15/11/2026)

## Escopo e segurança
Auditoria **somente de leitura** no Supabase HOMOLOGAÇÃO `prlrxjothrslhswpkoza`; nenhum dado, migração, importador Colab, configuração de provedor ou produção alterado. As contagens abaixo são um retrato enquanto a importação Fase 9 V5 continua e podem variar.

## Resultado
- Catálogo canônico: **216 nichos**.
- Antes: **125** nichos com mapeamento Overture, **91** sem mapeamento.
- Agora: **140** nichos mapeados, **76** sem mapeamento.
- **15 nichos novos** com correspondência específica. O nicho **Chaveiro** ganha uma segunda categoria exata.
- Confirmação calculada diretamente a partir dos rótulos do catálogo e dos dois objetos de mapeamento do código. Isso **não garante** existência de resultado em todo município ou contato validado.

## Novos mapeamentos comprovados pela consulta SQL ao staging
| Nicho | Categoria exata Overture | Registros no recorte consultado |
| --- | --- | ---: |
| Acupuntura | `acupuncture` | 19 |
| Adega | `liquor_store` | 481 |
| Cartório / Serviços Notariais | `notary_public` | 268 |
| Consultoria Empresarial | `business_consulting` | 1 |
| Curso Profissionalizante | `vocational_and_technical_school` | 230 |
| Dedetizadora | `pest_control_service` | 44 |
| Encanador | `plumbing` | 6 |
| Fonoaudiólogo | `speech_therapy` | 29 |
| Guincho | `towing_service` | 59 |
| Hotel para Pets | `pet_boarding` | 5 |
| Jardinagem / Paisagismo | `landscaping`, `gardener` | 68 + 13 |
| Maquiagem Profissional | `makeup_artist` | 276 |
| Podólogo | `podiatry` | 50 |
| Psiquiatra | `psychiatry` | 11 |
| Terapeuta Ocupacional | `occupational_therapy` | 10 |
| Chaveiro (já mapeado) | `key_and_locksmith` | 134 |

Contagens de empresas podem incluir dados sem contato comercial ou que não sejam apropriados à prospecção. Categoria exata não valida identidade, situação cadastral nem titularidade de telefone/Instagram.

## Categorias deliberadamente recusadas
- `professional_service`: não comprova consultoria específica.
- `school`: não comprova curso profissionalizante.
- `nursery_and_gardening_store`: é loja, não necessariamente prestador de jardinagem.
- `animal_or_pet_service`: não comprova hospedagem de animais.
- `automotive_service`: não comprova guincho.
- `home_cleaning`: não comprova dedetização.
- `party_and_event_planning`: não comprova assessoria de casamento.

## Validação e pendências
- Teste Deno adicionado exigindo 216 nichos, 140 mapeados, cada categoria concreta e a exclusão de classes amplas.
- **CI não executado/confirmado nesta alteração.** Revisar desempenho da busca em staging antes de mesclar e implantar.
- A PR independente #146 muda a paginação e deve ser integrada/testada separadamente para evitar conflito de alterações na mesma área.
- Sem mudanças nas políticas de orçamento: Geoapify e Google permanecem sujeitos aos guardas existentes.
