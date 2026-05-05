/**
 * Sistema de Exportação de Relatórios em PDF
 * Gera relatórios completos de processos com todas as informações
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProcessoParaExportar {
  id: number;
  nomeServico?: string;
  nome?: string;
  nomeEmpresa: string;
  cliente?: string;
  email?: string;
  telefone?: string;
  status: string;
  prioridade: string;
  criadoEm: Date | string;
  dataInicio?: Date | string;
  dataEntrega?: Date | string;
  dataFinalizacao?: Date | string;
  descricao?: string;
  departamentoAtual?: number;
  respostasHistorico?: any;
  documentos?: any[];
  historicoEvento?: any[];
  historico?: any[];
  tagsMetadata?: any[];
  responsavel?: { nome: string; email: string };
  criadoPor?: { nome: string; email: string };
}

interface DepartamentoInfo {
  id: number;
  nome: string;
  responsavel?: string;
}

/**
 * Formata data para o padrão brasileiro
 */
function formatarData(data?: Date | string | null): string {
  if (!data) return 'N/A';
  const d = new Date(data);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
}

/**
 * Formata data e hora para o padrão brasileiro
 */
function formatarDataHora(data?: Date | string | null): string {
  if (!data) return 'N/A';
  const d = new Date(data);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Adiciona cabeçalho personalizado
 */
function adicionarCabecalho(doc: jsPDF, titulo: string, subtitulo?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Fundo do cabeçalho
  doc.setFillColor(34, 197, 94); // Verde
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 15, 20);
  
  // Subtítulo
  if (subtitulo) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitulo, 15, 30);
  }
  
  // Data de geração
  doc.setFontSize(10);
  const dataGeracao = `Gerado em: ${formatarDataHora(new Date())}`;
  doc.text(dataGeracao, pageWidth - 15, 30, { align: 'right' });
  
  doc.setTextColor(0, 0, 0);
  return 45; // Retorna a posição Y após o cabeçalho
}

/**
 * Adiciona rodapé com numeração
 */
function adicionarRodape(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
}

/**
 * Exporta processo completo em PDF
 */
export async function exportarProcessoPDF(
  processo: ProcessoParaExportar,
  departamentos: DepartamentoInfo[]
): Promise<void> {
  const doc = new jsPDF();
  
  // Cabeçalho
  let yPos = adicionarCabecalho(
    doc,
    'Relatório do Processo',
    `${processo.nomeServico || processo.nome || 'Processo'} - ${processo.nomeEmpresa}`
  );
  
  yPos += 10;
  
  // Seção: Informações Gerais
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('Informacoes Gerais', 15, yPos);
  yPos += 8;
  
  const infoGeral = [
    ['ID do Processo', `#${processo.id}`],
    ['Servico', processo.nomeServico || processo.nome || 'N/A'],
    ['Empresa', processo.nomeEmpresa],
    ['Status', processo.status.toUpperCase()],
    ['Prioridade', processo.prioridade.toUpperCase()],
    ['Data de Criacao', formatarData(processo.criadoEm)],
    ['Data de Inicio', formatarData(processo.dataInicio)],
  ];
  
  // Se estiver finalizado, mostra data de finalização
  const statusLower = String(processo.status || '').toLowerCase();
  if (statusLower === 'finalizado') {
    // Usar dataFinalizacao se existir, senão usar dataAtualizacao
    const dataFim = processo.dataFinalizacao || (processo as any).dataAtualizacao;
    infoGeral.push(['Data de Finalizacao', formatarData(dataFim)]);
  } else {
    // Se não estiver finalizado, mostra prazo de entrega
    infoGeral.push(['Prazo de Entrega', formatarData(processo.dataEntrega)]);
  }
  
  // Adicionar e-mail e telefone apenas se existirem
  if (processo.email && processo.email.trim()) {
    infoGeral.push(['E-mail', processo.email]);
  }
  
  if (processo.telefone && processo.telefone.trim()) {
    infoGeral.push(['Telefone', processo.telefone]);
  }
  
  if (processo.responsavel) {
    infoGeral.push(['Responsavel', `${processo.responsavel.nome} (${processo.responsavel.email})`]);
  }
  
  if (processo.criadoPor) {
    infoGeral.push(['Criado por', `${processo.criadoPor.nome} (${processo.criadoPor.email})`]);
  }
  
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: infoGeral,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' }
    },
    margin: { left: 15, right: 15 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // Descrição (se houver)
  if (processo.descricao) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('Descricao', 15, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const descricaoLinhas = doc.splitTextToSize(processo.descricao, 180);
    doc.text(descricaoLinhas, 15, yPos);
    yPos += descricaoLinhas.length * 5 + 10;
  }
  
  // Tags (se houver)
  if (processo.tagsMetadata && processo.tagsMetadata.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('Tags', 15, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const tags = processo.tagsMetadata.map(t => t.nome).join(', ');
    doc.text(tags, 15, yPos);
    yPos += 10;
  }
  
  // Nova página para questionários
  doc.addPage();
  yPos = adicionarCabecalho(doc, 'Questionarios e Respostas', processo.nomeEmpresa);
  yPos += 10;
  
  // Questionários por Departamento
  const respostasPorDept = processo.respostasHistorico || {};
  const departamentosVisiveis = departamentos.filter(dept => 
    respostasPorDept[dept.id] && 
    Array.isArray(respostasPorDept[dept.id].questionario) &&
    respostasPorDept[dept.id].questionario.length > 0
  );
  
  if (departamentosVisiveis.length > 0) {
    departamentosVisiveis.forEach((dept, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      // Nome do departamento
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text(`${dept.nome}`, 15, yPos);
      yPos += 8;
      
      if (dept.responsavel) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(128, 128, 128);
        doc.text(`Responsavel: ${dept.responsavel}`, 15, yPos);
        yPos += 8;
      }
      
      const respostasDept = respostasPorDept[dept.id];
      const questionario = respostasDept.questionario || [];
      const respostas = respostasDept.respostas || {};
      
      const dadosTabela: any[] = [];
      
      questionario.forEach((pergunta: any) => {
        let resposta = respostas[pergunta.id];
        
        if (pergunta.tipo === 'file') {
          resposta = 'Arquivo anexado (ver seção de documentos)';
        }
        
        if (resposta !== undefined && resposta !== null && String(resposta).trim() !== '') {
          dadosTabela.push([
            pergunta.label,
            String(resposta)
          ]);
        }
      });
      
      if (dadosTabela.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Pergunta', 'Resposta']],
          body: dadosTabela,
          theme: 'striped',
          styles: { fontSize: 9, cellPadding: 4 },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 70 },
            1: { cellWidth: 'auto' }
          },
          margin: { left: 15, right: 15 },
          headStyles: { fillColor: [34, 197, 94] },
        });
        
        yPos = (doc as any).lastAutoTable.finalY + 12;
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(128, 128, 128);
        doc.text('Nenhuma resposta registrada', 15, yPos);
        yPos += 12;
      }
    });
  } else {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text('Nenhum questionário respondido', 15, yPos);
  }
  
  // Nova página para documentos
  doc.addPage();
  yPos = adicionarCabecalho(doc, 'Documentos Anexados', processo.nomeEmpresa);
  yPos += 10;
  
  const documentos = processo.documentos || [];
  
  if (documentos.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('Lista de Documentos', 15, yPos);
    yPos += 8;
    
    const dadosDocumentos = documentos.map((doc: any, index: number) => [
      `${index + 1}`,
      doc.nome || 'Sem nome',
      doc.tipo || 'Geral',
      ((doc.tamanho || 0) / 1024 / 1024).toFixed(2) + ' MB',
      formatarDataHora(doc.dataUpload)
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Nome do Arquivo', 'Tipo', 'Tamanho', 'Data de Upload']],
      body: dadosDocumentos,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 70 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 40 }
      },
      margin: { left: 15, right: 15 },
      headStyles: { fillColor: [34, 197, 94] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text('Nenhum documento anexado', 15, yPos);
  }
  
  // Nova página para histórico
  doc.addPage();
  yPos = adicionarCabecalho(doc, 'Historico de Eventos', processo.nomeEmpresa);
  yPos += 10;
  
  const historico = (processo.historicoEvento || processo.historico || []) as any[];
  
  if (historico.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 197, 94);
    doc.text('Timeline de Eventos', 15, yPos);
    yPos += 8;
    
    const dadosHistorico = historico.map((evento: any) => [
      formatarDataHora(evento.data),
      evento.tipo || 'N/A',
      evento.acao || 'N/A',
      evento.responsavel?.nome || evento.responsavel || 'Sistema',
      evento.departamento || '-'
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Data/Hora', 'Tipo', 'Ação', 'Responsável', 'Departamento']],
      body: dadosHistorico,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 65 },
        3: { cellWidth: 35 },
        4: { cellWidth: 30 }
      },
      margin: { left: 15, right: 15 },
      headStyles: { fillColor: [34, 197, 94] },
    });
  } else {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(128, 128, 128);
    doc.text('Nenhum evento registrado no histórico', 15, yPos);
  }
  
  // Adicionar rodapé com numeração
  adicionarRodape(doc);
  
  // Salvar PDF
  const nomeArquivo = `Relatorio_Processo_${processo.id}_${processo.nomeEmpresa.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  doc.save(nomeArquivo);
}

/**
 * Exporta lista de processos (resumido)
 */
export async function exportarListaProcessosPDF(
  processos: ProcessoParaExportar[],
  filtros?: { status?: string; departamento?: string }
): Promise<void> {
  const doc = new jsPDF();
  
  let subtitulo = 'Lista de Todos os Processos';
  if (filtros?.status) subtitulo += ` - Status: ${filtros.status}`;
  if (filtros?.departamento) subtitulo += ` - Depto: ${filtros.departamento}`;
  
  const yPos = adicionarCabecalho(doc, 'Relatório de Processos', subtitulo);
  
  const dadosProcessos = processos.map((p, index) => [
    `${index + 1}`,
    `#${p.id}`,
    p.nomeEmpresa,
    p.nomeServico || p.nome || 'N/A',
    p.status.toUpperCase(),
    p.prioridade.toUpperCase(),
    formatarData(p.criadoEm)
  ]);
  
  autoTable(doc, {
    startY: yPos + 10,
    head: [['#', 'ID', 'Empresa', 'Serviço', 'Status', 'Prioridade', 'Criado em']],
    body: dadosProcessos,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 15 },
      2: { cellWidth: 50 },
      3: { cellWidth: 45 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
      6: { cellWidth: 25 }
    },
    margin: { left: 15, right: 15 },
    headStyles: { fillColor: [34, 197, 94] },
  });
  
  adicionarRodape(doc);
  
  const nomeArquivo = `Relatorio_Processos_${formatarData(new Date()).replace(/\//g, '-')}.pdf`;
  doc.save(nomeArquivo);
}
