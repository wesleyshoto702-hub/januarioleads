# Januário Leads — ampliação do Buscar Leads de 196 para 216 nichos

**Data:** 15/11/2026. **Escopo:** código GitHub (catálogo compartilhado / busca Overture / Geoapify), sem tocar no banco, na Colab, em projetos de produção ou em provedores de APIs.

## Etapa 1 — 20 nichos novos

Foram adicionadas **20 opções novas** ao catálogo canônico de 16 grupos, passando de **196 para 216**:

| Grupo | Novos nichos |
|---|---|
| Alimentação | Bar / Pub; Mercado / Supermercado; Restaurante Japonês |
| Serviços residenciais | Provedor de Internet |
| Automotivo | Autopeças; Posto de Combustível; Revenda de Motos |
| Serviços profissionais | Funerária |
| Comércio | Livraria; Loja de Artigos Esportivos; Loja de Artigos para Festas; Loja de Brinquedos; Loja de Celulares; Loja de Cosméticos; Loja de Conveniência; Loja de Departamentos; Loja de Eletrônicos; Loja de Eletrodomésticos; Loja de Lingerie; Loja de Utilidades Domésticas |

Os vinte itens têm correspondência por categoria **exata** no Overture, observada na base de homologação. Os 216 nichos recebem linha correspondente em `niche-coverage.ts` (estratégia comercial) e `geoapify-niche-categories.ts` (decisão explícita `null` quando uma categoria Geoapify suficientemente precisa não foi verificada). Os sete rótulos compostos receberam termos de busca naturais para os provedores complementares.

### Dados consultados

Na pesquisa que fundamentou a mudança, os 20 grupos somavam aproximadamente **33 mil registros com algum contato** (telefone, e-mail, site ou Instagram) na tabela Overture da homologação; as contagens mudam conforme a importação avança. Isso **não** valida manualmente contatos nem prova que as empresas tenham interesse comercial. As categorias do Overture não equivalem, sozinhas, a um cadastro de CNAEs ou a um banco oficial de CNPJs.

## Etapa 2 — aprimorar 37 nichos já existentes

Ampliação de **37 nichos já visíveis** por **46 correspondências adicionais** de categorias presentes na homologação, preservando as correspondências existentes:

- Saúde e beleza: Banho e Tosa → `pet_groomer`; Loja de Suplementos → `vitamin_and_supplement_store`; Clínica Odontológica → `orthodontics` e `cosmetic_dentistry`; Nutricionista → `nutrition_service`; Psicólogo / Terapeuta → `psychotherapy` e `psychology`; Dermatologista → `dermatology`; Clínica de Estética → `medical_spa`
- Automotivo e construção: Vidraçaria → `glass_and_mirror_sales_service`; Energia Solar → `solar_installation`; Marmoraria → `granite_supplier`; Loja de Veículos Seminovos → `used_auto_dealer` (mantendo `used_car_dealer`); Funilaria → `auto_body_shop`; Refrigeração / Ar Condicionado → `hvac_service`; Piscineiro → `pool_cleaning`; Acessórios Automotivos → `car_stereo_store`; Loja de Materiais de Construção → `lumber_store`
- Comércio e alimentação: Loja de Produtos Naturais → `health_food_store`; Loja de Bicicletas → `bike_store`; Loja de Colchões → `mattress_store`; Papelaria / Artesanato → `office_supply_store` e `arts_crafts_and_hobby_store`; Confeitaria → `chocolatier`; Empório → `specialty_foods_store`; Restaurante → `italian_restaurant`, `seafood_restaurant`, `bar_and_grill_restaurant`, `diner` e `buffet_restaurant`
- Serviços e educação: Escola de Dança → `dance_studio`; Corretor de Seguros → `insurance_agency`; Marketing Digital → `marketing_agency` e `internet_marketing_service`; Desenvolvimento de Software → `software_development`; Empresa de Uniformes → `uniform_store`; Personal Trainer → `fitness_trainer`; Fotografia de Eventos → `event_photography_service`; Agência de Publicidade → `advertising_agency` e `b2b_advertising_and_marketing_service`; Costureira / Ateliê → `sewing_and_alterations`; Academia de Artes Marciais → `martial_arts_club`; Transportadora → `freight_and_cargo_service`; Empresa de Limpeza Residencial → `home_cleaning`; Segurança Eletrônica / Alarmes → `home_security`; Escola de Informática → `computer_coaching`

A função `categoriesForOverture` une `OVERTURE_CATEGORIES` + `OVERTURE_CATEGORY_EXPANSIONS`, removendo duplicatas por `Set`, sem mudar IDs ou rótulos. Categorias ambíguas como `school`, `professional_service`, `shopping` e `food_and_drink` foram **intencionalmente excluídas** dos novos mapeamentos, para evitar resultados falsos.

## Integração, custo e publicação

- O seletor web importa diretamente `SEGMENT_GROUPS`, portanto as 20 novas opções passam a existir no **código** sem editar o componente.
- A Edge Function `search-places` usa o mesmo catálogo e `categoriesForOverture`, pesquisando primeiro a base de homologação. Sem resultados suficientes, os provedores complementares existentes permanecem sujeitos a suas verificações de credenciais, permissões e orçamento. **Não houve consumo de APIs pagas nestas alterações.**
- Os dados Overture permanecem associados à fonte Overture. Não mesclar campos de provedores sem respeitar as licenças.
- **Nenhuma função Supabase foi publicada automaticamente por esta alteração de código.** Para aparecer no serviço ativo, a versão correspondente da Edge Function e o frontend precisam ser implantados nos ambientes pretendidos após homologação. Não publicar na produção sem validação específica.
- A Colab V5, os índices, o banco, a autenticação, os registros existentes e as políticas RLS não foram modificados.

## Testes

- `supabase/functions/_shared/niche-catalog.test.ts`: 216 nichos únicos, 20 novos pesquisáveis e estratégia comercial associada.
- `supabase/functions/_shared/geoapify-search.test.ts` + `geoapify-niche-categories.ts`: decisões de fallback para todos os 216 rótulos.
- `supabase/functions/_shared/overture-search.test.ts`: todas as novas categorias de Overture e as 37 expansões, preservação de `used_car_dealer`, recusa de categorias amplas.
- `.github/workflows/validar-busca-hibrida-staging.yml`: `deno check`, testes sem rede e asserções de orçamento/atribuição. Não implanta Edge Function.

**Nota operacional:** o workflow geral `niche-catalog-check.yml` possui também verificações de reconciliação de migrations e testes de navegador independentes desta alteração; seu resultado não equivale ao teste específico da busca.
