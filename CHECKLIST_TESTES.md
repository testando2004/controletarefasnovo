# CHECKLIST DE TESTES - SISTEMA TRIAR

Use este checklist para verificar se todas as funcionalidades estao 100% funcionais.
Marque com [x] o que ja foi testado e esta OK, e anote problemas encontrados.

---

## 1. AUTENTICACAO E SESSAO

### Login
- [x] Login com email e senha validos funciona
- [x] Login com senha errada mostra erro adequado
- [x] Login com email inexistente mostra erro adequado
- [ ] Token JWT e gerado e armazenado no cookie
- [ ] Sessao persiste ao recarregar a pagina
- [ ] Logout limpa cookie e redireciona para login



### Recuperacao de Senha
- [x] "Esqueci minha senha" envia email com link
- [ ] Link de reset funciona e permite redefinir senha
- [ ] Senha antiga nao funciona apos reset
- [ ] Nova senha funciona apos reset

### Sessoes Ativas
- [ ] Sessao ativa e registrada com IP e user agent
- [ ] Admin consegue ver sessoes ativas de usuarios
- [ ] Ultima atividade e atualizada
NAO
---

## 2. CONTROLE DE ACESSO POR PERFIL

### ADMIN (ex: yasmin@triarcontabilidade.com.br)
- [ ] Tem acesso total ao sistema
- [ ] Pode criar/editar/excluir usuarios
- [ ] Pode criar/editar/excluir departamentos
- [ ] Pode ver todos os processos de todos os departamentos
- [ ] Pode avancar/voltar/finalizar qualquer processo
- [ ] Pode ver todos os logs de auditoria
- [ ] Pode ativar/desativar modo manutencao
- [ ] Pode fazer backup/restore

### ADMIN_DEPARTAMENTO
- [ ] Acesso limitado ao proprio departamento
- [ ] Pode gerenciar usuarios do departamento
- [ ] Pode ver processos do departamento
- [ ] NAO consegue ver processos de outros departamentos
- [ ] Pode criar departamentos (verificar se deveria)

### GERENTE
- [ ] Pode avancar processos do departamento
- [ ] Pode ver fila do departamento
- [ ] Pode responder questionarios
- [ ] Pode comentar em processos
- [ ] NAO pode alterar status diretamente
- [ ] NAO pode criar/editar usuarios
- [ ] NAO pode acessar painel admin

### USUARIO
- [ ] Pode ver processos atribuidos
- [ ] Pode responder questionarios
- [ ] Pode comentar
- [ ] NAO pode avancar processos
- [ ] NAO pode alterar status
- [ ] NAO pode criar/editar usuarios

### Testes Cruzados de Acesso
- [ ] USUARIO nao consegue acessar rotas de admin via URL direta
- [ ] GERENTE nao consegue excluir processos
- [ ] ADMIN_DEPARTAMENTO nao ve dados de outros departamentos
- [ ] APIs retornam 403 para acessos nao autorizados

---

## 3. PROCESSOS (SOLICITACOES)

### Criacao
- [ ] Criar processo com todos os campos obrigatorios
- [ ] Criar processo como rascunho (RASCUNHO)
- [ ] Selecionar empresa vinculada
- [ ] Definir prioridade (ALTA, MEDIA, BAIXA)
- [ ] Definir fluxo de departamentos (sequencia)
- [ ] Criar a partir de template funciona
- [ ] Duplicar processo existente funciona

### Status e Transicoes
- [ ] Processo inicia como EM_ANDAMENTO (ou RASCUNHO)
- [ ] Pausar processo (EM_ANDAMENTO -> PAUSADO) funciona
- [ ] Retomar processo (PAUSADO -> EM_ANDAMENTO) funciona
- [ ] Cancelar processo (-> CANCELADO) funciona
- [ ] Finalizar processo (-> FINALIZADO) funciona
- [ ] NAO permite transicoes invalidas (ex: CANCELADO -> EM_ANDAMENTO)

### Fluxo entre Departamentos
- [ ] Avancar para proximo departamento funciona
- [ ] Voltar para departamento anterior funciona
- [ ] Indice do departamento atual atualiza corretamente
- [ ] Historico de fluxo (HistoricoFluxo) e registrado
- [ ] Checklist do departamento e verificado antes de avancar

### Progresso
- [ ] Barra de progresso (0-100%) atualiza corretamente
- [ ] Progresso reflete a posicao no fluxo de departamentos

### Responsabilidade
- [ ] Atribuir responsavel funciona
- [ ] Filtrar por responsavel funciona

### Favoritos
- [ ] Marcar processo como favorito funciona
- [ ] Desmarcar favorito funciona
- [ ] Lista de favoritos mostra corretamente

### Tags
- [ ] Adicionar tag ao processo funciona
- [ ] Remover tag funciona
- [ ] Filtrar por tag funciona

---

## 4. SOLICITACOES EM PARALELO (deptIndependente)

- [ ] Criar processo com modo departamento independente (paralelo)
- [ ] Multiplos departamentos podem trabalhar simultaneamente
- [ ] Cada departamento tem seu proprio checklist separado
- [ ] Cada departamento pode completar independentemente
- [ ] Processo so finaliza quando TODOS departamentos completam
- [ ] Historico mostra acoes de cada departamento separadamente
- [ ] Departamentos nao bloqueiam uns aos outros

---

## 5. INTERLIGACOES (ENCADEAMENTO DE PROCESSOS)

### Fluxo Sequencial
- [ ] Ao finalizar processo A, processo B e criado automaticamente
- [ ] Processo B herda dados corretos do processo A
- [ ] processoOrigemId e preenchido corretamente
- [ ] Cadeia de processos e visivel no historico

### Templates de Interligacao
- [ ] Criar fluxo de interligacao (FluxoInterligacao) funciona
- [ ] Editar fluxo salvo funciona
- [ ] Excluir fluxo funciona
- [ ] Usar fluxo salvo ao criar processo funciona
- [ ] interligacaoTemplateIds armazena IDs corretos

### Verificacoes
- [ ] Processo interligado mostra referencia ao processo de origem
- [ ] NAO cria duplicatas de processos interligados
- [ ] Cancelar processo origem NAO cria interligados

---

## 6. VISIBILIDADE DE DOCUMENTOS

### Upload
- [ ] Upload de documento funciona (ate 10MB)
- [ ] Arquivo acima de 10MB e rejeitado com mensagem clara
- [ ] Limite de 50 documentos por processo e respeitado
- [ ] Tipos de arquivo validos sao aceitos

### Niveis de Visibilidade
- [ ] **PUBLIC**: Todos os usuarios autenticados veem o documento
- [ ] **ROLES**: Apenas usuarios com os perfis selecionados veem
- [ ] **USERS**: Apenas usuarios especificos selecionados veem
- [ ] **DEPARTAMENTOS**: Apenas usuarios dos departamentos selecionados veem
- [ ] **NONE**: Apenas quem fez upload e admin veem

### Testes Cruzados de Visibilidade
- [ ] Usuario A (USUARIO) NAO ve documento com visibilidade ROLES=[ADMIN]
- [ ] Usuario B (GERENTE) ve documento com visibilidade ROLES=[GERENTE]
- [ ] Usuario C de outro departamento NAO ve documento DEPARTAMENTOS=[Dept X]
- [ ] Documento PUBLIC aparece para todos
- [ ] Documento NONE so aparece para uploader e admin
- [ ] Quem fez upload SEMPRE ve o documento (independente da visibilidade)
- [ ] ADMIN SEMPRE ve todos os documentos

### Documentos de Empresa
- [ ] Upload de documento na empresa funciona
- [ ] Alerta de vencimento (30 dias) aparece corretamente
- [ ] Documento vencido e destacado visualmente
- [ ] Visibilidade de documentos de empresa funciona igual

### Exclusao de Documentos
- [ ] Excluir documento funciona
- [ ] Documento vai para lixeira (soft delete)
- [ ] Restaurar documento da lixeira funciona
- [ ] Visibilidade original e restaurada ao recuperar

---

## 7. QUESTIONARIOS

### Configuracao
- [ ] Criar questionario para departamento funciona
- [ ] Editar perguntas existentes funciona
- [ ] Excluir perguntas funciona
- [ ] Ordenar perguntas funciona
- [ ] Vincular questionario a processo especifico funciona

### Tipos de Campo (testar cada um)
- [ ] TEXT - campo de texto simples
- [ ] TEXTAREA - campo de texto multilinha
- [ ] NUMBER - aceita apenas numeros
- [ ] DATE - seletor de data funciona
- [ ] BOOLEAN - checkbox sim/nao funciona
- [ ] SELECT - dropdown com opcoes funciona
- [ ] CHECKBOX - multipla selecao funciona
- [ ] FILE - upload de arquivo via campo funciona
- [ ] PHONE - mascara de telefone brasileiro funciona
- [ ] EMAIL - validacao de email funciona
- [ ] CPF - mascara e validacao de CPF funciona
- [ ] CNPJ - mascara e validacao de CNPJ funciona
- [ ] CEP - mascara de CEP funciona
- [ ] MONEY - mascara de moeda BRL funciona
- [ ] GRUPO_REPETIVEL - grupo repetivel funciona

### Grupo Repetivel (GRUPO_REPETIVEL)
- [ ] Sub-perguntas aparecem dentro do grupo
- [ ] Modo "numero" (controladoPor) cria N repeticoes automaticamente
- [ ] Modo "manual" permite adicionar/remover repeticoes
- [ ] Respostas de cada repeticao sao salvas corretamente
- [ ] IDs de sub-perguntas sao unicos (BigInt)

### Campos Condicionais
- [ ] Campo condicional aparece apenas quando condicao e atendida
- [ ] Operador "igual" funciona
- [ ] Operador "diferente" funciona
- [ ] Operador "contem" funciona
- [ ] Campo condicional some quando resposta muda

### Respostas
- [ ] Salvar respostas funciona
- [ ] Respostas sao carregadas ao reabrir o processo
- [ ] Editar respostas ja salvas funciona
- [ ] Respondente e registrado corretamente
- [ ] Timestamp de resposta e registrado
- [ ] Constraint unico (processoId + questionarioId) funciona

---

## 8. COMENTARIOS

- [ ] Criar comentario em processo funciona
- [ ] Editar comentario proprio funciona
- [ ] Excluir comentario proprio funciona
- [ ] Responder comentario (reply aninhado) funciona
- [ ] Mencao de usuario (@usuario) funciona
- [ ] Mencao gera notificacao para o mencionado
- [ ] Indicador "editado" aparece apos edicao
- [ ] Paginacao de comentarios funciona (20 por pagina)
- [ ] Comentarios filtrados por departamento funciona

---

## 9. HISTORICO E LOGS

### Historico do Processo (HistoricoEvento)
- [ ] Evento INICIO registrado ao criar processo
- [ ] Evento ALTERACAO registrado ao editar campos
- [ ] Evento MOVIMENTACAO registrado ao mudar departamento
- [ ] Evento CONCLUSAO registrado ao completar departamento
- [ ] Evento FINALIZACAO registrado ao finalizar processo
- [ ] Evento DOCUMENTO registrado ao anexar documento
- [ ] Evento COMENTARIO registrado ao comentar

### Timeline
- [ ] Timeline mostra eventos em ordem cronologica
- [ ] Cada evento mostra usuario, data e detalhes
- [ ] Timeline e visualmente clara e navegavel

### Log de Auditoria (LogAuditoria)
- [ ] Acoes CRIAR, EDITAR, EXCLUIR registradas
- [ ] Acoes AVANCAR, VOLTAR, FINALIZAR registradas
- [ ] Acoes PREENCHER, COMENTAR, ANEXAR registradas
- [ ] Acoes TAG, TRANSFERIR, INTERLIGAR registradas
- [ ] Acoes LOGIN/LOGOUT registradas
- [ ] Log registra IP do usuario
- [ ] Log registra campo alterado + valor antigo + valor novo
- [ ] Busca/filtro no painel de logs funciona
- [ ] Ghost user NAO gera logs (verificar)

### Soft Delete de Logs
- [ ] Logs podem ser "apagados" (soft delete)
- [ ] Motivo de exclusao e registrado
- [ ] Logs apagados nao aparecem na listagem padrao

---

## 10. EMPRESAS

- [ ] Criar empresa com CNPJ funciona
- [ ] Consulta automatica de CNPJ (API externa) funciona
- [ ] Editar dados da empresa funciona
- [ ] Excluir empresa funciona (verificar se vai para lixeira)
- [ ] Vincular processo a empresa funciona
- [ ] Listar documentos da empresa funciona
- [ ] Campos de inscricao estadual/municipal funcionam
- [ ] Campos de regime (federal, estadual, municipal) funcionam

---

## 11. DEPARTAMENTOS

- [ ] Criar departamento funciona
- [ ] Editar departamento (nome, cor, icone) funciona
- [ ] Desativar departamento funciona
- [ ] Reativar departamento funciona
- [ ] Ordenacao (ordem) e respeitada
- [ ] Documentos obrigatorios por departamento funciona
- [ ] Excluir departamento verifica dependencias

---

## 12. TEMPLATES

- [ ] Criar template funciona
- [ ] Editar template funciona
- [ ] Excluir template funciona
- [ ] Criar processo a partir de template funciona
- [ ] Template salva fluxo de departamentos corretamente
- [ ] Template salva campos customizados

---

## 13. CALENDARIO E EVENTOS

### Criacao
- [ ] Criar evento tipo processo_prazo funciona
- [ ] Criar evento tipo solicitacao funciona
- [ ] Criar evento tipo obrigacao_fiscal funciona
- [ ] Criar evento tipo documento_vencimento funciona
- [ ] Criar evento tipo reuniao funciona
- [ ] Criar evento tipo lembrete funciona
- [ ] Criar evento tipo feriado funciona

### Gerenciamento
- [ ] Editar evento funciona
- [ ] Excluir evento funciona
- [ ] Marcar como concluido funciona
- [ ] Status atrasado aparece automaticamente

### Recorrencia
- [ ] Evento unico (sem recorrencia) funciona
- [ ] Recorrencia diaria funciona
- [ ] Recorrencia semanal funciona
- [ ] Recorrencia mensal funciona
- [ ] Recorrencia anual funciona

### Alertas
- [ ] Alerta de evento proximo funciona
- [ ] Evento privado so aparece para o criador
- [ ] Evento publico aparece para todos

---

## 14. NOTIFICACOES

- [ ] Notificacao de sucesso aparece corretamente
- [ ] Notificacao de erro aparece corretamente
- [ ] Notificacao de info aparece corretamente
- [ ] Notificacao de aviso aparece corretamente
- [ ] Marcar notificacao como lida funciona
- [ ] Excluir notificacao funciona
- [ ] Contador de nao lidas atualiza

---

## 15. LIXEIRA (SOFT DELETE)

- [ ] Itens excluidos vao para lixeira
- [ ] Listar itens na lixeira funciona
- [ ] Restaurar item da lixeira funciona
- [ ] Exclusao permanente funciona
- [ ] Auto-limpeza apos 15 dias funciona
- [ ] Permissoes originais sao restauradas ao recuperar
- [ ] Filtro por tipo de item funciona
- [ ] Apenas quem tem permissao ve itens na lixeira

---

## 16. ADMIN E SISTEMA

### Modo Manutencao
- [ ] Ativar modo manutencao funciona
- [ ] Sistema mostra mensagem de manutencao para usuarios
- [ ] Admin continua acessando normalmente
- [ ] Desativar modo manutencao funciona

### Backup/Restore
- [ ] Gerar backup funciona
- [ ] Restaurar backup funciona
- [ ] Backup inclui todos os dados necessarios

### Gerenciamento de Usuarios
- [ ] Criar usuario funciona
- [ ] Editar usuario funciona
- [ ] Desativar usuario funciona
- [ ] Reativar usuario funciona
- [ ] Alterar perfil do usuario funciona
- [ ] Alterar departamento do usuario funciona
- [ ] Master user (Yasmin) pode editar/excluir admins

---

## 17. EMAIL (SMTP)

- [ ] Email de verificacao 2FA e enviado
- [ ] Email de recuperacao de senha e enviado
- [ ] Emails chegam corretamente (verificar caixa de entrada)
- [ ] Template do email esta formatado corretamente
- [ ] Remetente aparece correto

---

## 18. INTERFACE E UX

### Responsividade
- [ ] Dashboard funciona em desktop
- [ ] Dashboard funciona em tablet
- [ ] Dashboard funciona em mobile
- [ ] Modais abrem/fecham corretamente
- [ ] Scroll funciona em listas longas

### Funcionalidades da Interface
- [ ] Filtros de processos funcionam (status, prioridade, departamento)
- [ ] Busca por texto funciona
- [ ] Ordenacao funciona
- [ ] Paginacao funciona
- [ ] Drag-and-drop de documentos funciona
- [ ] Atalhos de teclado funcionam
- [ ] Deteccao de alteracoes nao salvas funciona

### Exportacao
- [ ] Exportar para PDF funciona
- [ ] PDF contem dados corretos e formatados

---

## 19. REAL-TIME (SUPABASE)

- [ ] Atualizacoes em tempo real de processos funciona
- [ ] Notificacoes em tempo real funciona
- [ ] Comentarios em tempo real funciona
- [ ] Reconexao automatica apos perda de conexao

---

## 20. PERFORMANCE E ESTABILIDADE

- [ ] Sistema carrega em tempo aceitavel
- [ ] Cache de usuario (60s TTL) funciona
- [ ] Connection pooling funciona (sem erros de conexao)
- [ ] IndexedDB armazena dados offline corretamente
- [ ] Sistema nao trava com muitos processos
- [ ] Paginacao de processos (50 por pagina) funciona

---

## REGISTRO DE PROBLEMAS ENCONTRADOS

| # | Data | Area | Descricao do Problema | Severidade | Status |
|---|------|------|-----------------------|------------|--------|
| 1 |      |      |                       |            |        |
| 2 |      |      |                       |            |        |
| 3 |      |      |                       |            |        |
