alter table public.survey_templates add column if not exists instrument_version text;
alter table public.survey_items add column if not exists item_number integer;
alter table public.survey_items add column if not exists has_individual_alert boolean not null default false;

with newdims(ord,nm) as (values (1,'Demandas de Trabalho'),(2,'Autonomia e Controle'),(3,'Clareza e Organização do Trabalho'),(4,'Liderança e Justiça Organizacional'),(5,'Relações Sociais no Trabalho'),(6,'Reconhecimento, Sentido e Satisfação')),
cur as (select id, row_number() over (order by sort_order, name) rn from public.survey_dimensions where template_id='d0000001-0000-0000-0000-000000000001')
update public.survey_dimensions d
set name = n.nm, sort_order = n.ord, description = null
from cur c join newdims n on n.ord = c.rn
where d.id = c.id;

insert into public.survey_dimensions (template_id, name, sort_order)
select 'd0000001-0000-0000-0000-000000000001', nm, ord from (values (7,'Trabalho e Vida Pessoal'),(8,'Sinais de Desgaste Relacionados ao Trabalho')) v(ord,nm)
where not exists (select 1 from public.survey_dimensions x where x.template_id='d0000001-0000-0000-0000-000000000001' and x.name = v.nm);

with newitems(num,dimord,txt,inv,alerta) as (values (1,1,'Minha carga de trabalho é adequada para o tempo disponível.',true,false),(2,1,'Preciso trabalhar muito rápido para conseguir cumprir minhas tarefas.',false,false),(3,1,'Meu trabalho exige atenção constante durante a maior parte do tempo.',false,false),(4,1,'Meu trabalho exige lidar com demandas emocionais com frequência.',false,false),(5,2,'Tenho autonomia para organizar a forma como realizo meu trabalho.',true,false),(6,2,'Posso influenciar decisões que afetam diretamente meu trabalho.',true,false),(7,2,'Tenho liberdade para tomar iniciativas no meu dia a dia.',true,false),(8,2,'Sinto que tenho pouco controle sobre o ritmo e a forma do meu trabalho.',false,false),(9,3,'Sei exatamente quais são minhas responsabilidades no trabalho.',true,false),(10,3,'Recebo informações suficientes para realizar bem meu trabalho.',true,false),(11,3,'Sou informado com antecedência sobre mudanças importantes que afetam meu trabalho.',true,false),(12,3,'As metas e prioridades do meu trabalho são claras.',true,false),(13,4,'Meu trabalho é reconhecido e valorizado pela liderança.',true,false),(14,4,'Sou tratado de forma justa no ambiente de trabalho.',true,false),(15,4,'Posso contar com apoio do meu gestor imediato quando necessário.',true,false),(16,4,'Os conflitos no ambiente de trabalho são tratados de forma adequada.',true,false),(17,5,'Existe cooperação entre as pessoas da minha equipe.',true,false),(18,5,'O clima de respeito entre colegas é positivo.',true,false),(19,5,'Sinto-me à vontade para expressar opiniões no trabalho.',true,false),(20,5,'Já sofri tratamento desrespeitoso, humilhante ou hostil (incluindo assédio moral ou sexual) no ambiente de trabalho.',false,true),(21,6,'Sinto que meu trabalho tem significado para mim.',true,false),(22,6,'Acredito que meu trabalho é importante para a empresa.',true,false),(23,6,'Sinto segurança quanto à continuidade do meu trabalho nesta empresa.',true,false),(24,6,'Sinto falta de reconhecimento pelo trabalho que realizo.',false,false),(25,7,'Meu trabalho exige tanta energia que impacta negativamente minha vida pessoal.',false,false),(26,7,'Meu trabalho exige tanto tempo que afeta negativamente minha vida pessoal.',false,false),(27,7,'Consigo equilibrar bem meu trabalho e minha vida pessoal.',true,false),(28,8,'Sinto-me frequentemente esgotado ao final do dia de trabalho.',false,false),(29,8,'Tenho dificuldade de me desligar do trabalho fora do horário.',false,false),(30,8,'Sinto-me emocionalmente sobrecarregado pelo trabalho.',false,false)),
cur as (select i.id, row_number() over (order by dd.sort_order, i.sort_order, i.text) rn
        from public.survey_items i join public.survey_dimensions dd on dd.id = i.dimension_id
        where dd.template_id='d0000001-0000-0000-0000-000000000001')
update public.survey_items i
set dimension_id = (select id from public.survey_dimensions where template_id='d0000001-0000-0000-0000-000000000001' and sort_order = n.dimord),
    text = n.txt,
    is_inverted = n.inv,
    sort_order = n.num,
    item_number = n.num,
    has_individual_alert = n.alerta
from cur c join newitems n on n.num = c.rn
where i.id = c.id;

update public.survey_templates
set name = 'Avaliação de Riscos Psicossociais',
    description = 'People Pulse Index (PPI) v1.1 — 30 itens, 8 dimensões, escala Likert 1–5',
    instrument_version = '1.1'
where id = 'd0000001-0000-0000-0000-000000000001';

update public.tenants set min_group_size = 7 where min_group_size <> 7;
alter table public.tenants alter column min_group_size set default 7;