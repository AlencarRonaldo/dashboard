# Resumo da Implementação Responsiva

## Breakpoints Utilizados (Tailwind)

| Breakpoint | Largura | Uso |
|------------|---------|-----|
| (base) | < 640px | Mobile first – estilos base |
| `sm` | 640px | Smartphones grandes / tablets pequenos |
| `md` | 768px | Tablets / menu expandido |
| `lg` | 1024px | Desktops pequenos |
| `xl` | 1280px | Desktops |
| `2xl` | 1400px | Telas grandes |

## Mudanças Realizadas

### 1. Layout e Container
- **Container**: padding responsivo (`1rem` mobile → `2rem` desktop)
- **Viewport**: `width: device-width`, `initialScale: 1`, `viewportFit: cover`
- **Body**: `overflow-x: hidden`, `min-height: 100vh`, safe-area para notch

### 2. Navbar
- **Mobile (< 768px)**: menu hambúrguer, drawer lateral com overlay
- **Desktop (≥ 768px)**: menu horizontal expandido
- **Touch**: botões com min 44×44px (WCAG 2.5.5)
- **Scroll lock**: body bloqueado quando menu aberto

### 3. Tabelas
- **OrdersTable**: cards no mobile, tabela com scroll horizontal no desktop
- **History**: tabela com `min-w-[600px]` e `overflow-x-auto` para scroll horizontal

### 4. Componentes Base
- **Button**: `min-h-[44px]` em mobile, tamanhos responsivos
- **Input/Select**: `min-h-[44px]`, `text-base` (16px) no mobile para evitar zoom no iOS
- **Label**: mantém associação com inputs para acessibilidade

### 5. Páginas
- **Dashboard**: header em coluna no mobile, grids `1 → 2 → 3 → 6` colunas
- **Login**: padding responsivo, card centralizado
- **Import**: área de upload com `min-h-[120px]`, `touch-manipulation`
- **History**: botões em wrap, diagnose em grid responsivo
- **Admin Users**: header e lista de usuários empilhados no mobile

### 6. Gráficos (Recharts)
- Altura responsiva: `280px` mobile → `350px` desktop
- Cores via variáveis CSS (tema dark/light)
- YAxis width reduzido (80px) para mobile

### 7. Acessibilidade e UX
- Área de toque mínima 44×44px em botões e links interativos
- `font-size: 16px` em inputs no mobile (evita zoom no iOS)
- `focus-visible` para indicadores de foco
- `aria-label` e `aria-expanded` no menu hambúrguer

## Boas Práticas para Manter Responsividade

1. **Mobile first**: escrever estilos base para mobile e usar `sm:`, `md:`, `lg:` para telas maiores
2. **Evitar larguras fixas**: preferir `max-w-*`, `w-full`, `min-w-0` em flex/grid
3. **Touch targets**: manter min 44×44px em elementos clicáveis
4. **Tipografia**: usar `text-sm sm:text-base` para escalar com a tela
5. **Grids**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` em vez de colunas fixas
6. **Tabelas**: considerar cards no mobile ou scroll horizontal com `overflow-x-auto`

## Arquivos Alterados

- `src/app/globals.css` – base responsiva, inputs
- `src/app/layout.tsx` – viewport
- `tailwind.config.ts` – container padding
- `src/components/layout/navbar.tsx` – menu hambúrguer
- `src/components/ui/button.tsx` – touch targets
- `src/components/ui/input.tsx` – altura e font-size
- `src/components/ui/select.tsx` – altura e font-size
- `src/components/dashboard/orders-table.tsx` – cards mobile
- `src/components/dashboard/kpi-card.tsx` – tipografia
- `src/components/dashboard/revenue-chart.tsx` – altura responsiva
- `src/components/dashboard/margin-chart.tsx` – altura responsiva
- `src/components/dashboard/marketplace-chart.tsx` – altura e cores
- `src/app/dashboard/page.tsx` – grids e header
- `src/app/login/page.tsx` – padding
- `src/app/import/page.tsx` – layout e upload
- `src/app/history/page.tsx` – header, tabela, diagnose
- `src/app/admin/users/page.tsx` – layout
- `src/app/page.tsx` – home responsiva
