export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      marketplaces: {
        Row: {
          id: string
          name: string
          display_name: string
          created_at: string
        }
        Insert: {
          name: string
          display_name: string
        }
        Update: {
          name?: string
          display_name?: string
        }
      }
      stores: {
        Row: {
          id: string
          user_id: string
          marketplace_id: string
          name: string
          created_at: string
        }
        Insert: {
          user_id: string
          marketplace_id: string
          name: string
        }
        Update: {
          name?: string
        }
      }
      orders: {
        Row: {
          id: string
          store_id: string
          import_id: string
          platform_order_id: string
          external_order_id: string | null
          platform_name: string | null
          store_name: string | null
          order_date: string
          settlement_date: string | null
          created_at: string
        }
        Insert: {
          store_id: string
          import_id: string
          platform_order_id: string
          external_order_id?: string | null
          platform_name?: string | null
          store_name?: string | null
          order_date: string
          settlement_date?: string | null
        }
        Update: {
          external_order_id?: string | null
          platform_name?: string | null
          store_name?: string | null
          settlement_date?: string | null
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          sku: string
          product_name: string | null
          quantity: number
          unit_price: number | null
          created_at: string
        }
        Insert: {
          order_id: string
          sku: string
          product_name?: string | null
          quantity: number
          unit_price?: number | null
        }
        Update: {
          sku?: string
          product_name?: string | null
          quantity?: number
          unit_price?: number | null
        }
      }
      order_financials: {
        Row: {
          id: string
          order_id: string
          order_value: number
          revenue: number | null
          product_sales: number | null
          shipping_fee_buyer: number | null
          platform_discount: number | null
          commissions: number | null
          transaction_fee: number | null
          shipping_fee: number | null
          other_platform_fees: number | null
total_fees: number | null
          refunds: number | null
          product_cost: number | null
          profit: number | null
          profit_margin: number | null
          created_at: string
        }
        Insert: {
          order_id: string
          order_value: number
          revenue?: number | null
          product_sales?: number | null
          shipping_fee_buyer?: number | null
          platform_discount?: number | null
          commissions?: number | null
          transaction_fee?: number | null
          shipping_fee?: number | null
          other_platform_fees?: number | null
          fees?: number | null
          refunds?: number | null
          product_cost?: number | null
          profit?: number | null
          profit_margin?: number | null
        }
        Update: {
          order_value?: number
          revenue?: number | null
          product_sales?: number | null
          shipping_fee_buyer?: number | null
          platform_discount?: number | null
          commissions?: number | null
          transaction_fee?: number | null
          shipping_fee?: number | null
          other_platform_fees?: number | null
          fees?: number | null
          refunds?: number | null
          product_cost?: number | null
          profit?: number | null
          profit_margin?: number | null
        }
      }
      imports: {
        Row: {
          id: string
          user_id: string
          store_id: string | null
          file_name: string
          status: 'pending' | 'processing' | 'success' | 'failed'
          total_rows: number | null
          success_count: number | null
          error_count: number | null
          skipped_count: number | null
          error_details: string | null
          created_at: string
          finished_at: string | null
        }
        Insert: {
          user_id: string
          store_id?: string | null
          file_name: string
          status?: 'pending' | 'processing' | 'success' | 'failed'
          total_rows?: number | null
          success_count?: number | null
          error_count?: number | null
          skipped_count?: number | null
        }
        Update: {
          status?: 'pending' | 'processing' | 'success' | 'failed'
          total_rows?: number | null
          success_count?: number | null
          error_count?: number | null
          skipped_count?: number | null
          error_details?: string | null
          finished_at?: string | null
        }
      }
      import_row_logs: {
        Row: {
          id: string
          import_id: string
          row_number: number
          status: 'success' | 'error' | 'skipped' | 'warning'
          platform_order_id: string | null
          external_order_id: string | null
          order_id: string | null
          error_message: string | null
          warning_message: string | null
          raw_data: Json | null
          created_at: string
        }
        Insert: {
          import_id: string
          row_number: number
          status: 'success' | 'error' | 'skipped' | 'warning'
          platform_order_id?: string | null
          external_order_id?: string | null
          order_id?: string | null
          error_message?: string | null
          warning_message?: string | null
          raw_data?: Json | null
        }
        Update: {
          status?: 'success' | 'error' | 'skipped' | 'warning'
          error_message?: string | null
          warning_message?: string | null
        }
      }
      column_mappings: {
        Row: {
          id: string
          user_id: string
          marketplace: string
          source_column: string
          target_field: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          marketplace: string
          source_column: string
          target_field: string
          is_active?: boolean
        }
        Update: {
          source_column?: string
          target_field?: string
          is_active?: boolean
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
  }
}

// Tipos auxiliares para facilitar o uso
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Aliases comuns
export type Order = Tables<'orders'>
export type OrderItem = Tables<'order_items'>
export type OrderFinancials = Tables<'order_financials'>
export type Import = Tables<'imports'>
export type ImportRowLog = Tables<'import_row_logs'>
export type Store = Tables<'stores'>
export type Marketplace = Tables<'marketplaces'>
