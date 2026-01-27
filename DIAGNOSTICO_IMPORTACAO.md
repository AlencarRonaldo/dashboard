# 🔍 Diagnóstico de Importação de Dados

## 🚨 Problema Reportado
Os dados não estão sendo migrados para o banco de dados via sistema.

## ✅ Correções Implementadas

### 1. **Cliente Supabase Corrigido**
- ✅ `saveDataToDatabase` agora recebe o cliente Supabase como parâmetro
- ✅ Garante que o mesmo cliente (com cookies corretos) é usado em toda a cadeia
- ✅ Evita problemas de autenticação

### 2. **Extração de Dados Corrigida**
- ✅ Cabeçalho agora é extraído corretamente
- ✅ Parsers recebem o cabeçalho na primeira linha
- ✅ Logs detalhados em cada etapa

### 3. **Logs Melhorados**
- ✅ Logs em cada etapa do processamento
- ✅ Erros detalhados com código, mensagem e hints
- ✅ Resumo final da importação

### 4. **Tratamento de Erros RLS**
- ✅ Detecção de erros de permissão (RLS)
- ✅ Mensagens claras sobre problemas de política
- ✅ Continua processando mesmo com erros individuais

---

## 🔍 Como Verificar se os Dados Estão Sendo Salvos

### **Opção 1: Via Interface Web**
1. Acesse `/history`
2. Verifique se há imports listados
3. Clique em um import para ver detalhes
4. Verifique quantos pedidos foram importados

### **Opção 2: Via Logs do Servidor**
Verifique o terminal onde o Next.js está rodando. Você deve ver:

```
[API /api/import] Iniciando processamento...
[API /api/import] Usuário autenticado: <user-id>
[processImport] Marketplace detectado: shein, 50 pedidos normalizados
[saveDataToDatabase] Loja criada com sucesso: <store-id>
[saveDataToDatabase] ✅ Pedido <order-id> completamente inserido. Total inserido: 1
[saveDataToDatabase] ========== RESUMO DA IMPORTAÇÃO ==========
[saveDataToDatabase] Inseridos: 50
[saveDataToDatabase] Ignorados (duplicados): 0
[saveDataToDatabase] Erros: 0
```

### **Opção 3: Via Script de Teste**
```bash
cd dashboard-analytics
npx tsx src/scripts/test-import-flow.ts
```

Este script verifica:
- ✅ Conexão com Supabase
- ✅ Marketplaces cadastrados
- ✅ Estrutura das tabelas
- ✅ Imports existentes
- ✅ Pedidos salvos

### **Opção 4: Via Supabase Dashboard**
1. Acesse o Supabase Dashboard
2. Vá em "Table Editor"
3. Verifique as tabelas:
   - `imports` - deve ter registros de importação
   - `stores` - deve ter lojas criadas
   - `orders` - deve ter pedidos
   - `order_items` - deve ter itens
   - `order_financials` - deve ter dados financeiros

---

## ⚠️ Possíveis Problemas e Soluções

### **Problema 1: Erro de Autenticação**
```
Erro: Unauthorized
```
**Causa**: Usuário não está autenticado  
**Solução**: 
- Verifique se está logado
- Verifique se os cookies estão sendo enviados
- Verifique se a sessão está válida

### **Problema 2: Erro de RLS (Row Level Security)**
```
Erro: new row violates row-level security policy
```
**Causa**: Políticas RLS estão bloqueando inserções  
**Solução**:
1. Verifique se as políticas RLS estão corretas no Supabase
2. Verifique se o `user_id` está correto
3. Verifique se a loja pertence ao usuário

**SQL para verificar políticas:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'orders';
```

### **Problema 3: Marketplace Não Encontrado**
```
Erro: Marketplace "shein" não encontrado
```
**Causa**: Marketplace não está cadastrado no banco  
**Solução**: Execute o SQL:
```sql
INSERT INTO marketplaces (name, display_name) 
VALUES ('shein', 'Shein')
ON CONFLICT (name) DO NOTHING;
```

### **Problema 4: Nenhum Dado Normalizado**
```
Erro: Nenhum pedido válido foi encontrado na planilha
```
**Causa**: Parser não conseguiu processar os dados  
**Solução**:
- Verifique se o arquivo tem o formato correto
- Verifique se o cabeçalho está correto
- Verifique os logs do parser

### **Problema 5: Todos os Pedidos Ignorados**
```
Inseridos: 0, Ignorados: 50
```
**Causa**: Todos os pedidos já existem no banco  
**Solução**: 
- Isso é normal se você já importou o arquivo antes
- Verifique se os `platform_order_id` estão corretos
- Verifique se a data está sendo comparada corretamente

---

## 📊 Verificação Passo a Passo

### **1. Verificar se a Importação Foi Executada**
```sql
SELECT id, file_name, status, created_at, finished_at, error_details
FROM imports
ORDER BY created_at DESC
LIMIT 10;
```

### **2. Verificar Pedidos Importados**
```sql
SELECT 
  o.id,
  o.platform_order_id,
  o.order_date,
  s.name as store_name,
  m.name as marketplace_name,
  of.revenue,
  of.profit
FROM orders o
JOIN stores s ON o.store_id = s.id
JOIN marketplaces m ON s.marketplace_id = m.id
LEFT JOIN order_financials of ON o.id = of.order_id
ORDER BY o.created_at DESC
LIMIT 20;
```

### **3. Verificar Estatísticas**
```sql
SELECT 
  COUNT(DISTINCT o.id) as total_pedidos,
  COUNT(DISTINCT s.id) as total_lojas,
  SUM(of.revenue) as total_receita,
  SUM(of.profit) as total_lucro
FROM orders o
JOIN stores s ON o.store_id = s.id
LEFT JOIN order_financials of ON o.id = of.order_id;
```

---

## 🔧 Debug Avançado

### **Ativar Logs Detalhados**
Os logs já estão ativados por padrão. Verifique o terminal do servidor.

### **Verificar Erros Específicos**
Se houver erros, verifique:
1. **Código do erro**: `error.code`
2. **Mensagem**: `error.message`
3. **Detalhes**: `error.details`
4. **Hint**: `error.hint`

### **Testar Inserção Manual**
```sql
-- Teste de inserção manual (substitua os valores)
INSERT INTO orders (store_id, import_id, platform_order_id, order_date)
VALUES (
  'store-id-aqui',
  'import-id-aqui',
  'TEST-ORDER-001',
  NOW()
)
RETURNING *;
```

---

## ✅ Checklist de Verificação

Antes de reportar problema, verifique:

- [ ] Usuário está autenticado
- [ ] Arquivo foi enviado corretamente
- [ ] Marketplace está cadastrado no banco
- [ ] Tabelas existem no banco
- [ ] Políticas RLS estão configuradas
- [ ] Logs do servidor não mostram erros
- [ ] Arquivo tem formato correto
- [ ] Cabeçalho do arquivo está correto

---

## 📞 Próximos Passos

1. **Execute uma importação** e verifique os logs
2. **Verifique o histórico** em `/history`
3. **Execute o script de teste** se necessário
4. **Verifique o Supabase Dashboard** para confirmar dados

Se ainda houver problemas, compartilhe:
- Logs completos do servidor
- Mensagem de erro exata
- Resultado do script de teste
- Screenshot do Supabase Dashboard
