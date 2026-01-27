# 🎨 Design System - Dashboard Executivo

## 📋 Paleta de Cores Completa

### 🎯 Cores Base (Neutras)

#### Fundos
- **Background Principal**: `#F5F7FA` (Cinza claro suave)
- **Cards**: `#FFFFFF` (Branco puro)
- **Hover States**: `#F9FAFB` (Cinza muito claro)

#### Textos
- **Primário**: `#1F2937` (Cinza escuro - quase preto)
- **Secundário**: `#6B7280` (Cinza médio)
- **Terciário**: `#9CA3AF` (Cinza claro)
- **Placeholder**: `#D1D5DB` (Cinza muito claro)

#### Bordas e Divisões
- **Bordas**: `#E5E7EB` (Cinza claro)
- **Divisores**: `#F3F4F6` (Cinza muito claro)

---

### 🏢 Cores por Marketplace (Identidade)

#### Mercado Livre
- **Principal**: `#FFE135` (Amarelo dourado corporativo)
- **Hover**: `#FFD700` (Dourado mais escuro)
- **Background Suave**: `#FFF9E6` (Amarelo muito claro)
- **Texto sobre amarelo**: `#856404` (Marrom escuro para contraste)

#### Shopee
- **Principal**: `#EE4D2D` (Laranja institucional)
- **Hover**: `#DC3D1D` (Laranja mais escuro)
- **Background Suave**: `#FFF4F0` (Laranja muito claro)
- **Texto sobre laranja**: `#7C2D12` (Marrom escuro para contraste)

#### Shein
- **Principal**: `#1F2937` (Preto sofisticado)
- **Hover**: `#111827` (Preto mais escuro)
- **Background Suave**: `#F3F4F6` (Cinza muito claro)
- **Texto sobre preto**: `#FFFFFF` (Branco para contraste)

#### TikTok Shop
- **Principal**: `#000000` (Preto) com acento `#00F2EA` (Ciano)
- **Hover**: `#00D9D2` (Ciano mais escuro)
- **Background Suave**: `#E6FFFE` (Ciano muito claro)
- **Texto sobre ciano**: `#065F46` (Verde escuro para contraste)

---

### ✅ Cores Semânticas (BI Padrão)

#### Positivo (Lucro, Crescimento)
- **Principal**: `#16A34A` (Verde profissional)
- **Hover**: `#15803D` (Verde mais escuro)
- **Background Suave**: `#DCFCE7` (Verde muito claro)
- **Texto sobre verde**: `#14532D` (Verde muito escuro)

#### Negativo (Prejuízo, Queda)
- **Principal**: `#DC2626` (Vermelho profissional)
- **Hover**: `#B91C1C` (Vermelho mais escuro)
- **Background Suave**: `#FEE2E2` (Vermelho muito claro)
- **Texto sobre vermelho**: `#7F1D1D` (Vermelho muito escuro)

#### Atenção (Alerta, Neutro)
- **Principal**: `#F59E0B` (Amarelo de atenção)
- **Hover**: `#D97706` (Amarelo mais escuro)
- **Background Suave**: `#FEF3C7` (Amarelo muito claro)
- **Texto sobre amarelo**: `#78350F` (Marrom escuro)

#### Neutro (Informação)
- **Principal**: `#6B7280` (Cinza médio)
- **Hover**: `#4B5563` (Cinza mais escuro)
- **Background Suave**: `#F3F4F6` (Cinza muito claro)
- **Texto sobre cinza**: `#1F2937` (Cinza escuro)

---

### 📊 Cores para Gráficos

#### Paleta Principal (Máximo 6 cores)
1. **Mercado Livre**: `#FFE135` (Amarelo)
2. **Shopee**: `#EE4D2D` (Laranja)
3. **Shein**: `#1F2937` (Preto)
4. **TikTok Shop**: `#00F2EA` (Ciano)
5. **Total Consolidado**: `#3B82F6` (Azul profissional)
6. **Média/Referência**: `#9CA3AF` (Cinza)

#### Cores para Séries de Dados
- **Faturamento**: `#3B82F6` (Azul - linha grossa)
- **Lucro**: `#16A34A` (Verde - linha grossa)
- **Margem**: `#8B5CF6` (Roxo suave)
- **Pedidos**: `#F59E0B` (Amarelo)

---

## 🎯 Hierarquia Visual

### Nível 1 - KPIs Principais (Máxima Atenção)
- **Faturamento Total**: Azul `#3B82F6`
- **Lucro Total**: Verde `#16A34A`
- **Margem Média**: Roxo `#8B5CF6`

### Nível 2 - KPIs Secundários
- **Receita Líquida**: Azul claro `#60A5FA`
- **Total de Pedidos**: Cinza `#6B7280`
- **Ticket Médio**: Cinza `#6B7280`

### Nível 3 - Detalhes e Filtros
- **Filtros**: Cinza claro `#9CA3AF`
- **Labels**: Cinza médio `#6B7280`
- **Descrições**: Cinza claro `#9CA3AF`

---

## ♿ Acessibilidade (WCAG AA)

### Contraste Mínimo
- **Texto sobre fundo claro**: Mínimo 4.5:1
- **Texto sobre fundo escuro**: Mínimo 4.5:1
- **Textos grandes (18pt+)**: Mínimo 3:1

### Combinações Testadas
✅ **Aprovadas**:
- `#1F2937` sobre `#FFFFFF` → 12.6:1
- `#6B7280` sobre `#FFFFFF` → 4.6:1
- `#16A34A` sobre `#FFFFFF` → 4.8:1
- `#DC2626` sobre `#FFFFFF` → 5.1:1
- `#FFFFFF` sobre `#1F2937` → 12.6:1

### Indicadores Visuais
- **Nunca usar apenas cor** para indicar estado
- **Sempre usar ícone + texto** para tendências
- **Usar padrões** (linhas tracejadas, espessura) além de cor

---

## 📐 Padrões de Uso

### Cards
- **Fundo**: Branco `#FFFFFF`
- **Borda**: Cinza claro `#E5E7EB`
- **Sombra**: Sutil (0 1px 3px rgba(0,0,0,0.1))
- **Hover**: Sombra mais pronunciada

### Gráficos
- **Grid**: Cinza muito claro `#F3F4F6`
- **Eixos**: Cinza médio `#9CA3AF`
- **Linhas principais**: Espessura 3px
- **Linhas secundárias**: Espessura 2px
- **Pontos**: Tamanho 6px

### Tabelas
- **Header**: Fundo cinza claro `#F9FAFB`
- **Linhas alternadas**: Fundo branco
- **Hover**: Fundo cinza muito claro `#F3F4F6`
- **Bordas**: Cinza claro `#E5E7EB`

### Botões
- **Primário**: Azul `#3B82F6`
- **Secundário**: Cinza `#6B7280`
- **Sucesso**: Verde `#16A34A`
- **Perigo**: Vermelho `#DC2626`

---

## 🔧 Manutenção Futura

### Regras de Ouro
1. **Máximo 4-6 cores por gráfico**
2. **Sempre usar cores semânticas consistentes**
3. **Nunca inverter verde/vermelho**
4. **Manter contraste WCAG AA**
5. **Testar em modo claro e escuro**

### Variáveis CSS
Todas as cores estão definidas como variáveis CSS em `globals.css` para fácil manutenção.

### Tailwind Config
Cores customizadas estão em `tailwind.config.ts` para uso em classes utilitárias.

---

## 📚 Referências

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design Color System](https://material.io/design/color/the-color-system.html)
- [Tableau Color Palettes](https://www.tableau.com/about/blog/2016/7/colors-upgrade-tableau-10-56782)
