'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, TrendingUp, Building, Clock, AlertCircle } from 'lucide-react';
import { useSistema } from '@/app/context/SistemaContext';

interface ModalAnalyticsProps {
  onClose: () => void;
}

export default function ModalAnalytics({ onClose }: ModalAnalyticsProps) {
  const { departamentos, processos } = useSistema();
  const [visualizacaoAtiva, setVisualizacaoAtiva] = useState("overview");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarAnalytics() {
      try {
        setLoading(true);
        const { api } = await import('@/app/utils/api');
        const data = await api.getAnalytics(30);
        setAnalyticsData(data);
      } catch (error) {
        console.error('Erro ao carregar análises:', error);
      } finally {
        setLoading(false);
      }
    }
    carregarAnalytics();
  }, []);

  // Processar dados reais ou usar fallback
  const analytics = useMemo(() => {
    if (!analyticsData) {
      return {
        metricasGerais: {
          totalProcessos: processos.length,
          processosFinalizados: processos.filter(p => p.status === 'finalizado').length,
          taxaSucesso: 0,
          tempoMedioTotal: 0
        },
        tempoMedioPorDepartamento: {},
        gargalos: [],
        taxaConclusaoMensal: {},
        performanceDepartamentos: {},
        previsaoConclusao: {}
      };
    }

    const processosFinalizados = processos.filter(p => p.status === 'finalizado').length;
    const taxaSucesso = processos.length > 0 ? Math.round((processosFinalizados / processos.length) * 100) : 0;

    const tempoMedioPorDepartamento: Record<string, number> = {};
    if (analyticsData.tempoMedioPorDepartamento) {
      analyticsData.tempoMedioPorDepartamento.forEach((item: any) => {
        tempoMedioPorDepartamento[item.departamento] = Math.round(item.tempoMedioDias * 10) / 10;
      });
    }

    const performanceDepartamentos: Record<number, any> = {};
    departamentos.forEach((dept) => {
      const processosDept = processos.filter(p => p.departamentoAtual === dept.id);
      const concluidos = processosDept.filter(p => p.status === 'finalizado').length;
      const tempoMedio = tempoMedioPorDepartamento[dept.nome] || 0;
      
      performanceDepartamentos[dept.id] = {
        nome: dept.nome,
        processosConcluidos: concluidos,
        tempoMedio: tempoMedio.toString(),
        eficiencia: processosDept.length > 0 ? Math.round((concluidos / processosDept.length) * 100) : 0
      };
    });

    return {
      metricasGerais: {
        totalProcessos: analyticsData.totalProcessos || processos.length,
        processosFinalizados: analyticsData.processosFinalizadosPeriodo || processosFinalizados,
        taxaSucesso: analyticsData.taxaConclusao || taxaSucesso,
        tempoMedioTotal: analyticsData.tempoMedioTotalDias || 0
      },
      tempoMedioPorDepartamento,
      gargalos: Object.entries(tempoMedioPorDepartamento)
        .map(([nome, tempo]) => ({
          departamento: nome,
          processos: processos.filter(p => {
            const dept = departamentos.find(d => d.nome === nome);
            return dept && p.departamentoAtual === dept.id;
          }).length,
          taxaGargalo: tempo
        }))
        .sort((a, b) => b.taxaGargalo - a.taxaGargalo)
        .slice(0, 5),
      taxaConclusaoMensal: {},
      performanceDepartamentos,
      previsaoConclusao: {}
    };
  }, [analyticsData, processos, departamentos]);

  const GraficoBarras = ({
    dados,
    titulo,
    cor = "from-cyan-500 to-blue-600",
  }: any) => {
    const maxValor = Math.max(
      ...Object.values(dados).map((val: any) =>
        typeof val === "number" ? val : val.tempoMedio || 0
      )
    );

    return (
      <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
        <h4 className="font-bold text-gray-800 mb-4">{titulo}</h4>
        <div className="space-y-3">
          {Object.entries(dados).map(([nome, valor]: any) => {
            const valorNumerico =
              typeof valor === "number" ? valor : valor.tempoMedio || 0;
            const porcentagem =
              maxValor > 0 ? (valorNumerico / maxValor) * 100 : 0;

            return (
              <div key={nome} className="flex items-center gap-3">
                <div className="w-32 text-sm text-gray-600 truncate">
                  {nome}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className={`bg-gradient-to-r ${cor} h-4 rounded-full transition-all duration-500`}
                      style={{ width: `${porcentagem}%` }}
                    ></div>
                  </div>
                </div>
                <div className="w-16 text-right text-sm font-semibold text-gray-700">
                  {typeof valor === "number"
                    ? `${valor}d`
                    : `${valor.tempoMedio}d`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <TrendingUp size={28} />
                Dashboard Análises
              </h3>
              <p className="text-white opacity-90 text-sm mt-1">
                Métricas e insights do seu fluxo de trabalho
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-4 mt-4">
            {[
              { id: "overview", label: "Visão Geral", icon: TrendingUp },
              { id: "departamentos", label: "Departamentos", icon: Building },
              { id: "previsoes", label: "Previsões", icon: Clock },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setVisualizacaoAtiva(item.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    visualizacaoAtiva === item.id
                      ? "bg-white text-cyan-600 shadow-lg"
                      : "text-white hover:bg-white hover:bg-opacity-20"
                  }`}
                >
                  <Icon size={16} className="inline mr-2" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando análises...</p>
            </div>
          )}
          {!loading && visualizacaoAtiva === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="text-2xl font-bold">
                    {analytics.metricasGerais?.totalProcessos || 0}
                  </div>
                  <div className="text-sm opacity-90">Total Processos</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="text-2xl font-bold">
                    {analytics.metricasGerais?.processosFinalizados || 0}
                  </div>
                  <div className="text-sm opacity-90">Concluídos</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="text-2xl font-bold">
                    {analytics.metricasGerais?.taxaSucesso || 0}%
                  </div>
                  <div className="text-sm opacity-90">Taxa Sucesso</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 shadow-lg">
                  <div className="text-2xl font-bold">
                    {analytics.metricasGerais?.tempoMedioTotal || 0}d
                  </div>
                  <div className="text-sm opacity-90">Tempo Médio</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GraficoBarras
                  dados={analytics.tempoMedioPorDepartamento}
                  titulo="Tempo Médio por Departamento (dias)"
                  cor="from-cyan-500 to-blue-600"
                />

                <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <AlertCircle size={20} className="text-amber-500" />
                    Principais Gargalos
                  </h4>
                  <div className="space-y-3">
                    {analytics.gargalos?.map((gargalo, index) => (
                      <div
                        key={gargalo.departamento}
                        className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-amber-800">
                              {gargalo.departamento}
                            </div>
                            <div className="text-xs text-amber-600">
                              {gargalo.processos} processos
                            </div>
                          </div>
                        </div>
                        <div className="text-amber-700 font-bold">
                          {gargalo.taxaGargalo.toFixed(1)}d
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4">
                  Taxa de Conclusão Mensal
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Object.entries(analytics.taxaConclusaoMensal || {}).map(
                    ([mes, quantidade]) => (
                      <div
                        key={mes}
                        className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-200"
                      >
                        <div className="text-2xl font-bold text-cyan-600">
                          {String(quantidade)}
                        </div>
                        <div className="text-sm text-cyan-700">{mes}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {visualizacaoAtiva === "departamentos" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.entries(analytics.performanceDepartamentos || {}).map(
                  ([deptId, performance]: any) => (
                    <div
                      key={deptId}
                      className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
                          <Building size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800">
                            {performance.nome}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {performance.processosConcluidos} processos
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Tempo Médio:
                          </span>
                          <span className="font-semibold text-cyan-600">
                            {performance.tempoMedio}d
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Eficiência:
                          </span>
                          <span className="font-semibold text-green-600">
                            {Math.round(performance.eficiencia)}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${performance.eficiencia}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {visualizacaoAtiva === "previsoes" && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-purple-500" />
                  Previsão de Conclusão
                </h4>
                <div className="space-y-4">
                  {Object.entries(analytics.previsaoConclusao || {}).map(
                    ([processoId, previsao]: any) => (
                      <div
                        key={processoId}
                        className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200"
                      >
                        <div>
                          <div className="font-semibold text-purple-800">
                            {previsao.nomeEmpresa}
                          </div>
                          <div className="text-sm text-purple-600">
                            Previsão: {previsao.previsao}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              previsao.confianca > 70
                                ? "bg-green-100 text-green-700"
                                : previsao.confianca > 40
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {previsao.confianca}% confiança
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}