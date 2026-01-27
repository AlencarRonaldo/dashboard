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
      orders: {
        Row: {
          id: string
          store_id: string
          import_id: string
          platform_order_id: string
          order_date: string
          settlement_date: string | null
          created_at: string
        }
        Insert: {
          store_id: string
          import_id: string
          platform_order_id: string
          order_date: string
          settlement_date?: string | null
        }
        Update: {}
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          sku: string
          quantity: number
          created_at: string
        }
        Insert: {
          order_id: string
          sku: string
          quantity: number
        }
        Update: {}
      }
      order_financials: {
        Row: {
          id: string
          order_id: string
          order_value: number
          revenue: number | null
          product_sales: number | null
          commissions: number | null
          fees: number | null
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
          commissions?: number | null
          fees?: number | null
          refunds?: number | null
          product_cost?: number | null
          profit?: number | null
          profit_margin?: number | null
        }
        Update: {}
      }
      imports: {
        Row: {
          id: string
          user_id: string
          file_name: string
          status: 'pending' | 'processing' | 'success' | 'failed'
          error_details: string | null
          created_at: string
          finished_at: string | null
        }
        Insert: {
          user_id: string
          file_name: string
          status?: 'pending' | 'processing' | 'success' | 'failed'
        }
        Update: {
          status?: 'pending' | 'processing' | 'success' | 'failed'
          error_details?: string | null
          finished_at?: string | null
        }
      }
    }
  }
}
