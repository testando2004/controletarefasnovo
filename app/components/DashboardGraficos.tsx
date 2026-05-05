'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Filter,
  Download,
  Calendar,
  Building,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Pause,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';
import { Processo, Departamento } from '@/app/types';

// ─── Helpers ───────────────────────────────────────────────────

const CORES_STATUS: Record<string, string> = {
  em_andamento: '#f59e0b',
  finalizado: '#10b981',
  pausado: '#6366f1',
  cancelado: '#ef4444',
  rascunho: '#94a3b8',
};

const LABELS_STATUS: Record<string, string> = {
  em_andamento: 'Em Andamento',
  finalizado: 'Finalizado',
  pausado: 'Pausado',
  cancelado: 'Cancelado',
  rascunho: 'Rascunho',
};

const CORES_PRIORIDADE: Record<string, string> = {
  alta: '#ef4444',
  media: '#f59e0b',
  baixa: '#10b981',
};

const LABELS_PRIORIDADE: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

const CORES_DEPARTAMENTOS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#a855f7', '#d946ef',
];

type PeriodoFiltro = '7d' | '30d' | '90d' | '6m' | '1a' | 'todos';

function getDataInicio(periodo: PeriodoFiltro): Date | null {
  const agora = new Date();
  switch (periodo) {
    case '7d': return new Date(agora.getTime() - 7 * 86400000);
    case '30d': return new Date(agora.getTime() - 30 * 86400000);
    case '90d': return new Date(agora.getTime() - 90 * 86400000);
    case '6m': return new Date(agora.getFullYear(), agora.getMonth() - 6, agora.getDate());
    case '1a': return new Date(agora.getFullYear() - 1, agora.getMonth(), agora.getDate());
    default: return null;
  }
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Sub-componentes de gráficos (SVG puro) ────────────────────

/** Barra vertical animada */
function BarraVertical({
  x,
  y,
  width,
  height,
  cor,
  label,
  valor,
  maxH,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  cor: string;
  label: string;
  valor: number;
  maxH: number;
}) {
  return (
    <g className="group">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={cor}
        className="transition-all duration-500 ease-out opacity-85 hover:opacity-100"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.15))' }}
      />
      {/* Valor acima da barra */}
      <text
        x={x + width / 2}
        y={y - 8}
        textAnchor="middle"
        className="fill-gray-700 dark:fill-gray-300 text-xs font-bold"
        style={{ fontSize: 12 }}
      >
        {valor}
      </text>
      {/* Label abaixo */}
      <text
        x={x + width / 2}
        y={maxH + 20}
        textAnchor="middle"
        className="fill-gray-500 dark:fill-gray-400"
        style={{ fontSize: 11 }}
      >
        {label.length > 12 ? label.slice(0, 11) + '…' : label}
      </text>
    </g>
  );
}

/** Gráfico de rosca (donut) */
function DonutChart({
  dados,
  tamanho = 200,
}: {
  dados: { label: string; valor: number; cor: string }[];
  tamanho?: number;
}) {
  const total = dados.reduce((acc, d) => acc + d.valor, 0);
  if (total === 0)
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 text-sm">
        Sem dados
      </div>
    );

  const raio = tamanho / 2 - 10;
  const raioInterno = raio * 0.6;
  const cx = tamanho / 2;
  const cy = tamanho / 2;
  let anguloAcumulado = -90; // começa no topo

  const fatias = dados
    .filter((d) => d.valor > 0)
    .map((d) => {
      const angulo = (d.valor / total) * 360;
      const inicioRad = (anguloAcumulado * Math.PI) / 180;
      const fimRad = ((anguloAcumulado + angulo) * Math.PI) / 180;

      const x1 = cx + raio * Math.cos(inicioRad);
      const y1 = cy + raio * Math.sin(inicioRad);
      const x2 = cx + raio * Math.cos(fimRad);
      const y2 = cy + raio * Math.sin(fimRad);

      const xi1 = cx + raioInterno * Math.cos(fimRad);
      const yi1 = cy + raioInterno * Math.sin(fimRad);
      const xi2 = cx + raioInterno * Math.cos(inicioRad);
      const yi2 = cy + raioInterno * Math.sin(inicioRad);

      const largeArc = angulo > 180 ? 1 : 0;

      const path = [
        `M ${x1} ${y1}`,
        `A ${raio} ${raio} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${xi1} ${yi1}`,
        `A ${raioInterno} ${raioInterno} 0 ${largeArc} 0 ${xi2} ${yi2}`,
        'Z',
      ].join(' ');

      anguloAcumulado += angulo;
      return { ...d, path, porcentagem: Math.round((d.valor / total) * 100) };
    });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
        {fatias.map((f, i) => (
          <path
            key={i}
            d={f.path}
            fill={f.cor}
            className="transition-all duration-300 hover:opacity-80 cursor-pointer"
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.15))' }}
          >
            <title>{`${f.label}: ${f.valor} (${f.porcentagem}%)`}</title>
          </path>
        ))}
        {/* Centro */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100 font-bold" style={{ fontSize: 24 }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400" style={{ fontSize: 11 }}>
          total
        </text>
      </svg>
      {/* Legenda */}
      <div className="flex flex-wrap justify-center gap-3">
        {fatias.map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: f.cor }} />
            {f.label} ({f.valor})
          </div>
        ))}
      </div>
    </div>
  );
}

/** Gráfico de linha (tendência) */
function LineChart({
  dados,
  largura = 700,
  altura = 300,
}: {
  dados: { label: string; valor: number; valorFinalizado?: number }[];
  largura?: number;
  altura?: number;
}) {
  if (dados.length === 0)
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 text-sm">
        Sem dados para o período
      </div>
    );

  const pad = { top: 30, right: 20, bottom: 40, left: 50 };
  const w = largura - pad.left - pad.right;
  const h = altura - pad.top - pad.bottom;

  const allVals = dados.flatMap((d) => [d.valor, d.valorFinalizado ?? 0]);
  const maxVal = Math.max(...allVals, 1);
  const niceMax = Math.ceil(maxVal / 5) * 5 || 5;

  const pontos = dados.map((d, i) => ({
    x: pad.left + (dados.length === 1 ? w / 2 : (i / (dados.length - 1)) * w),
    y: pad.top + h - (d.valor / niceMax) * h,
    yFin: pad.top + h - ((d.valorFinalizado ?? 0) / niceMax) * h,
    ...d,
  }));

  const pathLine = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const pathFinalizados = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yFin}`).join(' ');

  // Área preenchida (gradient)
  const areaPath = `${pathLine} L ${pontos[pontos.length - 1].x} ${pad.top + h} L ${pontos[0].x} ${pad.top + h} Z`;
  const areaPathFin = `${pathFinalizados} L ${pontos[pontos.length - 1].x} ${pad.top + h} L ${pontos[0].x} ${pad.top + h} Z`;

  const gridLines = Array.from({ length: 6 }, (_, i) => ({
    y: pad.top + (h / 5) * i,
    val: Math.round(niceMax - (niceMax / 5) * i),
  }));

  return (
    <svg width="100%" viewBox={`0 0 ${largura} ${altura}`} className="overflow-visible">
      <defs>
        <linearGradient id="gradCriados" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="gradFinalizados" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid horizontal */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={pad.left} x2={pad.left + w} y1={g.y} y2={g.y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray={i > 0 ? '4 4' : undefined} className="dark:stroke-gray-700" />
          <text x={pad.left - 10} y={g.y + 4} textAnchor="end" className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: 11 }}>
            {g.val}
          </text>
        </g>
      ))}

      {/* Áreas */}
      <path d={areaPath} fill="url(#gradCriados)" />
      <path d={areaPathFin} fill="url(#gradFinalizados)" />

      {/* Linhas */}
      <path d={pathLine} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="transition-all duration-500" />
      <path d={pathFinalizados} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="transition-all duration-500" strokeDasharray="6 3" />

      {/* Pontos & labels do eixo X */}
      {pontos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="white" strokeWidth="2" className="cursor-pointer hover:r-6 transition-all">
            <title>{`${p.label}: ${p.valor} criados`}</title>
          </circle>
          <circle cx={p.x} cy={p.yFin} r="4" fill="#10b981" stroke="white" strokeWidth="2" className="cursor-pointer hover:r-6 transition-all">
            <title>{`${p.label}: ${p.valorFinalizado ?? 0} finalizados`}</title>
          </circle>
          <text
            x={p.x}
            y={pad.top + h + 20}
            textAnchor="middle"
            className="fill-gray-500 dark:fill-gray-400"
            style={{ fontSize: 11 }}
          >
            {p.label}
          </text>
        </g>
      ))}

      {/* Legenda */}
      <g transform={`translate(${pad.left}, ${pad.top - 15})`}>
        <circle cx={0} cy={0} r={4} fill="#6366f1" />
        <text x={8} y={4} className="fill-gray-600 dark:fill-gray-400" style={{ fontSize: 11 }}>
          Criados
        </text>
        <circle cx={80} cy={0} r={4} fill="#10b981" />
        <text x={88} y={4} className="fill-gray-600 dark:fill-gray-400" style={{ fontSize: 11 }}>
          Finalizados
        </text>
      </g>
    </svg>
  );
}

/** Barra horizontal (processos por departamento) */
function BarraHorizontal({
  dados,
  altura = 350,
}: {
  dados: { label: string; valor: number; cor: string }[];
  altura?: number;
}) {
  if (dados.length === 0)
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 text-sm">
        Sem dados
      </div>
    );

  const maxVal = Math.max(...dados.map((d) => d.valor), 1);
  const barH = Math.min(36, Math.max(20, (altura - 40) / dados.length - 8));

  return (
    <div className="space-y-2 w-full">
      {dados.map((d, i) => {
        const pct = (d.valor / maxVal) * 100;
        return (
          <div key={i} className="flex items-center gap-3 group">
            <span className="text-xs text-gray-600 dark:text-gray-400 w-32 truncate text-right font-medium" title={d.label}>
              {d.label}
            </span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden" style={{ height: barH }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2 group-hover:opacity-90"
                style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: d.cor }}
              >
                {pct > 15 && (
                  <span className="text-white text-xs font-bold">{d.valor}</span>
                )}
              </div>
            </div>
            {pct <= 15 && (
              <span className="text-xs text-gray-600 dark:text-gray-400 font-bold w-8">{d.valor}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Card genérico para KPIs ───────────────────────────────────

function KpiCard({
  titulo,
  valor,
  icone,
  corGrad,
  subtitulo,
  tendencia,
}: {
  titulo: string;
  valor: number | string;
  icone: React.ReactNode;
  corGrad: string;
  subtitulo?: string;
  tendencia?: 'up' | 'down' | 'stable';
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium truncate">{titulo}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{valor}</p>
            {tendencia && (
              <span
                className={`flex items-center text-xs font-semibold ${
                  tendencia === 'up' ? 'text-green-500' : tendencia === 'down' ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                {tendencia === 'up' && <ArrowUpRight size={14} />}
                {tendencia === 'down' && <ArrowDownRight size={14} />}
                {tendencia === 'stable' && <Minus size={14} />}
              </span>
            )}
          </div>
          {subtitulo && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitulo}</p>}
        </div>
        <div className={`p-3.5 rounded-xl bg-gradient-to-br ${corGrad} flex-shrink-0`}>{icone}</div>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────

export default function DashboardGraficos() {
  const { processos: processosRaw, departamentos: deptosRaw, usuarioLogado, mostrarConfirmacao, mostrarAlerta, adicionarNotificacao } = useSistema();
  const processos = useMemo(() => (processosRaw ?? []) as Processo[], [processosRaw]);
  const departamentos = useMemo(() => (deptosRaw ?? []) as Departamento[], [deptosRaw]);
  const isAdmin = String(usuarioLogado?.role || '').toUpperCase() === 'ADMIN';
  const [motivoExpandido, setMotivoExpandido] = useState<string | null>(null);

  // ── Filtros ──
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('todos');
  const [filtroDept, setFiltroDept] = useState<number | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todos');
  const [showFiltros, setShowFiltros] = useState(true);
  const [exclusoesData, setExclusoesData] = useState<{
    totalExcluidos: number;
    motivosExclusao: { motivo: string; count: number; itens?: { processoNome: string; empresaNome: string | null; deletadoEm: string }[] }[];
    exclusoesPorMes: { mes: string; count: number }[];
    usuarios?: { id: number; nome: string }[];
    departamentos?: { id: number; nome: string }[];
    motivosUnicos?: string[];
  } | null>(null);

  // Filtros de exclusão
  const [excPeriodo, setExcPeriodo] = useState<string>('todos');
  const [excDeptId, setExcDeptId] = useState<string>('todos');
  const [excUsuarioId, setExcUsuarioId] = useState<string>('todos');
  const [excMotivo, setExcMotivo] = useState<string>('todos');
  const [excShowFiltros, setExcShowFiltros] = useState(false);
  const [excLoading, setExcLoading] = useState(false);

  // Listas para dropdowns de exclusão (carregadas 1x)
  const [excUsuariosLista, setExcUsuariosLista] = useState<{ id: number; nome: string }[]>([]);
  const [excDeptLista, setExcDeptLista] = useState<{ id: number; nome: string }[]>([]);
  const [excMotivosLista, setExcMotivosLista] = useState<string[]>([]);

  // Carregar dados de exclusão via analytics
  const carregarExclusoes = React.useCallback(async (periodoVal?: string, deptVal?: string, userVal?: string, motivoVal?: string) => {
    setExcLoading(true);
    try {
      const params = new URLSearchParams({ periodo: '365' });
      const p = periodoVal ?? excPeriodo;
      const d = deptVal ?? excDeptId;
      const u = userVal ?? excUsuarioId;
      const m = motivoVal ?? excMotivo;
      if (p !== 'todos') params.set('excPeriodo', p);
      if (d !== 'todos') params.set('excDeptId', d);
      if (u !== 'todos') params.set('excUsuarioId', u);
      if (m !== 'todos') params.set('excMotivo', m);

      const res = await fetch(`/api/analytics?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.exclusoes) {
        setExclusoesData(data.exclusoes);
        // Carregar listas de dropdown só na primeira vez
        if (data.exclusoes.usuarios?.length && excUsuariosLista.length === 0) {
          setExcUsuariosLista(data.exclusoes.usuarios);
        }
        if (data.exclusoes.departamentos?.length && excDeptLista.length === 0) {
          setExcDeptLista(data.exclusoes.departamentos);
        }
        if (data.exclusoes.motivosUnicos?.length && excMotivosLista.length === 0) {
          setExcMotivosLista(data.exclusoes.motivosUnicos);
        }
      }
    } catch {
      // silencioso
    } finally {
      setExcLoading(false);
    }
  }, [excPeriodo, excDeptId, excUsuarioId, excMotivo, excUsuariosLista.length, excDeptLista.length, excMotivosLista.length]);

  React.useEffect(() => {
    carregarExclusoes();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const limparTodasExclusoes = async () => {
    const total = exclusoesData?.totalExcluidos ?? 0;
    const confirmado = await mostrarConfirmacao?.({
      titulo: 'Limpar Histórico de Exclusões',
      mensagem: `Tem certeza que deseja apagar TODOS os ${total} registros de processos excluídos?\n\nEssa ação remove permanentemente o histórico do gráfico de Análise de Exclusões e não pode ser desfeita.\n\nÚtil para zerar dados de teste — mas atenção: se houver registros reais, eles também serão perdidos.`,
      tipo: 'perigo',
      textoConfirmar: 'Sim, Apagar Tudo',
      textoCancelar: 'Cancelar',
    });
    if (!confirmado) return;
    try {
      const res = await fetch('/api/analytics/exclusoes', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Falha ao limpar exclusões');
      }
      const data = await res.json();
      adicionarNotificacao?.(`✅ ${data.removidos ?? 0} registro(s) de exclusão removido(s)`, 'sucesso');
      setExcUsuariosLista([]);
      setExcDeptLista([]);
      setExcMotivosLista([]);
      resetarFiltrosExc();
    } catch (e: any) {
      await mostrarAlerta?.('Erro', e?.message || 'Erro ao limpar histórico de exclusões', 'erro');
    }
  };

  const excFiltrosAtivos = excPeriodo !== 'todos' || excDeptId !== 'todos' || excUsuarioId !== 'todos' || excMotivo !== 'todos';
  const resetarFiltrosExc = () => {
    setExcPeriodo('todos');
    setExcDeptId('todos');
    setExcUsuarioId('todos');
    setExcMotivo('todos');
    carregarExclusoes('todos', 'todos', 'todos', 'todos');
  };

  // Processos filtrados
  const processosFiltrados = useMemo(() => {
    let list = [...processos];
    const dataIni = getDataInicio(periodo);
    if (dataIni) {
      list = list.filter((p) => {
        const d = new Date(p.criadoEm || p.dataCriacao || '');
        return d >= dataIni;
      });
    }
    if (filtroDept !== null) {
      list = list.filter((p) => p.departamentoAtual === filtroDept);
    }
    if (filtroStatus !== 'todos') {
      list = list.filter((p) => p.status === filtroStatus);
    }
    if (filtroPrioridade !== 'todos') {
      list = list.filter((p) => p.prioridade === filtroPrioridade);
    }
    return list;
  }, [processos, periodo, filtroDept, filtroStatus, filtroPrioridade]);

  // ── Dados para gráficos ──

  // 1. Por status
  const dadosPorStatus = useMemo(() => {
    const mapa: Record<string, number> = {};
    processosFiltrados.forEach((p) => {
      mapa[p.status] = (mapa[p.status] || 0) + 1;
    });
    return Object.entries(LABELS_STATUS).map(([key, label]) => ({
      label,
      valor: mapa[key] || 0,
      cor: CORES_STATUS[key] || '#94a3b8',
    }));
  }, [processosFiltrados]);

  // 2. Por prioridade
  const dadosPorPrioridade = useMemo(() => {
    const mapa: Record<string, number> = {};
    processosFiltrados.forEach((p) => {
      mapa[p.prioridade] = (mapa[p.prioridade] || 0) + 1;
    });
    return Object.entries(LABELS_PRIORIDADE).map(([key, label]) => ({
      label,
      valor: mapa[key] || 0,
      cor: CORES_PRIORIDADE[key] || '#94a3b8',
    }));
  }, [processosFiltrados]);

  // 3. Por departamento
  const dadosPorDepartamento = useMemo(() => {
    const mapa: Record<number, number> = {};
    processosFiltrados.forEach((p) => {
      mapa[p.departamentoAtual] = (mapa[p.departamentoAtual] || 0) + 1;
    });
    return departamentos
      .map((d, idx) => ({
        label: d.nome,
        valor: mapa[d.id] || 0,
        cor: CORES_DEPARTAMENTOS[idx % CORES_DEPARTAMENTOS.length],
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [processosFiltrados, departamentos]);

  // 4. Tendência mensal (últimos 12 meses)
  const dadosTendencia = useMemo(() => {
    const agora = new Date();
    const meses: { label: string; mes: number; ano: number; valor: number; valorFinalizado: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      meses.push({ label: `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, mes: d.getMonth(), ano: d.getFullYear(), valor: 0, valorFinalizado: 0 });
    }
    processos.forEach((p) => {
      const dc = new Date(p.criadoEm || p.dataCriacao || '');
      const df = p.dataFinalizacao ? new Date(p.dataFinalizacao) : null;
      meses.forEach((m) => {
        if (dc.getMonth() === m.mes && dc.getFullYear() === m.ano) m.valor++;
        if (df && df.getMonth() === m.mes && df.getFullYear() === m.ano) m.valorFinalizado++;
      });
    });
    return meses;
  }, [processos]);

  // ── KPIs calculados ──
  const totalFiltrado = processosFiltrados.length;
  const emAndamento = processosFiltrados.filter((p) => p.status === 'em_andamento').length;
  const finalizados = processosFiltrados.filter((p) => p.status === 'finalizado').length;
  const prioridadeAlta = processosFiltrados.filter((p) => p.prioridade === 'alta').length;
  const taxaSucesso = totalFiltrado > 0 ? Math.round((finalizados / totalFiltrado) * 100) : 0;

  // Tempo médio (dias) dos finalizados
  const tempoMedio = useMemo(() => {
    const fins = processosFiltrados.filter((p) => p.status === 'finalizado' && p.criadoEm && p.dataFinalizacao);
    if (fins.length === 0) return '–';
    const total = fins.reduce((acc, p) => {
      const i = new Date(p.criadoEm!).getTime();
      const f = new Date(p.dataFinalizacao!).getTime();
      return acc + (f - i) / 86400000;
    }, 0);
    return Math.round(total / fins.length);
  }, [processosFiltrados]);

  // ── Tendência em relação ao mês anterior ──
  const tendenciaCriados = useMemo(() => {
    if (dadosTendencia.length < 2) return 'stable' as const;
    const ult = dadosTendencia[dadosTendencia.length - 1].valor;
    const pen = dadosTendencia[dadosTendencia.length - 2].valor;
    return ult > pen ? 'up' : ult < pen ? 'down' : 'stable';
  }, [dadosTendencia]);

  const tendenciaFinalizados = useMemo(() => {
    if (dadosTendencia.length < 2) return 'stable' as const;
    const ult = dadosTendencia[dadosTendencia.length - 1].valorFinalizado;
    const pen = dadosTendencia[dadosTendencia.length - 2].valorFinalizado;
    return ult > pen ? 'up' : ult < pen ? 'down' : 'stable';
  }, [dadosTendencia]);

  // ── Resetar filtros ──
  const resetarFiltros = () => {
    setPeriodo('todos');
    setFiltroDept(null);
    setFiltroStatus('todos');
    setFiltroPrioridade('todos');
  };

  const filtrosAtivos = periodo !== 'todos' || filtroDept !== null || filtroStatus !== 'todos' || filtroPrioridade !== 'todos';

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl">
              <BarChart3 className="text-white" size={24} />
            </div>
            Dashboard de Análises
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Visão completa dos processos com filtros avançados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFiltros(!showFiltros)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${
              showFiltros
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter size={16} />
            Filtros
            {filtrosAtivos && (
              <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>
            )}
          </button>
          {filtrosAtivos && (
            <button
              onClick={resetarFiltros}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all text-sm font-medium"
            >
              <RefreshCw size={14} />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Painel de Filtros */}
      {showFiltros && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Período */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Período
              </label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value as PeriodoFiltro)}
                  className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                >
                  <option value="todos">Todo o período</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                  <option value="6m">Últimos 6 meses</option>
                  <option value="1a">Último ano</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Departamento */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Departamento
              </label>
              <div className="relative">
                <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={filtroDept ?? ''}
                  onChange={(e) => setFiltroDept(e.target.value ? Number(e.target.value) : null)}
                  className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                >
                  <option value="">Todos</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Status
              </label>
              <div className="relative">
                <CheckCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                >
                  <option value="todos">Todos</option>
                  {Object.entries(LABELS_STATUS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Prioridade */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Prioridade
              </label>
              <div className="relative">
                <AlertTriangle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={filtroPrioridade}
                  onChange={(e) => setFiltroPrioridade(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
                >
                  <option value="todos">Todas</option>
                  {Object.entries(LABELS_PRIORIDADE).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Resumo dos filtros ativos */}
          {filtrosAtivos && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Exibindo <span className="font-bold text-indigo-600 dark:text-indigo-400">{processosFiltrados.length}</span> de{' '}
                <span className="font-bold">{processos.length}</span> processos
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          titulo="Total Processos"
          valor={totalFiltrado}
          icone={<FileText className="text-white" size={22} />}
          corGrad="from-indigo-500 to-indigo-600"
          subtitulo={filtrosAtivos ? `de ${processos.length}` : undefined}
        />
        <KpiCard
          titulo="Em Andamento"
          valor={emAndamento}
          icone={<Clock className="text-white" size={22} />}
          corGrad="from-amber-500 to-amber-600"
          tendencia={tendenciaCriados}
        />
        <KpiCard
          titulo="Finalizados"
          valor={finalizados}
          icone={<CheckCircle className="text-white" size={22} />}
          corGrad="from-green-500 to-green-600"
          tendencia={tendenciaFinalizados}
        />
        <KpiCard
          titulo="Prioridade Alta"
          valor={prioridadeAlta}
          icone={<AlertTriangle className="text-white" size={22} />}
          corGrad="from-red-500 to-red-600"
          subtitulo={totalFiltrado > 0 ? `${Math.round((prioridadeAlta / totalFiltrado) * 100)}% do total` : undefined}
        />
        <KpiCard
          titulo="Tempo Médio"
          valor={typeof tempoMedio === 'number' ? `${tempoMedio}d` : tempoMedio}
          icone={<TrendingUp className="text-white" size={22} />}
          corGrad="from-purple-500 to-purple-600"
          subtitulo="dias até finalizar"
        />
      </div>

      {/* Gráficos – Linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tendência Mensal (ocupa 2 colunas) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <TrendingUp size={20} className="text-indigo-500" />
              Tendência Mensal
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">Últimos 12 meses</span>
          </div>
          <div className="w-full overflow-x-auto" style={{ minHeight: 300 }}>
            <LineChart dados={dadosTendencia} largura={700} altura={300} />
          </div>
        </div>

        {/* Donut – Prioridades */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <PieChart size={20} className="text-purple-500" />
            Por Prioridade
          </h3>
          <div className="flex items-center justify-center" style={{ minHeight: 280 }}>
            <DonutChart dados={dadosPorPrioridade} tamanho={220} />
          </div>
        </div>
      </div>

      {/* Gráficos – Linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processos por Status (barras verticais) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-6">
            <BarChart3 size={20} className="text-amber-500" />
            Processos por Status
          </h3>
          <div className="w-full overflow-x-auto" style={{ minHeight: 260 }}>
            <svg width="100%" viewBox="0 0 500 280" className="overflow-visible">
              {(() => {
                const maxVal = Math.max(...dadosPorStatus.map((d) => d.valor), 1);
                const niceMax = Math.ceil(maxVal / 5) * 5 || 5;
                const padding = { left: 40, bottom: 40, top: 20 };
                const chartW = 500 - padding.left - 20;
                const chartH = 280 - padding.top - padding.bottom;
                const barW = Math.min(60, chartW / dadosPorStatus.length - 20);

                // Grid lines
                const grids = Array.from({ length: 6 }, (_, i) => ({
                  y: padding.top + (chartH / 5) * i,
                  val: Math.round(niceMax - (niceMax / 5) * i),
                }));

                return (
                  <>
                    {grids.map((g, i) => (
                      <g key={i}>
                        <line
                          x1={padding.left}
                          x2={padding.left + chartW}
                          y1={g.y}
                          y2={g.y}
                          stroke="#e5e7eb"
                          strokeWidth="1"
                          strokeDasharray={i > 0 ? '4 4' : undefined}
                          className="dark:stroke-gray-700"
                        />
                        <text x={padding.left - 8} y={g.y + 4} textAnchor="end" className="fill-gray-400 dark:fill-gray-500" style={{ fontSize: 10 }}>
                          {g.val}
                        </text>
                      </g>
                    ))}
                    {dadosPorStatus.map((d, i) => {
                      const x = padding.left + (chartW / dadosPorStatus.length) * i + (chartW / dadosPorStatus.length - barW) / 2;
                      const barHeight = (d.valor / niceMax) * chartH;
                      const y = padding.top + chartH - barHeight;
                      return (
                        <BarraVertical
                          key={i}
                          x={x}
                          y={y}
                          width={barW}
                          height={barHeight}
                          cor={d.cor}
                          label={d.label}
                          valor={d.valor}
                          maxH={padding.top + chartH}
                        />
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Processos por Departamento (barras horizontais) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-6">
            <Building size={20} className="text-blue-500" />
            Processos por Departamento
          </h3>
          <div style={{ minHeight: 260 }}>
            <BarraHorizontal dados={dadosPorDepartamento} altura={Math.max(260, dadosPorDepartamento.length * 44)} />
          </div>
        </div>
      </div>

      {/* Gráficos – Linha 3: Donut de Status + Tabela resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut de status */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <PieChart size={20} className="text-indigo-500" />
            Distribuição por Status
          </h3>
          <div className="flex items-center justify-center" style={{ minHeight: 280 }}>
            <DonutChart dados={dadosPorStatus} tamanho={220} />
          </div>
        </div>

        {/* Tabela resumo por departamento */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-5 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4">
            <Building size={20} className="text-cyan-500" />
            Resumo por Departamento
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-2 text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wider">Departamento</th>
                  <th className="text-center py-3 px-2 text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wider">Total</th>
                  <th className="text-center py-3 px-2 text-amber-500 font-semibold text-xs uppercase tracking-wider">Andamento</th>
                  <th className="text-center py-3 px-2 text-green-500 font-semibold text-xs uppercase tracking-wider">Finalizados</th>
                  <th className="text-center py-3 px-2 text-red-500 font-semibold text-xs uppercase tracking-wider">Alta Prior.</th>
                  <th className="text-center py-3 px-2 text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wider">% Conclusão</th>
                </tr>
              </thead>
              <tbody>
                {departamentos.map((dept, idx) => {
                  const deptProcessos = processosFiltrados.filter((p) => p.departamentoAtual === dept.id);
                  const deptTotal = deptProcessos.length;
                  const deptAndamento = deptProcessos.filter((p) => p.status === 'em_andamento').length;
                  const deptFin = deptProcessos.filter((p) => p.status === 'finalizado').length;
                  const deptAlta = deptProcessos.filter((p) => p.prioridade === 'alta').length;
                  const deptPct = deptTotal > 0 ? Math.round((deptFin / deptTotal) * 100) : 0;

                  return (
                    <tr
                      key={dept.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="py-3 px-2 font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: CORES_DEPARTAMENTOS[idx % CORES_DEPARTAMENTOS.length] }}
                          />
                          {dept.nome}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-gray-800 dark:text-gray-200">{deptTotal}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${deptAndamento > 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'text-gray-400'}`}>
                          {deptAndamento}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${deptFin > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'text-gray-400'}`}>
                          {deptFin}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold ${deptAlta > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'text-gray-400'}`}>
                          {deptAlta}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${deptPct}%`,
                                backgroundColor: deptPct >= 75 ? '#10b981' : deptPct >= 40 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-8">{deptPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fecha o container max-w-7xl */}
      </div>

      {/* ────────── SEÇÃO: Exclusões / Lixeira (largura total da página) ────────── */}
      {exclusoesData && exclusoesData.totalExcluidos >= 0 && (
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-10 shadow-lg border border-gray-100 dark:border-gray-700 w-full">
            {/* Header + botões de filtro */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-red-500 to-rose-600 p-3 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Análise de Exclusões</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {exclusoesData.totalExcluidos} processo{exclusoesData.totalExcluidos !== 1 ? 's' : ''} excluído{exclusoesData.totalExcluidos !== 1 ? 's' : ''}
                    {excFiltrosAtivos && <span className="ml-1 text-red-500 font-semibold">(filtrado)</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExcShowFiltros(!excShowFiltros)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${
                    excShowFiltros
                      ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  <Filter size={16} />
                  Filtros
                  {excFiltrosAtivos && (
                    <span className="bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>
                  )}
                </button>
                {excFiltrosAtivos && (
                  <button
                    onClick={resetarFiltrosExc}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all text-sm font-medium"
                  >
                    <RefreshCw size={14} />
                    Limpar
                  </button>
                )}
                {isAdmin && (exclusoesData?.totalExcluidos ?? 0) > 0 && (
                  <button
                    onClick={limparTodasExclusoes}
                    title="Apagar permanentemente todo o histórico de exclusões (admin)"
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-700 transition-all text-sm font-medium shadow-sm"
                  >
                    <XCircle size={14} />
                    Limpar Histórico
                  </button>
                )}
              </div>
            </div>

            {/* Painel de filtros de exclusão */}
            {excShowFiltros && (
              <div className="bg-red-50/50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/50 p-4 sm:p-6 mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Período */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Período
                    </label>
                    <div className="relative">
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={excPeriodo}
                        onChange={(e) => { setExcPeriodo(e.target.value); carregarExclusoes(e.target.value, excDeptId, excUsuarioId, excMotivo); }}
                        className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none"
                      >
                        <option value="todos">Todo o período</option>
                        <option value="7">Últimos 7 dias</option>
                        <option value="30">Últimos 30 dias</option>
                        <option value="90">Últimos 90 dias</option>
                        <option value="180">Últimos 6 meses</option>
                        <option value="365">Último ano</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Departamento */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Departamento
                    </label>
                    <div className="relative">
                      <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={excDeptId}
                        onChange={(e) => { setExcDeptId(e.target.value); carregarExclusoes(excPeriodo, e.target.value, excUsuarioId, excMotivo); }}
                        className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none"
                      >
                        <option value="todos">Todos os departamentos</option>
                        {(excDeptLista.length > 0 ? excDeptLista : departamentos).map((d) => (
                          <option key={d.id} value={d.id}>{d.nome}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Quem excluiu */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Excluído por
                    </label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <select
                        value={excUsuarioId}
                        onChange={(e) => { setExcUsuarioId(e.target.value); carregarExclusoes(excPeriodo, excDeptId, e.target.value, excMotivo); }}
                        className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none"
                      >
                        <option value="todos">Todos os usuários</option>
                        {excUsuariosLista.map((u) => (
                          <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Motivo */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Motivo
                    </label>
                    <div className="relative">
                      <AlertTriangle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        value={excMotivo}
                        onChange={(e) => { setExcMotivo(e.target.value); carregarExclusoes(excPeriodo, excDeptId, excUsuarioId, e.target.value); }}
                        className="w-full pl-10 pr-8 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none"
                      >
                        <option value="todos">Todos os motivos</option>
                        {excMotivosLista.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {excLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                <span className="ml-3 text-gray-500 dark:text-gray-400 text-sm">Carregando dados...</span>
              </div>
            )}

            {/* Conteúdo dos gráficos */}
            {!excLoading && exclusoesData && exclusoesData.totalExcluidos > 0 ? (
              <div className="space-y-10">
                {exclusoesData.motivosExclusao.length > 0 && (
                  <div className="w-full">
                    <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-5">Motivos de Exclusão</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Clique em um motivo para ver os processos e empresas envolvidos.</p>
                    <div className="space-y-5">
                      {exclusoesData.motivosExclusao.map((m, idx) => {
                        const pct = exclusoesData.totalExcluidos > 0 ? Math.round((m.count / exclusoesData.totalExcluidos) * 100) : 0;
                        const cores = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-rose-400', 'bg-pink-400'];
                        const expandido = motivoExpandido === m.motivo;
                        const itens = m.itens || [];
                        return (
                          <div key={m.motivo} className="border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-lg p-2 -mx-2 transition-colors">
                            <button
                              type="button"
                              onClick={() => setMotivoExpandido(expandido ? null : m.motivo)}
                              className="w-full text-left"
                            >
                              <div className="flex justify-between text-sm mb-2 gap-2 items-center">
                                <span className="text-gray-700 dark:text-gray-300 min-w-0 flex-1 flex items-center gap-1.5" title={m.motivo}>
                                  <ChevronDown size={14} className={`transition-transform flex-shrink-0 text-gray-400 ${expandido ? 'rotate-0' : '-rotate-90'}`} />
                                  {m.motivo}
                                </span>
                                <span className="text-gray-500 font-semibold whitespace-nowrap flex-shrink-0">{m.count} ({pct}%)</span>
                              </div>
                              <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className={`h-full ${cores[idx % cores.length]} rounded-full`} style={{ width: `${Math.max(pct, 2)}%` }} />
                              </div>
                            </button>
                            {expandido && itens.length > 0 && (
                              <div className="mt-3 ml-5 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                  <div className="col-span-6">Processo</div>
                                  <div className="col-span-4">Empresa</div>
                                  <div className="col-span-2 text-right">Excluído em</div>
                                </div>
                                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                                  {itens.map((it, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs items-center">
                                      <div className="col-span-6 text-gray-800 dark:text-gray-200 truncate" title={it.processoNome}>{it.processoNome}</div>
                                      <div className="col-span-4 text-gray-600 dark:text-gray-400 truncate" title={it.empresaNome || ''}>
                                        {it.empresaNome || <span className="italic text-gray-400">— sem empresa —</span>}
                                      </div>
                                      <div className="col-span-2 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {new Date(it.deletadoEm).toLocaleDateString('pt-BR')}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {exclusoesData.exclusoesPorMes.length > 0 && (
                  <div className="w-full">
                    <h4 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-5">Exclusões por Mês</h4>
                    <div className="flex items-end gap-3 sm:gap-6 px-2" style={{ height: '360px' }}>
                      {exclusoesData.exclusoesPorMes.map((m) => {
                        const maxVal = Math.max(...exclusoesData.exclusoesPorMes.map(x => x.count), 1);
                        const h = m.count > 0 ? Math.max((m.count / maxVal) * 100, 8) : 0;
                        return (
                          <div key={m.mes} className="flex-1 flex flex-col items-center justify-end gap-2 h-full min-w-0">
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{m.count}</span>
                            <div
                              className="w-full mx-auto bg-gradient-to-t from-red-500 to-rose-400 rounded-t-lg"
                              style={{ height: `${h}%`, minHeight: m.count > 0 ? '12px' : '0px' }}
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate w-full text-center font-medium">{m.mes}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Estado vazio (com filtros) */}
            {!excLoading && exclusoesData && exclusoesData.totalExcluidos === 0 && excFiltrosAtivos ? (
              <div className="text-center py-12">
                <XCircle size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Nenhuma exclusão encontrada</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Tente ajustar os filtros para ver resultados</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div></div>
  );
}
