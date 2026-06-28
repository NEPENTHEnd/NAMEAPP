export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      davet_kisi: {
        Row: {
          ad: string
          aktif: boolean
          created_at: string
          fis_prefix: number
          id: string
          rol: string
        }
        Insert: {
          ad: string
          aktif?: boolean
          created_at?: string
          fis_prefix: number
          id?: string
          rol: string
        }
        Update: {
          ad?: string
          aktif?: boolean
          created_at?: string
          fis_prefix?: number
          id?: string
          rol?: string
        }
        Relationships: []
      }
      davet_kodu: {
        Row: {
          created_at: string
          fis_prefix: number | null
          kod: string
          kullanildi: boolean
          olusturan_id: string | null
          rol: string
          teknik_personel_id: string | null
        }
        Insert: {
          created_at?: string
          fis_prefix?: number | null
          kod: string
          kullanildi?: boolean
          olusturan_id?: string | null
          rol: string
          teknik_personel_id?: string | null
        }
        Update: {
          created_at?: string
          fis_prefix?: number | null
          kod?: string
          kullanildi?: boolean
          olusturan_id?: string | null
          rol?: string
          teknik_personel_id?: string | null
        }
        Relationships: []
      }
      durum: {
        Row: {
          ad: string
          id: string
          renk: string | null
          sira: number
        }
        Insert: {
          ad: string
          id?: string
          renk?: string | null
          sira?: number
        }
        Update: {
          ad?: string
          id?: string
          renk?: string | null
          sira?: number
        }
        Relationships: []
      }
      fatura_durumu: {
        Row: {
          ad: string
          id: string
        }
        Insert: {
          ad: string
          id?: string
        }
        Update: {
          ad?: string
          id?: string
        }
        Relationships: []
      }
      foto: {
        Row: {
          dosya_yolu: string
          id: string
          is_kaydi_id: string
          sira: number
        }
        Insert: {
          dosya_yolu: string
          id?: string
          is_kaydi_id: string
          sira?: number
        }
        Update: {
          dosya_yolu?: string
          id?: string
          is_kaydi_id?: string
          sira?: number
        }
        Relationships: [
          {
            foreignKeyName: "foto_is_kaydi_id_fkey"
            columns: ["is_kaydi_id"]
            isOneToOne: false
            referencedRelation: "is_kaydi"
            referencedColumns: ["id"]
          },
        ]
      }
      is_kaydi: {
        Row: {
          aciklama: string | null
          cihaz_adi: string
          cikis_tarihi: string | null
          created_at: string
          durum_id: string
          fatura_durumu_id: string | null
          fatura_tutari: number | null
          fiyat_teklifi: number | null
          gelis_tarihi: string
          id: string
          ilgili_kisi: string | null
          musteri_id: string
          olusturan_id: string | null
          seri_no: string | null
          servis_no: string | null
          teknik_personel_id: string | null
          updated_at: string
        }
        Insert: {
          aciklama?: string | null
          cihaz_adi: string
          cikis_tarihi?: string | null
          created_at?: string
          durum_id: string
          fatura_durumu_id?: string | null
          fatura_tutari?: number | null
          fiyat_teklifi?: number | null
          gelis_tarihi?: string
          id?: string
          ilgili_kisi?: string | null
          musteri_id: string
          olusturan_id?: string | null
          seri_no?: string | null
          servis_no?: string | null
          teknik_personel_id?: string | null
          updated_at?: string
        }
        Update: {
          aciklama?: string | null
          cihaz_adi?: string
          cikis_tarihi?: string | null
          created_at?: string
          durum_id?: string
          fatura_durumu_id?: string | null
          fatura_tutari?: number | null
          fiyat_teklifi?: number | null
          gelis_tarihi?: string
          id?: string
          ilgili_kisi?: string | null
          musteri_id?: string
          olusturan_id?: string | null
          seri_no?: string | null
          servis_no?: string | null
          teknik_personel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "is_kaydi_durum_id_fkey"
            columns: ["durum_id"]
            isOneToOne: false
            referencedRelation: "durum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "is_kaydi_fatura_durumu_id_fkey"
            columns: ["fatura_durumu_id"]
            isOneToOne: false
            referencedRelation: "fatura_durumu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "is_kaydi_musteri_id_fkey"
            columns: ["musteri_id"]
            isOneToOne: false
            referencedRelation: "musteri"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "is_kaydi_teknik_personel_id_fkey"
            columns: ["teknik_personel_id"]
            isOneToOne: false
            referencedRelation: "teknik_personel"
            referencedColumns: ["id"]
          },
        ]
      }
      kullanici_profil: {
        Row: {
          ad: string | null
          fis_prefix: number | null
          id: string
          rol: string
          sahip: boolean
          teknik_personel_id: string | null
        }
        Insert: {
          ad?: string | null
          fis_prefix?: number | null
          id: string
          rol?: string
          sahip?: boolean
          teknik_personel_id?: string | null
        }
        Update: {
          ad?: string | null
          fis_prefix?: number | null
          id?: string
          rol?: string
          sahip?: boolean
          teknik_personel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kullanici_profil_teknik_personel_id_fkey"
            columns: ["teknik_personel_id"]
            isOneToOne: false
            referencedRelation: "teknik_personel"
            referencedColumns: ["id"]
          },
        ]
      }
      musteri: {
        Row: {
          ad: string
          aktif: boolean
          created_at: string
          id: string
          sube_sehir: string | null
        }
        Insert: {
          ad: string
          aktif?: boolean
          created_at?: string
          id?: string
          sube_sehir?: string | null
        }
        Update: {
          ad?: string
          aktif?: boolean
          created_at?: string
          id?: string
          sube_sehir?: string | null
        }
        Relationships: []
      }
      teknik_personel: {
        Row: {
          ad: string
          aktif: boolean
          id: string
        }
        Insert: {
          ad: string
          aktif?: boolean
          id?: string
        }
        Update: {
          ad?: string
          aktif?: boolean
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      yonetici_mi: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
