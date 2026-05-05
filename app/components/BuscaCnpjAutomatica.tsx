'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Search, Loader2, X, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/app/utils/api';
import { useSistema } from '@/app/context/SistemaContext';

interface BuscaCnpjAutomaticaProps {
  onConcluido?: () => void;
}

export default function BuscaCnpjAutomatica({ onConcluido }: BuscaCnpjAutomaticaProps) {
  const { empresas, carregarEmpresas, mostrarAlerta } = useSistema();

  const [buscando, setBuscando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, sucesso: 0, erro: 0, pulados: 0, nomeAtual: '' });
  const abortarRef = useRef(false);

  // Filtra empresas cadastradas que têm CNPJ válido mas faltam dados (endereço, email, etc)
  const empresasParaBuscar = empresas.filter(emp => {
    const digits = String(emp.cnpj || '').replace(/\D/g, '');
    if (digits.length !== 14) return false;
    // Só busca se falta algum dado importante
    return !emp.cidade || !emp.estado || !emp.email || !emp.logradouro || !emp.bairro;
  });

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Consulta CNPJ com retry e backoff para lidar com rate limit
  const consultarComRetry = useCallback(async (cnpj: string, maxTentativas = 3): Promise<any> => {
    let tentativa = 0;
    let ultimoErro: any = null;

    while (tentativa < maxTentativas) {
      try {
        const data = await api.consultarCnpj(cnpj);
        // Checa se veio erro de rate limit no corpo da resposta
        if (data?.error && (data.error.includes('Limite') || data.error.includes('429'))) {
          throw new Error('RATE_LIMIT');
        }
        return data;
      } catch (err: any) {
        ultimoErro = err;
        tentativa++;
        if (tentativa < maxTentativas) {
          // Backoff exponencial: 20s, 40s, 80s
          const tempoEspera = 20000 * Math.pow(2, tentativa - 1);
          setProgresso(prev => ({ ...prev, nomeAtual: `Aguardando ${tempoEspera / 1000}s (tentativa ${tentativa + 1}/${maxTentativas})...` }));
          await delay(tempoEspera);
        }
      }
    }
    throw ultimoErro;
  }, []);

  const handleIniciar = async () => {
    if (empresasParaBuscar.length === 0) {
      void mostrarAlerta?.('Atenção', 'Todas as empresas já possuem dados completos ou não têm CNPJ válido.', 'aviso');
      return;
    }

    setBuscando(true);
    setConcluido(false);
    abortarRef.current = false;
    setProgresso({ atual: 0, total: empresasParaBuscar.length, sucesso: 0, erro: 0, pulados: 0, nomeAtual: '' });

    let sucesso = 0;
    let erro = 0;
    let pulados = 0;

    for (let i = 0; i < empresasParaBuscar.length; i++) {
      if (abortarRef.current) break;

      const emp = empresasParaBuscar[i];
      const cnpjDigits = String(emp.cnpj || '').replace(/\D/g, '');
      const nome = emp.razao_social || emp.apelido || cnpjDigits;

      setProgresso(prev => ({ ...prev, atual: i + 1, nomeAtual: nome }));

      try {
        const data = await consultarComRetry(cnpjDigits);

        if (data && data.razao_social && !data.error) {
          // Montar dados para atualizar (só preenche campos vazios)
          const atualizacao: any = { cadastrada: true };
          let temAlgo = false;

          if (!emp.apelido?.trim() && data.nome_fantasia) { atualizacao.apelido = data.nome_fantasia; temAlgo = true; }
          if (!emp.estado?.trim() && data.estado) { atualizacao.estado = data.estado; temAlgo = true; }
          if (!emp.cidade?.trim() && data.cidade) { atualizacao.cidade = data.cidade; temAlgo = true; }
          if (!emp.bairro?.trim() && data.bairro) { atualizacao.bairro = data.bairro; temAlgo = true; }
          if (!emp.logradouro?.trim() && data.logradouro) { atualizacao.logradouro = data.logradouro; temAlgo = true; }
          if (!emp.numero?.trim() && data.numero) { atualizacao.numero = data.numero; temAlgo = true; }
          if (!emp.cep?.trim() && data.cep) { atualizacao.cep = data.cep; temAlgo = true; }
          if (!emp.email?.trim() && data.email) { atualizacao.email = data.email; temAlgo = true; }
          if (!emp.telefone?.trim() && data.telefone) { atualizacao.telefone = data.telefone; temAlgo = true; }
          if (!emp.data_abertura && data.data_abertura) { atualizacao.data_abertura = data.data_abertura; temAlgo = true; }

          if (temAlgo) {
            await api.atualizarEmpresa(emp.id, atualizacao);
            sucesso++;
          } else {
            pulados++;
          }
        } else {
          erro++;
        }
      } catch {
        erro++;
      }

      setProgresso(prev => ({ ...prev, sucesso, erro, pulados }));

      // Delay de 6 segundos entre chamadas para evitar rate limit
      if (i < empresasParaBuscar.length - 1 && !abortarRef.current) {
        setProgresso(prev => ({ ...prev, nomeAtual: 'Aguardando para próxima consulta...' }));
        await delay(6000);
      }
    }

    setBuscando(false);
    setConcluido(true);

    if (typeof carregarEmpresas === 'function') {
      await carregarEmpresas();
    }

    onConcluido?.();
  };

  // Se não tem empresas para buscar e não está buscando, não mostra nada
  if (empresasParaBuscar.length === 0 && !buscando && !concluido) return null;

  // Componente flutuante no canto inferior direito
  return (
    <div className="fixed bottom-4 right-4 z-[9999]" style={{ maxWidth: minimizado ? '250px' : '420px' }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div
          className="bg-gradient-to-r from-green-500 to-green-600 px-4 py-2 flex items-center justify-between cursor-pointer"
          onClick={() => setMinimizado(!minimizado)}
        >
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <Search className="w-4 h-4" />
            {buscando ? `Buscando CNPJs (${progresso.atual}/${progresso.total})` : concluido ? 'Busca Concluída' : `Buscar CNPJs (${empresasParaBuscar.length})`}
          </div>
          <div className="flex items-center gap-1">
            {buscando && (
              <button
                onClick={(e) => { e.stopPropagation(); abortarRef.current = true; }}
                className="text-white hover:bg-white/20 p-1 rounded text-xs"
                title="Parar busca"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            {concluido && (
              <button
                onClick={(e) => { e.stopPropagation(); setConcluido(false); }}
                className="text-white hover:bg-white/20 p-1 rounded"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {!minimizado && (
          <div className="p-4 space-y-3">
            {/* Não iniciado */}
            {!buscando && !concluido && (
              <>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {empresasParaBuscar.length} empresa(s) com CNPJ válido sem dados completos. Buscar endereço, telefone e email automaticamente?
                </p>
                <button
                  onClick={handleIniciar}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Search className="w-4 h-4" />
                  Iniciar Busca Automática
                </button>
              </>
            )}

            {/* Buscando */}
            {buscando && (
              <>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progresso.total > 0 ? (progresso.atual / progresso.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={progresso.nomeAtual}>
                  <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
                  {progresso.nomeAtual}
                </p>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600">{progresso.sucesso} atualizadas</span>
                  <span className="text-gray-400">{progresso.pulados} sem novidade</span>
                  <span className="text-red-500">{progresso.erro} erros</span>
                </div>
              </>
            )}

            {/* Concluído */}
            {concluido && (
              <>
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Busca finalizada!
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600">{progresso.sucesso} atualizadas</span>
                  <span className="text-gray-400">{progresso.pulados} sem novidade</span>
                  <span className="text-red-500">{progresso.erro} erros</span>
                </div>
                {empresasParaBuscar.length > 0 && (
                  <button
                    onClick={handleIniciar}
                    className="w-full px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 transition-all"
                  >
                    Buscar novamente
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
