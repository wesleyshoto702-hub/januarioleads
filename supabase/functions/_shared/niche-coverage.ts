// Shared niche-family coverage for Open Now and commercial page strategies.
// The canonical segment list lives in niche-catalog.ts.
export type NicheFamily =
  | "generic_local_business"
  | "food"
  | "beauty"
  | "health"
  | "home_services"
  | "automotive"
  | "fitness"
  | "education"
  | "events"
  | "professional_services"
  | "retail"
  | "pets"
  | "logistics"
  | "creative";

export const CURRENT_NICHE_COVERAGE = [
  {
    "segment": "Açaiteria",
    "nicheKey": "acai_shop",
    "family": "food"
  },
  {
    "segment": "Açougue",
    "nicheKey": "butcher_shop",
    "family": "retail"
  },
  {
    "segment": "Adega",
    "nicheKey": "beverage_store",
    "family": "retail"
  },
  {
    "segment": "Buffet",
    "nicheKey": "buffet",
    "family": "events"
  },
  {
    "segment": "Buffet Infantil",
    "nicheKey": "children_buffet",
    "family": "events"
  },
  {
    "segment": "Cafeteria",
    "nicheKey": "cafe",
    "family": "food"
  },
  {
    "segment": "Confeitaria",
    "nicheKey": "confectionery",
    "family": "food"
  },
  {
    "segment": "Doceria",
    "nicheKey": "dessert_shop",
    "family": "food"
  },
  {
    "segment": "Empório",
    "nicheKey": "specialty_grocery",
    "family": "retail"
  },
  {
    "segment": "Hamburgueria",
    "nicheKey": "hamburger",
    "family": "food"
  },
  {
    "segment": "Hortifruti",
    "nicheKey": "produce_market",
    "family": "retail"
  },
  {
    "segment": "Marmitaria",
    "nicheKey": "meal_shop",
    "family": "food"
  },
  {
    "segment": "Padaria",
    "nicheKey": "bakery",
    "family": "food"
  },
  {
    "segment": "Peixaria",
    "nicheKey": "fish_market",
    "family": "retail"
  },
  {
    "segment": "Pizzaria",
    "nicheKey": "pizzeria",
    "family": "food"
  },
  {
    "segment": "Restaurante",
    "nicheKey": "restaurant",
    "family": "food"
  },
  {
    "segment": "Restaurante Fine Dining",
    "nicheKey": "fine_dining",
    "family": "food"
  },
  {
    "segment": "Sorveteria",
    "nicheKey": "ice_cream_shop",
    "family": "food"
  },
  {
    "segment": "Barbearia",
    "nicheKey": "barbershop",
    "family": "beauty"
  },
  {
    "segment": "Bronzeamento",
    "nicheKey": "bronzeamento",
    "family": "beauty"
  },
  {
    "segment": "Clínica Capilar",
    "nicheKey": "clinica_capilar",
    "family": "beauty"
  },
  {
    "segment": "Clínica de Estética",
    "nicheKey": "aesthetic_clinic",
    "family": "beauty"
  },
  {
    "segment": "Depilação a Laser",
    "nicheKey": "depilacao_a_laser",
    "family": "beauty"
  },
  {
    "segment": "Design de Sobrancelhas",
    "nicheKey": "eyebrow_design",
    "family": "beauty"
  },
  {
    "segment": "Estética / Depilação",
    "nicheKey": "beauty_aesthetics",
    "family": "beauty"
  },
  {
    "segment": "Estúdio de Piercing",
    "nicheKey": "piercing",
    "family": "creative"
  },
  {
    "segment": "Estúdio de Tatuagem",
    "nicheKey": "tattoo",
    "family": "creative"
  },
  {
    "segment": "Manicure",
    "nicheKey": "manicure",
    "family": "beauty"
  },
  {
    "segment": "Maquiagem Profissional",
    "nicheKey": "maquiagem_profissional",
    "family": "beauty"
  },
  {
    "segment": "Micropigmentação",
    "nicheKey": "micropigmentacao",
    "family": "beauty"
  },
  {
    "segment": "Salão de Beleza",
    "nicheKey": "beauty_salon",
    "family": "beauty"
  },
  {
    "segment": "Spa",
    "nicheKey": "spa",
    "family": "beauty"
  },
  {
    "segment": "Acupuntura",
    "nicheKey": "acupuncture",
    "family": "health"
  },
  {
    "segment": "Cardiologista",
    "nicheKey": "cardiologista",
    "family": "health"
  },
  {
    "segment": "Clínica de Exames",
    "nicheKey": "clinica_de_exames",
    "family": "health"
  },
  {
    "segment": "Clínica de Imagem",
    "nicheKey": "clinica_de_imagem",
    "family": "health"
  },
  {
    "segment": "Clínica de Pilates",
    "nicheKey": "clinica_de_pilates",
    "family": "health"
  },
  {
    "segment": "Clínica Médica",
    "nicheKey": "clinica_medica",
    "family": "health"
  },
  {
    "segment": "Clínica Odontológica",
    "nicheKey": "dentist",
    "family": "health"
  },
  {
    "segment": "Dermatologista",
    "nicheKey": "dermatologista",
    "family": "health"
  },
  {
    "segment": "Farmácia",
    "nicheKey": "pharmacy",
    "family": "retail"
  },
  {
    "segment": "Fisioterapeuta",
    "nicheKey": "physiotherapy",
    "family": "health"
  },
  {
    "segment": "Fonoaudiólogo",
    "nicheKey": "speech_therapy",
    "family": "health"
  },
  {
    "segment": "Ginecologista",
    "nicheKey": "ginecologista",
    "family": "health"
  },
  {
    "segment": "Home Care / Cuidados Domiciliares",
    "nicheKey": "home_care_cuidados_domiciliares",
    "family": "health"
  },
  {
    "segment": "Laboratório de Análises Clínicas",
    "nicheKey": "laboratorio_de_analises_clinicas",
    "family": "health"
  },
  {
    "segment": "Massoterapeuta",
    "nicheKey": "massage_therapy",
    "family": "health"
  },
  {
    "segment": "Nutricionista",
    "nicheKey": "nutritionist",
    "family": "health"
  },
  {
    "segment": "Ortopedista",
    "nicheKey": "ortopedista",
    "family": "health"
  },
  {
    "segment": "Ótica",
    "nicheKey": "optical_store",
    "family": "retail"
  },
  {
    "segment": "Pediatra",
    "nicheKey": "pediatra",
    "family": "health"
  },
  {
    "segment": "Podólogo",
    "nicheKey": "podiatry",
    "family": "health"
  },
  {
    "segment": "Psicólogo / Terapeuta",
    "nicheKey": "psychology",
    "family": "health"
  },
  {
    "segment": "Psiquiatra",
    "nicheKey": "psiquiatra",
    "family": "health"
  },
  {
    "segment": "Terapeuta Ocupacional",
    "nicheKey": "occupational_therapy",
    "family": "health"
  },
  {
    "segment": "Chaveiro",
    "nicheKey": "locksmith",
    "family": "home_services"
  },
  {
    "segment": "Dedetizadora",
    "nicheKey": "pest_control",
    "family": "home_services"
  },
  {
    "segment": "Desentupidora",
    "nicheKey": "desentupidora",
    "family": "home_services"
  },
  {
    "segment": "Eletricista",
    "nicheKey": "electrician",
    "family": "home_services"
  },
  {
    "segment": "Empresa de Limpeza Residencial",
    "nicheKey": "empresa_de_limpeza_residencial",
    "family": "home_services"
  },
  {
    "segment": "Encanador",
    "nicheKey": "plumber",
    "family": "home_services"
  },
  {
    "segment": "Instalação de Portões Automáticos",
    "nicheKey": "instalacao_de_portoes_automaticos",
    "family": "home_services"
  },
  {
    "segment": "Jardinagem / Paisagismo",
    "nicheKey": "landscaping",
    "family": "home_services"
  },
  {
    "segment": "Lavanderia",
    "nicheKey": "laundry",
    "family": "home_services"
  },
  {
    "segment": "Limpeza de Caixa-d'Água",
    "nicheKey": "limpeza_de_caixa_d_agua",
    "family": "home_services"
  },
  {
    "segment": "Marcenaria",
    "nicheKey": "carpentry",
    "family": "home_services"
  },
  {
    "segment": "Montador de Móveis",
    "nicheKey": "montador_de_moveis",
    "family": "home_services"
  },
  {
    "segment": "Personal Organizer",
    "nicheKey": "personal_organizer",
    "family": "home_services"
  },
  {
    "segment": "Pintor",
    "nicheKey": "painter",
    "family": "home_services"
  },
  {
    "segment": "Piscineiro",
    "nicheKey": "pool_service",
    "family": "home_services"
  },
  {
    "segment": "Refrigeração / Ar Condicionado",
    "nicheKey": "hvac",
    "family": "home_services"
  },
  {
    "segment": "Segurança Eletrônica / Alarmes",
    "nicheKey": "security_systems",
    "family": "home_services"
  },
  {
    "segment": "Serralheria",
    "nicheKey": "metalwork",
    "family": "home_services"
  },
  {
    "segment": "Vidraçaria",
    "nicheKey": "glasswork",
    "family": "home_services"
  },
  {
    "segment": "Arquiteto / Escritório de Arquitetura",
    "nicheKey": "arquiteto_escritorio_de_arquitetura",
    "family": "home_services"
  },
  {
    "segment": "Construtora",
    "nicheKey": "construtora",
    "family": "home_services"
  },
  {
    "segment": "Empreiteira",
    "nicheKey": "empreiteira",
    "family": "home_services"
  },
  {
    "segment": "Empresa de Construção de Piscinas",
    "nicheKey": "empresa_de_construcao_de_piscinas",
    "family": "home_services"
  },
  {
    "segment": "Energia Solar",
    "nicheKey": "solar_installer",
    "family": "home_services"
  },
  {
    "segment": "Engenharia Civil",
    "nicheKey": "engenharia_civil",
    "family": "home_services"
  },
  {
    "segment": "Esquadrias de Alumínio",
    "nicheKey": "esquadrias_de_aluminio",
    "family": "home_services"
  },
  {
    "segment": "Gesso / Drywall",
    "nicheKey": "gesso_drywall",
    "family": "home_services"
  },
  {
    "segment": "Impermeabilização",
    "nicheKey": "impermeabilizacao",
    "family": "home_services"
  },
  {
    "segment": "Loja de Tintas",
    "nicheKey": "loja_de_tintas",
    "family": "retail"
  },
  {
    "segment": "Marmoraria",
    "nicheKey": "marmoraria",
    "family": "home_services"
  },
  {
    "segment": "Reformas Residenciais",
    "nicheKey": "reformas_residenciais",
    "family": "home_services"
  },
  {
    "segment": "Estofaria",
    "nicheKey": "estofaria",
    "family": "home_services"
  },
  {
    "segment": "Loja de Colchões",
    "nicheKey": "loja_de_colchoes",
    "family": "retail"
  },
  {
    "segment": "Loja de Cortinas",
    "nicheKey": "loja_de_cortinas",
    "family": "retail"
  },
  {
    "segment": "Loja de Iluminação",
    "nicheKey": "loja_de_iluminacao",
    "family": "retail"
  },
  {
    "segment": "Loja de Persianas",
    "nicheKey": "loja_de_persianas",
    "family": "retail"
  },
  {
    "segment": "Móveis Planejados",
    "nicheKey": "moveis_planejados",
    "family": "home_services"
  },
  {
    "segment": "Tapeçaria",
    "nicheKey": "tapecaria",
    "family": "home_services"
  },
  {
    "segment": "Acessórios Automotivos",
    "nicheKey": "acessorios_automotivos",
    "family": "retail"
  },
  {
    "segment": "Auto Elétrica",
    "nicheKey": "auto_electric",
    "family": "automotive"
  },
  {
    "segment": "Estacionamento",
    "nicheKey": "parking",
    "family": "automotive"
  },
  {
    "segment": "Estética Automotiva",
    "nicheKey": "estetica_automotiva",
    "family": "automotive"
  },
  {
    "segment": "Funilaria",
    "nicheKey": "body_shop",
    "family": "automotive"
  },
  {
    "segment": "Guincho",
    "nicheKey": "tow_service",
    "family": "automotive"
  },
  {
    "segment": "Lava-Rápido",
    "nicheKey": "car_wash",
    "family": "automotive"
  },
  {
    "segment": "Locadora de Veículos",
    "nicheKey": "car_rental",
    "family": "automotive"
  },
  {
    "segment": "Loja de Pneus",
    "nicheKey": "loja_de_pneus",
    "family": "retail"
  },
  {
    "segment": "Loja de Veículos Seminovos",
    "nicheKey": "loja_de_veiculos_seminovos",
    "family": "retail"
  },
  {
    "segment": "Mecânica Automotiva",
    "nicheKey": "mechanic",
    "family": "automotive"
  },
  {
    "segment": "Oficina de Motos",
    "nicheKey": "oficina_de_motos",
    "family": "automotive"
  },
  {
    "segment": "Vistoria Veicular",
    "nicheKey": "vistoria_veicular",
    "family": "automotive"
  },
  {
    "segment": "Academia",
    "nicheKey": "gym",
    "family": "fitness"
  },
  {
    "segment": "Academia de Artes Marciais",
    "nicheKey": "martial_arts_gym",
    "family": "fitness"
  },
  {
    "segment": "Autoescola",
    "nicheKey": "driving_school",
    "family": "education"
  },
  {
    "segment": "Berçário / Creche",
    "nicheKey": "daycare",
    "family": "education"
  },
  {
    "segment": "Curso Preparatório para Concursos",
    "nicheKey": "curso_preparatorio_para_concursos",
    "family": "education"
  },
  {
    "segment": "Curso Profissionalizante",
    "nicheKey": "curso_profissionalizante",
    "family": "education"
  },
  {
    "segment": "Escola de Dança",
    "nicheKey": "dance_school",
    "family": "education"
  },
  {
    "segment": "Escola de Futebol",
    "nicheKey": "escola_de_futebol",
    "family": "fitness"
  },
  {
    "segment": "Escola de Idiomas",
    "nicheKey": "language_school",
    "family": "education"
  },
  {
    "segment": "Escola de Informática",
    "nicheKey": "escola_de_informatica",
    "family": "education"
  },
  {
    "segment": "Escola de Música",
    "nicheKey": "music_school",
    "family": "education"
  },
  {
    "segment": "Escola de Natação",
    "nicheKey": "swim_school",
    "family": "fitness"
  },
  {
    "segment": "Escola de Robótica",
    "nicheKey": "escola_de_robotica",
    "family": "education"
  },
  {
    "segment": "Escola Infantil",
    "nicheKey": "preschool",
    "family": "education"
  },
  {
    "segment": "Personal Trainer",
    "nicheKey": "personal_trainer",
    "family": "fitness"
  },
  {
    "segment": "Reforço Escolar",
    "nicheKey": "tutoring",
    "family": "education"
  },
  {
    "segment": "Aluguel de Brinquedos para Festas",
    "nicheKey": "aluguel_de_brinquedos_para_festas",
    "family": "events"
  },
  {
    "segment": "Assessoria de Casamentos",
    "nicheKey": "assessoria_de_casamentos",
    "family": "events"
  },
  {
    "segment": "Casa de Festas",
    "nicheKey": "party_venue",
    "family": "events"
  },
  {
    "segment": "Cerimonialista",
    "nicheKey": "cerimonialista",
    "family": "events"
  },
  {
    "segment": "Decoração de Eventos",
    "nicheKey": "event_decor",
    "family": "events"
  },
  {
    "segment": "DJ / Som para Eventos",
    "nicheKey": "event_dj",
    "family": "events"
  },
  {
    "segment": "Fotografia de Eventos",
    "nicheKey": "event_photography",
    "family": "creative"
  },
  {
    "segment": "Locadora de Equipamentos para Eventos",
    "nicheKey": "locadora_de_equipamentos_para_eventos",
    "family": "events"
  },
  {
    "segment": "Locadora de Roupas / Festas",
    "nicheKey": "formalwear_rental",
    "family": "events"
  },
  {
    "segment": "Agência de Turismo Receptivo",
    "nicheKey": "agencia_de_turismo_receptivo",
    "family": "professional_services"
  },
  {
    "segment": "Agência de Viagens",
    "nicheKey": "travel_agency",
    "family": "professional_services"
  },
  {
    "segment": "Aluguel de Temporada",
    "nicheKey": "aluguel_de_temporada",
    "family": "professional_services"
  },
  {
    "segment": "Chalés para Temporada",
    "nicheKey": "chales_para_temporada",
    "family": "professional_services"
  },
  {
    "segment": "Hostel",
    "nicheKey": "hostel",
    "family": "professional_services"
  },
  {
    "segment": "Hotel",
    "nicheKey": "hotel",
    "family": "professional_services"
  },
  {
    "segment": "Hotel Fazenda",
    "nicheKey": "hotel_fazenda",
    "family": "professional_services"
  },
  {
    "segment": "Operadora de Turismo",
    "nicheKey": "operadora_de_turismo",
    "family": "professional_services"
  },
  {
    "segment": "Passeios Turísticos",
    "nicheKey": "passeios_turisticos",
    "family": "professional_services"
  },
  {
    "segment": "Pousada",
    "nicheKey": "pousada",
    "family": "professional_services"
  },
  {
    "segment": "Resort",
    "nicheKey": "resort",
    "family": "professional_services"
  },
  {
    "segment": "Assistência Técnica de Celular",
    "nicheKey": "phone_repair",
    "family": "professional_services"
  },
  {
    "segment": "Cartório / Serviços Notariais",
    "nicheKey": "notary",
    "family": "professional_services"
  },
  {
    "segment": "Coach",
    "nicheKey": "coach",
    "family": "professional_services"
  },
  {
    "segment": "Consultoria Financeira",
    "nicheKey": "financial_consulting",
    "family": "professional_services"
  },
  {
    "segment": "Contabilidade",
    "nicheKey": "accounting",
    "family": "professional_services"
  },
  {
    "segment": "Corretor de Seguros",
    "nicheKey": "insurance_broker",
    "family": "professional_services"
  },
  {
    "segment": "Costureira / Ateliê",
    "nicheKey": "tailor",
    "family": "creative"
  },
  {
    "segment": "Despachante",
    "nicheKey": "dispatcher",
    "family": "professional_services"
  },
  {
    "segment": "Escritório de Advocacia",
    "nicheKey": "law_firm",
    "family": "professional_services"
  },
  {
    "segment": "Fotógrafo",
    "nicheKey": "photographer",
    "family": "creative"
  },
  {
    "segment": "Marketing Digital",
    "nicheKey": "digital_marketing",
    "family": "professional_services"
  },
  {
    "segment": "Agência de Publicidade",
    "nicheKey": "agencia_de_publicidade",
    "family": "professional_services"
  },
  {
    "segment": "Consultoria de RH",
    "nicheKey": "consultoria_de_rh",
    "family": "professional_services"
  },
  {
    "segment": "Consultoria Empresarial",
    "nicheKey": "consultoria_empresarial",
    "family": "professional_services"
  },
  {
    "segment": "Coworking",
    "nicheKey": "coworking",
    "family": "professional_services"
  },
  {
    "segment": "Desenvolvimento de Software",
    "nicheKey": "desenvolvimento_de_software",
    "family": "professional_services"
  },
  {
    "segment": "Empresa de Limpeza Comercial",
    "nicheKey": "empresa_de_limpeza_comercial",
    "family": "home_services"
  },
  {
    "segment": "Empresa de Recrutamento",
    "nicheKey": "empresa_de_recrutamento",
    "family": "professional_services"
  },
  {
    "segment": "Empresa de Uniformes",
    "nicheKey": "empresa_de_uniformes",
    "family": "retail"
  },
  {
    "segment": "Medicina e Segurança do Trabalho",
    "nicheKey": "medicina_e_seguranca_do_trabalho",
    "family": "professional_services"
  },
  {
    "segment": "Produtora Audiovisual",
    "nicheKey": "produtora_audiovisual",
    "family": "creative"
  },
  {
    "segment": "Serviços de TI para Empresas",
    "nicheKey": "servicos_de_ti_para_empresas",
    "family": "professional_services"
  },
  {
    "segment": "Terceirização de Serviços",
    "nicheKey": "terceirizacao_de_servicos",
    "family": "professional_services"
  },
  {
    "segment": "Floricultura",
    "nicheKey": "florist",
    "family": "retail"
  },
  {
    "segment": "Gráfica Rápida",
    "nicheKey": "quick_print",
    "family": "creative"
  },
  {
    "segment": "Imobiliária",
    "nicheKey": "real_estate",
    "family": "professional_services"
  },
  {
    "segment": "Joalheria",
    "nicheKey": "joalheria",
    "family": "retail"
  },
  {
    "segment": "Loja de Bicicletas",
    "nicheKey": "loja_de_bicicletas",
    "family": "retail"
  },
  {
    "segment": "Loja de Calçados",
    "nicheKey": "shoe_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Informática",
    "nicheKey": "computer_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Instrumentos Musicais",
    "nicheKey": "loja_de_instrumentos_musicais",
    "family": "retail"
  },
  {
    "segment": "Loja de Materiais de Construção",
    "nicheKey": "building_materials",
    "family": "retail"
  },
  {
    "segment": "Loja de Moda Infantil",
    "nicheKey": "loja_de_moda_infantil",
    "family": "retail"
  },
  {
    "segment": "Loja de Móveis",
    "nicheKey": "furniture_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Presentes",
    "nicheKey": "gift_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Produtos Naturais",
    "nicheKey": "loja_de_produtos_naturais",
    "family": "retail"
  },
  {
    "segment": "Loja de Roupas",
    "nicheKey": "clothing_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Suplementos",
    "nicheKey": "loja_de_suplementos",
    "family": "retail"
  },
  {
    "segment": "Papelaria / Artesanato",
    "nicheKey": "stationery_crafts",
    "family": "retail"
  },
  {
    "segment": "Adestramento",
    "nicheKey": "adestramento",
    "family": "pets"
  },
  {
    "segment": "Banho e Tosa",
    "nicheKey": "banho_e_tosa",
    "family": "pets"
  },
  {
    "segment": "Clínica Veterinária",
    "nicheKey": "veterinary",
    "family": "pets"
  },
  {
    "segment": "Creche para Cães",
    "nicheKey": "creche_para_caes",
    "family": "pets"
  },
  {
    "segment": "Hotel para Pets",
    "nicheKey": "hotel_para_pets",
    "family": "pets"
  },
  {
    "segment": "Pet Shop",
    "nicheKey": "pet_shop",
    "family": "pets"
  },
  {
    "segment": "Pet Sitter",
    "nicheKey": "pet_sitter",
    "family": "pets"
  },
  {
    "segment": "Consultoria Agrícola",
    "nicheKey": "consultoria_agricola",
    "family": "professional_services"
  },
  {
    "segment": "Loja Agropecuária",
    "nicheKey": "loja_agropecuaria",
    "family": "retail"
  },
  {
    "segment": "Loja de Rações",
    "nicheKey": "loja_de_racoes",
    "family": "retail"
  },
  {
    "segment": "Máquinas Agrícolas",
    "nicheKey": "maquinas_agricolas",
    "family": "retail"
  },
  {
    "segment": "Sistemas de Irrigação",
    "nicheKey": "sistemas_de_irrigacao",
    "family": "home_services"
  },
  {
    "segment": "Motoboy / Entregas",
    "nicheKey": "courier",
    "family": "logistics"
  },
  {
    "segment": "Mudanças",
    "nicheKey": "moving",
    "family": "logistics"
  },
  {
    "segment": "Transportadora",
    "nicheKey": "transport_company",
    "family": "logistics"
  }
] as const;
