'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Filter,
  X,
  Check,
  AlertTriangle,
  FileText,
  Users,
  Bell,
  Building,
  Briefcase,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/app/utils/api';
import { useSistema } from '@/app/context/SistemaContext';
import { EventoCalendario, TipoEventoCalendario, OBRIGACOES_FISCAIS, Departamento, Empresa } from '@/app/types';

// Função para extrair data local corretamente (evita problema de timezone)
function getLocalDate(dateValue: string | Date): Date {
  const d = new Date(dateValue);
  // Usar UTC para evitar que o timezone mude o dia
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
}

// Cores por tipo de evento
const CORES_TIPO: Record<string, { bg: string; text: string; border: string }> = {
  processo_prazo: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
  solicitacao: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-700' },
  obrigacao_fiscal: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
  documento_vencimento: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-700' },
  reuniao: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
  lembrete: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-700' },
  feriado: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-600' },
};

const ICONES_TIPO: Record<string, React.ReactNode> = {
  processo_prazo: <Briefcase size={12} />,
  solicitacao: <FileText size={12} />,
  obrigacao_fiscal: <FileText size={12} />,
  documento_vencimento: <AlertTriangle size={12} />,
  reuniao: <Users size={12} />,
  lembrete: <Bell size={12} />,
  feriado: <CalendarIcon size={12} />,
};

const NOMES_TIPO: Record<string, string> = {
  processo_prazo: 'Prazo de Processo',
  solicitacao: 'Solicitação',
  obrigacao_fiscal: 'Obrigação Fiscal',
  documento_vencimento: 'Vencimento Documento',
  reuniao: 'Reunião',
  lembrete: 'Lembrete',
  feriado: 'Feriado',
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface CalendarioProps {
  onEventoClick?: (evento: any) => void;
}

export default function Calendario({ onEventoClick }: CalendarioProps) {
  const { departamentos, empresas } = useSistema();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);
  const [showNovoEvento, setShowNovoEvento] = useState(false);
  const [eventoSelecionado, setEventoSelecionado] = useState<any | null>(null);
  
  // Filtros
  const [filtros, setFiltros] = useState({
    tipos: ['processo_prazo', 'solicitacao', 'obrigacao_fiscal', 'documento_vencimento', 'reuniao', 'lembrete', 'feriado'] as string[],
    departamentoId: null as number | null,
    empresaId: null as number | null,
    incluirProcessos: true,
    incluirDocumentos: true,
  });
  const [showFiltros, setShowFiltros] = useState(false);

  // Formulário de novo evento
  const [novoEvento, setNovoEvento] = useState({
    titulo: '',
    descricao: '',
    tipo: 'solicitacao' as TipoEventoCalendario,
    dataInicio: '',
    horaInicio: '',
    dataFim: '',
    horaFim: '',
    diaInteiro: true, // Solicitação é dia inteiro por padrão
    cor: '',
    empresaId: null as number | null,
    departamentoId: null as number | null,
    recorrencia: 'unico' as string,
    alertaMinutosAntes: 60,
    privado: true, // Por padrão é privado
  });
  const [salvando, setSalvando] = useState(false);

  // Calcular primeiro e último dia do mês para buscar eventos
  const { primeiraData, ultimaData } = useMemo(() => {
    const ano = mesAtual.getFullYear();
    const mes = mesAtual.getMonth();
    
    // Primeiro dia do mês
    const primeiro = new Date(ano, mes, 1);
    // Voltar até o domingo anterior
    const primeiraData = new Date(primeiro);
    primeiraData.setDate(primeiraData.getDate() - primeiraData.getDay());
    
    // Último dia do mês
    const ultimo = new Date(ano, mes + 1, 0);
    // Avançar até o sábado seguinte
    const ultimaData = new Date(ultimo);
    ultimaData.setDate(ultimaData.getDate() + (6 - ultimaData.getDay()));
    
    return { primeiraData, ultimaData };
  }, [mesAtual]);

  // Carregar eventos
  const carregarEventos = useCallback(async () => {
    try {
      setLoading(true);
      const eventosData = await api.getEventosCalendario({
        inicio: primeiraData.toISOString(),
        fim: ultimaData.toISOString(),
        departamentoId: filtros.departamentoId || undefined,
        empresaId: filtros.empresaId || undefined,
        incluirProcessos: filtros.incluirProcessos,
        incluirDocumentos: filtros.incluirDocumentos,
      });
      
      // Filtrar eventos ocultos (salvos no localStorage)
      const eventosOcultos = JSON.parse(localStorage.getItem('eventosOcultos') || '[]');
      const eventosFiltrados = eventosData.filter((e: any) => !eventosOcultos.includes(e.id));
      
      setEventos(eventosFiltrados);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    } finally {
      setLoading(false);
    }
  }, [primeiraData, ultimaData, filtros]);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  // Gerar dias do calendário
  const diasCalendario = useMemo(() => {
    const dias: Date[] = [];
    const dataAtual = new Date(primeiraData);
    
    while (dataAtual <= ultimaData) {
      dias.push(new Date(dataAtual));
      dataAtual.setDate(dataAtual.getDate() + 1);
    }
    
    return dias;
  }, [primeiraData, ultimaData]);

  // Agrupar eventos por dia (com suporte a recorrência)
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, any[]>();
    
    // Função para adicionar evento em uma data
    const adicionarEvento = (evento: any, data: Date) => {
      const chave = `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, []);
      }
      // Criar cópia do evento com a data ajustada para exibição
      mapa.get(chave)!.push({
        ...evento,
        dataExibicao: data,
      });
    };
    
    eventos.forEach(evento => {
      // Filtrar por tipo
      if (!filtros.tipos.includes(evento.tipo)) return;
      
      const dataEvento = getLocalDate(evento.dataInicio);
      const recorrencia = evento.recorrencia?.toLowerCase() || 'unico';
      const recorrenciaFim = evento.recorrenciaFim ? getLocalDate(evento.recorrenciaFim) : null;
      
      // Se for único, adiciona só na data original
      if (recorrencia === 'unico') {
        if (dataEvento >= primeiraData && dataEvento <= ultimaData) {
          adicionarEvento(evento, dataEvento);
        }
        return;
      }
      
      // Para eventos recorrentes, gerar ocorrências no período visível
      // Precisamos calcular qual seria a primeira ocorrência dentro do período visível
      let dataAtual = new Date(dataEvento);
      const diaOriginal = dataEvento.getDate();
      const mesOriginal = dataEvento.getMonth();
      const limiteIteracoes = 500; // Evitar loop infinito
      let iteracoes = 0;
      
      // Avançar até chegar no período visível (ou passar dele)
      while (dataAtual < primeiraData && iteracoes < limiteIteracoes) {
        // Verificar se passou do fim da recorrência
        if (recorrenciaFim && dataAtual > recorrenciaFim) return;
        
        switch (recorrencia) {
          case 'diario':
            dataAtual.setDate(dataAtual.getDate() + 1);
            break;
          case 'semanal':
            dataAtual.setDate(dataAtual.getDate() + 7);
            break;
          case 'mensal':
            // Para mensal, manter o mesmo dia do mês
            dataAtual = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, diaOriginal, 12, 0, 0);
            break;
          case 'anual':
            // Para anual, manter o mesmo dia e mês
            dataAtual = new Date(dataAtual.getFullYear() + 1, mesOriginal, diaOriginal, 12, 0, 0);
            break;
          default:
            return; // Recorrência inválida
        }
        iteracoes++;
      }
      
      // Agora gerar ocorrências dentro do período visível
      iteracoes = 0;
      while (dataAtual <= ultimaData && iteracoes < limiteIteracoes) {
        // Verificar se passou do fim da recorrência
        if (recorrenciaFim && dataAtual > recorrenciaFim) break;
        
        // Se a data está no período visível, adiciona
        if (dataAtual >= primeiraData && dataAtual <= ultimaData) {
          adicionarEvento(evento, new Date(dataAtual));
        }
        
        // Avançar para próxima ocorrência
        switch (recorrencia) {
          case 'diario':
            dataAtual.setDate(dataAtual.getDate() + 1);
            break;
          case 'semanal':
            dataAtual.setDate(dataAtual.getDate() + 7);
            break;
          case 'mensal':
            dataAtual = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, diaOriginal, 12, 0, 0);
            break;
          case 'anual':
            dataAtual = new Date(dataAtual.getFullYear() + 1, mesOriginal, diaOriginal, 12, 0, 0);
            break;
          default:
            iteracoes = limiteIteracoes; // Sair do loop
        }
        iteracoes++;
      }
    });
    
    return mapa;
  }, [eventos, filtros.tipos, primeiraData, ultimaData]);

  // Navegação
  const mesAnterior = () => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1));
  };

  const proximoMes = () => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 1));
  };

  const irParaHoje = () => {
    setMesAtual(new Date());
  };

  // Salvar novo evento
  const handleSalvarEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoEvento.titulo || !novoEvento.dataInicio) return;

    try {
      setSalvando(true);
      
      const horaInicio = String(novoEvento.horaInicio || '').trim();
      const horaFim = String(novoEvento.horaFim || '').trim();
      const diaInteiro = Boolean(novoEvento.diaInteiro || !horaInicio);

      let dataInicio = novoEvento.dataInicio;
      if (!diaInteiro && horaInicio) {
        dataInicio = `${novoEvento.dataInicio}T${horaInicio}:00`;
      }

      let dataFim = novoEvento.dataFim || undefined;
      if (dataFim && !diaInteiro && horaFim) {
        dataFim = `${novoEvento.dataFim}T${horaFim}:00`;
      }

      await api.criarEventoCalendario({
        titulo: novoEvento.titulo,
        descricao: novoEvento.descricao || undefined,
        tipo: novoEvento.tipo,
        dataInicio,
        dataFim,
        diaInteiro,
        cor: novoEvento.cor || undefined,
        empresaId: novoEvento.empresaId || undefined,
        departamentoId: novoEvento.departamentoId || undefined,
        recorrencia: novoEvento.recorrencia,
        alertaMinutosAntes: novoEvento.alertaMinutosAntes,
        privado: novoEvento.privado,
      });

      await carregarEventos();
      setShowNovoEvento(false);
      setNovoEvento({
        titulo: '',
        descricao: '',
        tipo: 'solicitacao',
        dataInicio: '',
        horaInicio: '',
        dataFim: '',
        horaFim: '',
        diaInteiro: true,
        cor: '',
        empresaId: null,
        departamentoId: null,
        recorrencia: 'unico',
        alertaMinutosAntes: 60,
        privado: true,
      });
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
    } finally {
      setSalvando(false);
    }
  };

  // Marcar evento como concluído
  const handleConcluirEvento = async (eventoId: number | string) => {
    if (typeof eventoId === 'string') return; // Eventos de processo/documento não podem ser marcados
    
    try {
      await api.concluirEventoCalendario(eventoId);
      await carregarEventos();
      setEventoSelecionado(null);
    } catch (error) {
      console.error('Erro ao concluir evento:', error);
    }
  };

  // Excluir evento
  const handleExcluirEvento = async (eventoId: number | string) => {
    if (typeof eventoId === 'string') return;
    if (!confirm('Excluir este evento?')) return;
    
    try {
      await api.excluirEventoCalendario(eventoId);
      await carregarEventos();
      setEventoSelecionado(null);
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
    }
  };

  // Verificar se é hoje
  const isHoje = (data: Date) => {
    const hoje = new Date();
    return data.getDate() === hoje.getDate() &&
           data.getMonth() === hoje.getMonth() &&
           data.getFullYear() === hoje.getFullYear();
  };

  // Verificar se é do mês atual
  const isMesAtual = (data: Date) => {
    return data.getMonth() === mesAtual.getMonth();
  };

  // Formatação
  const formatarData = (data: Date | string) => {
    return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  };

  const formatarHora = (data: Date | string) => {
    return new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  // Renderizar evento no dia
  const renderEvento = (evento: any, index: number) => {
    const cores = evento.cor 
      ? { bg: '', text: '', border: '' } 
      : CORES_TIPO[evento.tipo] || CORES_TIPO.lembrete;
    
    const estiloCustom = evento.cor ? {
      backgroundColor: `${evento.cor}20`,
      borderColor: evento.cor,
      color: evento.cor,
    } : {};

    const isAtrasado = evento.status === 'atrasado';
    const isConcluido = evento.status === 'concluido';

    return (
      <div
        key={evento.id}
        onClick={(e) => {
          e.stopPropagation();
          setEventoSelecionado(evento);
        }}
        className={`
          text-xs p-1 rounded truncate cursor-pointer border transition-all hover:scale-[1.02]
          ${evento.cor ? '' : `${cores.bg} ${cores.text} ${cores.border}`}
          ${isAtrasado ? 'border-red-500 bg-red-50 dark:bg-red-900/30' : ''}
          ${isConcluido ? 'opacity-50 line-through' : ''}
        `}
        style={estiloCustom}
        title={evento.titulo}
      >
        <div className="flex items-center gap-1">
          {ICONES_TIPO[evento.tipo]}
          <span className="truncate">{evento.titulo}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-lg overflow-hidden">
      {/* Header do Calendário */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CalendarIcon size={28} />
            <div>
              <h2 className="text-2xl font-bold">
                {MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}
              </h2>
              <p className="text-indigo-200 text-sm">
                {eventos.length} eventos neste período
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={irParaHoje}
              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition"
            >
              Hoje
            </button>
            <button
              onClick={mesAnterior}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={proximoMes}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              <ChevronRight size={20} />
            </button>
            <div className="w-px h-6 bg-white/30 mx-2" />
            <button
              onClick={() => setShowFiltros(!showFiltros)}
              className={`p-2 rounded-lg transition ${showFiltros ? 'bg-white/30' : 'hover:bg-white/20'}`}
            >
              <Filter size={20} />
            </button>
            <button
              onClick={carregarEventos}
              className="p-2 hover:bg-white/20 rounded-lg transition"
              title="Atualizar"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => {
                setNovoEvento({
                  titulo: '',
                  descricao: '',
                  tipo: 'solicitacao',
                  dataInicio: new Date().toISOString().split('T')[0],
                  horaInicio: '',
                  dataFim: '',
                  horaFim: '',
                  diaInteiro: true,
                  cor: '',
                  empresaId: null,
                  departamentoId: null,
                  recorrencia: 'unico',
                  alertaMinutosAntes: 60,
                  privado: true,
                });
                setShowNovoEvento(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition"
            >
              <Plus size={18} />
              Novo Evento
            </button>
          </div>
        </div>

        {/* Painel de Filtros */}
        {showFiltros && (
          <div className="mt-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Filtro por Tipo */}
              <div>
                <label className="block text-xs font-medium text-indigo-200 mb-2">Tipos de Evento</label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(NOMES_TIPO).map(([tipo, nome]) => (
                    <button
                      key={tipo}
                      onClick={() => {
                        setFiltros(prev => ({
                          ...prev,
                          tipos: prev.tipos.includes(tipo)
                            ? prev.tipos.filter(t => t !== tipo)
                            : [...prev.tipos, tipo]
                        }));
                      }}
                      className={`px-2 py-1 text-xs rounded-full transition ${
                        filtros.tipos.includes(tipo)
                          ? 'bg-white text-indigo-600'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro por Departamento */}
              <div>
                <label className="block text-xs font-medium text-indigo-200 mb-2">Departamento</label>
                <select
                  value={filtros.departamentoId || ''}
                  onChange={(e) => setFiltros(prev => ({
                    ...prev,
                    departamentoId: e.target.value ? Number(e.target.value) : null
                  }))}
                  className="w-full px-3 py-1.5 bg-white/20 border-0 rounded-lg text-white text-sm focus:ring-2 focus:ring-white/50"
                >
                  <option value="" className="text-gray-900">Todos</option>
                  {departamentos?.map((dep: Departamento) => (
                    <option key={dep.id} value={dep.id} className="text-gray-900">{dep.nome}</option>
                  ))}
                </select>
              </div>

              {/* Filtro por Empresa */}
              <div>
                <label className="block text-xs font-medium text-indigo-200 mb-2">Empresa</label>
                <select
                  value={filtros.empresaId || ''}
                  onChange={(e) => setFiltros(prev => ({
                    ...prev,
                    empresaId: e.target.value ? Number(e.target.value) : null
                  }))}
                  className="w-full px-3 py-1.5 bg-white/20 border-0 rounded-lg text-white text-sm focus:ring-2 focus:ring-white/50"
                >
                  <option value="" className="text-gray-900">Todas</option>
                  {(empresas || []).slice(0, 50).map((emp: Empresa) => (
                    <option key={emp.id} value={emp.id} className="text-gray-900">
                      {emp.razao_social || emp.codigo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Opções extras */}
              <div>
                <label className="block text-xs font-medium text-indigo-200 mb-2">Incluir</label>
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filtros.incluirProcessos}
                      onChange={(e) => setFiltros(prev => ({ ...prev, incluirProcessos: e.target.checked }))}
                      className="rounded"
                    />
                    Prazos de Processos
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filtros.incluirDocumentos}
                      onChange={(e) => setFiltros(prev => ({ ...prev, incluirDocumentos: e.target.checked }))}
                      className="rounded"
                    />
                    Vencimento Documentos
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grade do Calendário */}
      <div className="flex-1 overflow-auto p-4">
        {loading && eventos.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={40} className="animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="min-h-full">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DIAS_SEMANA.map((dia, i) => (
                <div
                  key={dia}
                  className={`text-center py-2 text-sm font-semibold ${
                    i === 0 || i === 6 ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {dia}
                </div>
              ))}
            </div>

            {/* Dias do mês */}
            <div className="grid grid-cols-7 gap-1">
              {diasCalendario.map((dia, index) => {
                const chave = `${dia.getFullYear()}-${dia.getMonth()}-${dia.getDate()}`;
                const eventosDoDia = eventosPorDia.get(chave) || [];
                const hoje = isHoje(dia);
                const doMes = isMesAtual(dia);
                const isFimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;

                return (
                  <div
                    key={index}
                    onClick={() => {
                      setDiaSelecionado(dia);
                      setNovoEvento({
                        titulo: '',
                        descricao: '',
                        tipo: 'solicitacao',
                        dataInicio: dia.toISOString().split('T')[0],
                        horaInicio: '',
                        dataFim: '',
                        horaFim: '',
                        diaInteiro: true,
                        cor: '',
                        empresaId: null,
                        departamentoId: null,
                        recorrencia: 'unico',
                        alertaMinutosAntes: 60,
                        privado: true,
                      });
                    }}
                    className={`
                      min-h-[100px] p-1 border rounded-lg cursor-pointer transition-all
                      ${hoje ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700' : 'border-gray-200 dark:border-gray-700'}
                      ${!doMes ? 'opacity-40' : ''}
                      ${isFimDeSemana && doMes ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                      hover:border-indigo-400 dark:hover:border-indigo-500
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={`
                          text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                          ${hoje ? 'bg-indigo-600 text-white' : ''}
                          ${isFimDeSemana && !hoje ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}
                        `}
                      >
                        {dia.getDate()}
                      </span>
                      {eventosDoDia.length > 4 && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full text-gray-600 dark:text-gray-300 font-medium">
                          +{eventosDoDia.length - 4}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      {eventosDoDia.slice(0, 4).map((evento, i) => renderEvento(evento, i))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-gray-500 dark:text-gray-400 font-medium">Legenda:</span>
          {Object.entries(NOMES_TIPO).map(([tipo, nome]) => {
            const cores = CORES_TIPO[tipo];
            return (
              <div key={tipo} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${cores.bg} ${cores.border} border`} />
                <span className="text-gray-600 dark:text-gray-400">{nome}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Novo Evento */}
      {showNovoEvento && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus size={20} />
                  Novo Evento
                </h3>
                <button
                  onClick={() => setShowNovoEvento(false)}
                  className="text-white/80 hover:text-white p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSalvarEvento} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  value={novoEvento.titulo}
                  onChange={(e) => setNovoEvento(prev => ({ ...prev, titulo: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Ex: Reunião com cliente ABC"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo
                  </label>
                  <select
                    value={novoEvento.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as TipoEventoCalendario;
                      setNovoEvento(prev => ({
                        ...prev,
                        tipo,
                        diaInteiro: tipo === 'solicitacao' ? true : prev.diaInteiro,
                        horaInicio: tipo === 'solicitacao' ? '' : prev.horaInicio,
                        horaFim: tipo === 'solicitacao' ? '' : prev.horaFim,
                      }));
                    }}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="solicitacao">📋 Solicitação</option>
                    <option value="lembrete">🔔 Lembrete</option>
                    <option value="reuniao">👥 Reunião</option>
                    <option value="obrigacao_fiscal">📊 Obrigação Fiscal</option>
                    <option value="documento_vencimento">📄 Vencimento Documento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recorrência
                  </label>
                  <select
                    value={novoEvento.recorrencia}
                    onChange={(e) => setNovoEvento(prev => ({ ...prev, recorrencia: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="unico">Único</option>
                    <option value="diario">Diário</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
              </div>

              {/* Data dinâmica baseada no tipo */}
              {novoEvento.tipo === 'solicitacao' ? (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <label className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                    📅 Prazo de Entrega *
                  </label>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2">
                    A solicitação aparecerá no calendário nesta data
                  </p>
                  <input
                    type="date"
                    required
                    value={novoEvento.dataInicio}
                    onChange={(e) => setNovoEvento(prev => ({ ...prev, dataInicio: e.target.value }))}
                    className="w-full px-3 py-2 border border-indigo-300 rounded-lg dark:bg-gray-700 dark:border-indigo-600 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {novoEvento.tipo === 'reuniao' ? 'Data da Reunião *' : 'Data *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={novoEvento.dataInicio}
                      onChange={(e) => setNovoEvento(prev => ({ ...prev, dataInicio: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  {!novoEvento.diaInteiro && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Hora
                      </label>
                      <input
                        type="time"
                        value={novoEvento.horaInicio}
                        onChange={(e) => setNovoEvento(prev => ({ ...prev, horaInicio: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={novoEvento.diaInteiro}
                    onChange={(e) =>
                      setNovoEvento(prev => ({
                        ...prev,
                        diaInteiro: e.target.checked,
                        horaInicio: e.target.checked ? '' : prev.horaInicio,
                        horaFim: e.target.checked ? '' : prev.horaFim,
                      }))
                    }
                    className="rounded"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Dia inteiro</span>
                </label>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={novoEvento.privado}
                    onChange={(e) => setNovoEvento(prev => ({ ...prev, privado: e.target.checked }))}
                    className="rounded text-indigo-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    🔒 Evento privado
                    <span className="text-xs text-gray-400">(só você vê)</span>
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição
                </label>
                <textarea
                  value={novoEvento.descricao}
                  onChange={(e) => setNovoEvento(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Detalhes do evento..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Empresa (opcional)
                  </label>
                  <select
                    value={novoEvento.empresaId || ''}
                    onChange={(e) => setNovoEvento(prev => ({ ...prev, empresaId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">Nenhuma</option>
                    {(empresas || []).slice(0, 50).map((emp: Empresa) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.razao_social || emp.codigo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Departamento (opcional)
                  </label>
                  <select
                    value={novoEvento.departamentoId || ''}
                    onChange={(e) => setNovoEvento(prev => ({ ...prev, departamentoId: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="">Nenhum</option>
                    {departamentos?.map((dep: Departamento) => (
                      <option key={dep.id} value={dep.id}>{dep.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cor (opcional)
                </label>
                <div className="flex gap-2">
                  {['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'].map(cor => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setNovoEvento(prev => ({ ...prev, cor: prev.cor === cor ? '' : cor }))}
                      className={`w-8 h-8 rounded-full transition-transform ${novoEvento.cor === cor ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {salvando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {salvando ? 'Salvando...' : 'Salvar Evento'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNovoEvento(false)}
                  className="px-6 py-2.5 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Evento */}
      {eventoSelecionado && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEventoSelecionado(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-4 rounded-t-2xl flex-shrink-0"
              style={{
                background: eventoSelecionado.cor 
                  ? eventoSelecionado.cor 
                  : 'linear-gradient(to right, #4F46E5, #7C3AED)',
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-white">
                  {ICONES_TIPO[eventoSelecionado.tipo]}
                  <span className="text-sm opacity-80">
                    {NOMES_TIPO[eventoSelecionado.tipo] || eventoSelecionado.tipo}
                  </span>
                  {eventoSelecionado.privado && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">🔒 Privado</span>
                  )}
                </div>
                <button
                  onClick={() => setEventoSelecionado(null)}
                  className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
                >
                  <X size={22} />
                </button>
              </div>
              <h3 className="text-xl font-bold text-white mt-2">{eventoSelecionado.titulo}</h3>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Data e Hora */}
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <CalendarIcon size={18} />
                <span>{formatarData(eventoSelecionado.dataExibicao || eventoSelecionado.dataInicio)}</span>
                {!eventoSelecionado.diaInteiro && (
                  <>
                    <Clock size={18} className="ml-2" />
                    <span>{formatarHora(eventoSelecionado.dataInicio)}</span>
                  </>
                )}
              </div>

              {/* Descrição */}
              {eventoSelecionado.descricao && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                    {eventoSelecionado.descricao}
                  </p>
                </div>
              )}

              {/* Informações adicionais */}
              <div className="space-y-2 text-sm">
                {/* Recorrência */}
                {eventoSelecionado.recorrencia && eventoSelecionado.recorrencia !== 'unico' && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <RefreshCw size={16} />
                    <span>
                      Repete: {
                        eventoSelecionado.recorrencia === 'diario' ? 'Todo dia' :
                        eventoSelecionado.recorrencia === 'semanal' ? 'Toda semana' :
                        eventoSelecionado.recorrencia === 'mensal' ? 'Todo mês' :
                        eventoSelecionado.recorrencia === 'anual' ? 'Todo ano' :
                        eventoSelecionado.recorrencia
                      }
                    </span>
                  </div>
                )}

                {/* Empresa */}
                {(eventoSelecionado.empresaId || eventoSelecionado.empresaNome) && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Building size={16} />
                    <span>
                      {eventoSelecionado.empresaNome || 
                        empresas.find(e => e.id === eventoSelecionado.empresaId)?.razao_social ||
                        empresas.find(e => e.id === eventoSelecionado.empresaId)?.apelido ||
                        'Empresa vinculada'}
                    </span>
                  </div>
                )}

                {/* Departamento */}
                {(eventoSelecionado.departamentoId || eventoSelecionado.departamentoNome) && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Users size={16} />
                    <span>
                      {eventoSelecionado.departamentoNome || 
                        departamentos.find(d => d.id === eventoSelecionado.departamentoId)?.nome ||
                        'Departamento vinculado'}
                    </span>
                  </div>
                )}

                {/* Processo vinculado */}
                {eventoSelecionado.processoId && typeof eventoSelecionado.id === 'string' && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Briefcase size={16} />
                    <span>Processo #{eventoSelecionado.processoId}</span>
                  </div>
                )}
              </div>

              {/* Status */}
              {eventoSelecionado.status === 'atrasado' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                  <AlertTriangle size={18} />
                  <span className="text-sm font-medium">Este evento está atrasado!</span>
                </div>
              )}

              {eventoSelecionado.status === 'concluido' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
                  <Check size={18} />
                  <span className="text-sm font-medium">Evento concluído</span>
                </div>
              )}

              {/* Ações para eventos criados manualmente */}
              {typeof eventoSelecionado.id === 'number' && eventoSelecionado.status !== 'concluido' && (
                <div className="flex gap-2 pt-4 border-t dark:border-gray-700">
                  <button
                    onClick={() => handleConcluirEvento(eventoSelecionado.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Check size={16} />
                    Concluir
                  </button>
                  <button
                    onClick={() => handleExcluirEvento(eventoSelecionado.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    title="Excluir evento"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* Ações para eventos de processo/documento */}
              {typeof eventoSelecionado.id === 'string' && (
                <div className="pt-4 border-t dark:border-gray-700 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Este evento é gerado automaticamente a partir de {eventoSelecionado.origem === 'processo' ? 'um processo' : 'um documento'}
                  </p>
                  <button
                    onClick={() => {
                      // Salvar no localStorage que este evento deve ser ocultado
                      const ocultos = JSON.parse(localStorage.getItem('eventosOcultos') || '[]');
                      if (!ocultos.includes(eventoSelecionado.id)) {
                        ocultos.push(eventoSelecionado.id);
                        localStorage.setItem('eventosOcultos', JSON.stringify(ocultos));
                      }
                      // Remover da lista de eventos
                      setEventos(prev => prev.filter(e => e.id !== eventoSelecionado.id));
                      setEventoSelecionado(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    <Eye size={16} className="line-through" />
                    Ocultar do calendário
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Eventos do Dia */}
      {diaSelecionado && (() => {
        const eventosDoDia = eventos.filter((e: any) => {
          const dataEvento = getLocalDate(e.dataInicio);
          return dataEvento.getFullYear() === diaSelecionado.getFullYear() &&
            dataEvento.getMonth() === diaSelecionado.getMonth() &&
            dataEvento.getDate() === diaSelecionado.getDate();
        });

        if (eventosDoDia.length === 0) return null;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDiaSelecionado(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {diaSelecionado.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <p className="text-white/80 text-sm">{eventosDoDia.length} evento{eventosDoDia.length > 1 ? 's' : ''}</p>
                  </div>
                  <button onClick={() => setDiaSelecionado(null)} className="text-white/80 hover:text-white p-1">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
                {eventosDoDia.map((evento: any, i: number) => {
                  const cores = CORES_TIPO[evento.tipo] || CORES_TIPO.lembrete;
                  const icone = ICONES_TIPO[evento.tipo] || ICONES_TIPO.lembrete;
                  const nomeEmpresa = evento.empresaNome || evento.nomeEmpresa || '';
                  const tituloCompleto = nomeEmpresa ? `${evento.titulo} - ${nomeEmpresa}` : evento.titulo;

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setEventoSelecionado(evento);
                        setDiaSelecionado(null);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${cores.bg} ${cores.border}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${cores.bg} ${cores.text}`}>
                          {icone}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${cores.text}`}>{tituloCompleto}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {NOMES_TIPO[evento.tipo] || 'Evento'}
                            {!evento.diaInteiro && evento.dataInicio && (
                              <span className="ml-2">
                                🕐 {new Date(evento.dataInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </p>
                          {evento.descricao && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{evento.descricao}</p>
                          )}
                        </div>
                        {evento.status === 'concluido' && (
                          <Check size={16} className="text-green-500" />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Botão para criar novo evento neste dia */}
                <button
                  onClick={() => {
                    setShowNovoEvento(true);
                    setDiaSelecionado(null);
                  }}
                  className="w-full mt-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Adicionar evento neste dia
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
