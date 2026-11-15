/** Declarative empty-state copy for the actual Buscar Leads results screen.
 * Does not fetch providers or claim that no real business exists in town.
 */
export type SearchEmptyState = { title:string; description:string };
export function searchEmptyState(input:{
  loading:boolean;
  visibleCount:number;
  loadedCount:number;
  mode:"all"|"open";
  filtersActive:boolean;
  hasError:boolean;
}):SearchEmptyState|null{
  if(input.loading || input.hasError || input.visibleCount>0)return null;
  if(input.mode==="open")return {
    title:"Nenhuma empresa marcada como aberta nesta pesquisa",
    description:"Horários desconhecidos não significam que a empresa esteja fechada. Volte a Todas as empresas sem realizar outra consulta.",
  };
  if(input.loadedCount>0 && input.filtersActive)return {
    title:"Nenhum resultado corresponde aos filtros selecionados",
    description:"Há resultados carregados, mas nenhum atende aos filtros. Limpe os filtros ou altere os critérios.",
  };
  return {
    title:"Nenhuma empresa encontrada nesta base",
    description:"Não encontramos candidatos para esta combinação nesta consulta. Tente outro segmento ou município.",
  };
}
