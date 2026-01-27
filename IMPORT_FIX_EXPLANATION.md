# 🔧 Correção: Erro "body stream already read"

## 🚨 Problema Identificado

O erro `Failed to execute 'text' on 'Response': body stream already read` ocorria porque o código estava tentando ler o corpo da resposta HTTP **múltiplas vezes**.

### ❌ Código Problemático (ANTES)

```typescript
// ❌ ERRADO: Lê o body múltiplas vezes
const response = await fetch('/api/import', { method: 'POST', body: formData });

// Primeira leitura
const contentType = response.headers.get('content-type');
if (!contentType?.includes('application/json')) {
  const text = await response.text(); // ⚠️ Lê o body
}

if (!response.ok) {
  const errorData = await response.json(); // ⚠️ Tenta ler novamente (ERRO!)
}

const text = await response.text(); // ⚠️ Tenta ler novamente (ERRO!)
```

**Por que isso falha?**
- O corpo de uma `Response` é um **stream** que só pode ser lido **uma vez**
- Após chamar `.text()`, `.json()`, ou `.blob()`, o stream é consumido
- Tentar ler novamente lança o erro: `body stream already read`

---

## ✅ Solução Implementada

### 1. Frontend (`page.tsx`)

**Leitura única do body:**

```typescript
// ✅ CORRETO: Lê o body apenas UMA vez
const response = await fetch('/api/import', {
  method: 'POST',
  body: formData,
  // NÃO definir Content-Type manualmente - o browser define automaticamente para FormData
});

// Verifica content-type SEM ler o body (usa apenas headers)
const contentType = response.headers.get('content-type');
const isJson = contentType?.includes('application/json');

let result;

if (!response.ok) {
  // Para erros, lê como JSON ou texto (apenas uma vez)
  if (isJson) {
    result = await response.json(); // ✅ Lê uma vez
    throw new Error(result.error || result.message);
  } else {
    const text = await response.text(); // ✅ Lê uma vez
    throw new Error(`Erro ${response.status}: ${text}`);
  }
} else {
  // Para sucesso, sempre espera JSON
  if (!isJson) {
    const text = await response.text(); // ✅ Lê uma vez
    throw new Error(`Resposta inválida: ${text}`);
  }
  
  result = await response.json(); // ✅ Lê uma vez
}
```

### 2. Backend (`route.ts`)

**Uso de `NextResponse.json()` para garantir JSON válido:**

```typescript
// ✅ CORRETO: Usa NextResponse.json() que garante JSON válido
export async function POST(request: NextRequest) {
  try {
    // Lê FormData apenas UMA vez
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    // Validações...
    
    // Processa importação...
    const result = await processImport(buffer, userId, storeId, fileName);
    
    // Retorna JSON usando NextResponse.json() (mais seguro)
    return NextResponse.json({
      success: true,
      message: result.message,
      marketplace: result.marketplace,
      orderCount: result.orderCount,
      skipped: result.skipped,
      totalProcessed: result.totalProcessed,
    }, { status: 200 });
    
  } catch (error: any) {
    // Sempre retorna JSON válido, mesmo em erro
    return NextResponse.json({
      success: false,
      error: error.message,
      message: `Erro: ${error.message}`,
    }, { status: 500 });
  }
}
```

---

## 📋 Boas Práticas para Evitar Este Erro

### ✅ DO (Faça)

1. **Leia o body apenas UMA vez:**
   ```typescript
   const data = await response.json(); // ✅ Uma única leitura
   ```

2. **Use `NextResponse.json()` no backend:**
   ```typescript
   return NextResponse.json({ data }, { status: 200 }); // ✅ Garante JSON válido
   ```

3. **Verifique headers ANTES de ler o body:**
   ```typescript
   const contentType = response.headers.get('content-type');
   if (contentType?.includes('application/json')) {
     const data = await response.json(); // ✅ Só lê se for JSON
   }
   ```

4. **Clone a resposta se precisar ler múltiplas vezes:**
   ```typescript
   const clonedResponse = response.clone();
   const text = await response.text();
   const json = await clonedResponse.json(); // ✅ Usa clone
   ```

### ❌ DON'T (Não Faça)

1. **Não leia o body múltiplas vezes:**
   ```typescript
   const text = await response.text(); // ❌ Primeira leitura
   const json = await response.json(); // ❌ ERRO! Body já foi lido
   ```

2. **Não use `JSON.stringify()` manualmente:**
   ```typescript
   // ❌ ERRADO
   return new NextResponse(JSON.stringify({ data }), {
     headers: { 'Content-Type': 'application/json' }
   });
   
   // ✅ CORRETO
   return NextResponse.json({ data });
   ```

3. **Não defina `Content-Type` manualmente para FormData:**
   ```typescript
   // ❌ ERRADO
   fetch('/api/upload', {
     method: 'POST',
     body: formData,
     headers: { 'Content-Type': 'multipart/form-data' } // ❌ Browser define automaticamente
   });
   
   // ✅ CORRETO
   fetch('/api/upload', {
     method: 'POST',
     body: formData, // ✅ Browser define Content-Type automaticamente
   });
   ```

---

## 🔍 Validações Adicionais Implementadas

### Frontend
- ✅ Validação de content-type antes de fazer parse
- ✅ Tratamento de erro com mensagens claras
- ✅ Validação de estrutura de resposta

### Backend
- ✅ Validação de arquivo (existência, extensão, tamanho)
- ✅ Validação de autenticação
- ✅ Validação de storeId
- ✅ Logs detalhados para debug
- ✅ Sempre retorna JSON válido, mesmo em erro

### Processamento
- ✅ Validação de buffer vazio
- ✅ Validação de planilha vazia
- ✅ Validação de dados normalizados
- ✅ Tratamento de erros individuais sem quebrar o processo

---

## 🎯 Resultado Final

- ✅ **Erro "body stream already read" resolvido**
- ✅ **Respostas sempre em JSON válido**
- ✅ **Validações robustas em todas as camadas**
- ✅ **Logs claros para debug**
- ✅ **Mensagens de erro descritivas**

---

## 📚 Referências

- [MDN: Response.body](https://developer.mozilla.org/en-US/docs/Web/API/Response/body)
- [Next.js: Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Fetch API: Body](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#body)
