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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      Actividad: {
        Row: {
          activa: boolean
          createdAt: string
          descripcion: string | null
          duracionEstimadaMin: number
          id: number
          nombre: string
          obligatoria: boolean
          tipo: string
          updatedAt: string
        }
        Insert: {
          activa?: boolean
          createdAt?: string
          descripcion?: string | null
          duracionEstimadaMin?: number
          id?: number
          nombre: string
          obligatoria?: boolean
          tipo?: string
          updatedAt?: string
        }
        Update: {
          activa?: boolean
          createdAt?: string
          descripcion?: string | null
          duracionEstimadaMin?: number
          id?: number
          nombre?: string
          obligatoria?: boolean
          tipo?: string
          updatedAt?: string
        }
        Relationships: []
      }
      Cliente: {
        Row: {
          createdAt: string | null
          direccion: string | null
          email: string
          id: number
          nombre: string
          telefono: string | null
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          direccion?: string | null
          email: string
          id?: number
          nombre: string
          telefono?: string | null
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          direccion?: string | null
          email?: string
          id?: number
          nombre?: string
          telefono?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      Cotizacion: {
        Row: {
          clienteId: number
          createdAt: string
          descuentoGlobalTipo: string
          descuentoGlobalValor: number
          descuentoGlobalPct: number
          descuentoMonto: number
          estado: string
          fecha: string
          id: number
          impuestoMonto: number
          impuestoPct: number
          moneda: string
          numero: string | null
          observaciones: string | null
          subtotal: number
          total: number
          updatedAt: string
          validaHasta: string | null
          vendedorId: number | null
        }
        Insert: {
          clienteId: number
          createdAt?: string
          descuentoGlobalTipo?: string
          descuentoGlobalValor?: number
          descuentoGlobalPct?: number
          descuentoMonto?: number
          estado?: string
          fecha?: string
          id?: number
          impuestoMonto?: number
          impuestoPct?: number
          moneda?: string
          numero?: string | null
          observaciones?: string | null
          subtotal?: number
          total?: number
          updatedAt?: string
          validaHasta?: string | null
          vendedorId?: number | null
        }
        Update: {
          clienteId?: number
          createdAt?: string
          descuentoGlobalTipo?: string
          descuentoGlobalValor?: number
          descuentoGlobalPct?: number
          descuentoMonto?: number
          estado?: string
          fecha?: string
          id?: number
          impuestoMonto?: number
          impuestoPct?: number
          moneda?: string
          numero?: string | null
          observaciones?: string | null
          subtotal?: number
          total?: number
          updatedAt?: string
          validaHasta?: string | null
          vendedorId?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Cotizacion_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Cotizacion_clienteId_fkey"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "vw_CalendarioVisitas"
            referencedColumns: ["clienteId"]
          },
          {
            foreignKeyName: "Cotizacion_vendedorId_fkey"
            columns: ["vendedorId"]
            isOneToOne: false
            referencedRelation: "Vendedor"
            referencedColumns: ["id"]
          },
        ]
      }
      CotizacionItem: {
        Row: {
          cantidad: number
          codigo: string | null
          cotizacionId: number
          createdAt: string
          descripcion: string
          descuentoTipo: string
          descuentoValor: number
          descuentoPct: number
          equipoId: number | null
          id: number
          lineaTotal: number | null
          orden: number
          nombre: string
          precioUnitario: number
          servicioId: number | null
          updatedAt: string
        }
        Insert: {
          cantidad?: number
          codigo?: string | null
          cotizacionId: number
          createdAt?: string
          descripcion: string
          descuentoTipo?: string
          descuentoValor?: number
          descuentoPct?: number
          equipoId?: number | null
          id?: number
          lineaTotal?: number | null
          orden?: number
          nombre: string
          precioUnitario?: number
          servicioId?: number | null
          updatedAt?: string
        }
        Update: {
          cantidad?: number
          codigo?: string | null
          cotizacionId?: number
          createdAt?: string
          descripcion?: string
          descuentoTipo?: string
          descuentoValor?: number
          descuentoPct?: number
          equipoId?: number | null
          id?: number
          lineaTotal?: number | null
          orden?: number
          nombre?: string
          precioUnitario?: number
          servicioId?: number | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "CotizacionItem_cotizacionId_fkey"
            columns: ["cotizacionId"]
            isOneToOne: false
            referencedRelation: "Cotizacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CotizacionItem_cotizacionId_fkey"
            columns: ["cotizacionId"]
            isOneToOne: false
            referencedRelation: "vw_CotizacionesResumen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CotizacionItem_equipoId_fkey"
            columns: ["equipoId"]
            isOneToOne: false
            referencedRelation: "Equipo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CotizacionItem_equipoId_fkey"
            columns: ["equipoId"]
            isOneToOne: false
            referencedRelation: "vw_HojaVidaEquipo"
            referencedColumns: ["equipoId"]
          },
          {
            foreignKeyName: "CotizacionItem_servicioId_fkey"
            columns: ["servicioId"]
            isOneToOne: false
            referencedRelation: "Servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      CotizacionItemServicio: {
        Row: {
          cantidad: number
          cotizacionItemId: number
          createdAt: string
          descripcionDetalle: string | null
          descuentoPct: number
          descuentoTipo: string
          descuentoValor: number
          id: number
          lineaTotal: number
          nombre: string
          orden: number
          precioUnitario: number
          servicioId: number
          updatedAt: string
        }
        Insert: {
          cantidad?: number
          cotizacionItemId: number
          createdAt?: string
          descripcionDetalle?: string | null
          descuentoPct?: number
          descuentoTipo?: string
          descuentoValor?: number
          id?: number
          lineaTotal?: number
          nombre: string
          orden?: number
          precioUnitario?: number
          servicioId: number
          updatedAt?: string
        }
        Update: {
          cantidad?: number
          cotizacionItemId?: number
          createdAt?: string
          descripcionDetalle?: string | null
          descuentoPct?: number
          descuentoTipo?: string
          descuentoValor?: number
          id?: number
          lineaTotal?: number
          nombre?: string
          orden?: number
          precioUnitario?: number
          servicioId?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "CotizacionItemServicio_cotizacionItemId_fkey"
            columns: ["cotizacionItemId"]
            isOneToOne: false
            referencedRelation: "CotizacionItem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CotizacionItemServicio_servicioId_fkey"
            columns: ["servicioId"]
            isOneToOne: false
            referencedRelation: "Servicio"
            referencedColumns: ["id"]
          },
        ]
      }
      Equipo: {
        Row: {
          categoria: string | null
          clienteId: number
          codigoInterno: string | null
          createdAt: string | null
          criticidad: string | null
          estadoOperativo: string | null
          fabricante: string | null
          fechaGarantiaFin: string | null
          fechaInstalacion: string | null
          id: number
          modelo: string
          nombre: string
          observaciones: string | null
          proximaMantencion: string | null
          serial: string
          ubicacion: string | null
          ultimaMantencion: string | null
          updatedAt: string | null
        }
        Insert: {
          categoria?: string | null
          clienteId: number
          codigoInterno?: string | null
          createdAt?: string | null
          criticidad?: string | null
          estadoOperativo?: string | null
          fabricante?: string | null
          fechaGarantiaFin?: string | null
          fechaInstalacion?: string | null
          id?: number
          modelo: string
          nombre: string
          observaciones?: string | null
          proximaMantencion?: string | null
          serial: string
          ubicacion?: string | null
          ultimaMantencion?: string | null
          updatedAt?: string | null
        }
        Update: {
          categoria?: string | null
          clienteId?: number
          codigoInterno?: string | null
          createdAt?: string | null
          criticidad?: string | null
          estadoOperativo?: string | null
          fabricante?: string | null
          fechaGarantiaFin?: string | null
          fechaInstalacion?: string | null
          id?: number
          modelo?: string
          nombre?: string
          observaciones?: string | null
          proximaMantencion?: string | null
          serial?: string
          ubicacion?: string | null
          ultimaMantencion?: string | null
          updatedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_equipo_cliente"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_equipo_cliente"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "vw_CalendarioVisitas"
            referencedColumns: ["clienteId"]
          },
        ]
      }
      EquipoHojaVida: {
        Row: {
          costo: number | null
          createdAt: string
          detalle: string | null
          documentoUrl: string | null
          equipoId: number
          fechaEvento: string
          id: number
          metadata: Json
          tecnicoId: number | null
          tipoEvento: string
          titulo: string
          visitaId: number | null
        }
        Insert: {
          costo?: number | null
          createdAt?: string
          detalle?: string | null
          documentoUrl?: string | null
          equipoId: number
          fechaEvento?: string
          id?: number
          metadata?: Json
          tecnicoId?: number | null
          tipoEvento?: string
          titulo: string
          visitaId?: number | null
        }
        Update: {
          costo?: number | null
          createdAt?: string
          detalle?: string | null
          documentoUrl?: string | null
          equipoId?: number
          fechaEvento?: string
          id?: number
          metadata?: Json
          tecnicoId?: number | null
          tipoEvento?: string
          titulo?: string
          visitaId?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "EquipoHojaVida_equipoId_fkey"
            columns: ["equipoId"]
            isOneToOne: false
            referencedRelation: "Equipo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EquipoHojaVida_equipoId_fkey"
            columns: ["equipoId"]
            isOneToOne: false
            referencedRelation: "vw_HojaVidaEquipo"
            referencedColumns: ["equipoId"]
          },
          {
            foreignKeyName: "EquipoHojaVida_tecnicoId_fkey"
            columns: ["tecnicoId"]
            isOneToOne: false
            referencedRelation: "Tecnico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EquipoHojaVida_visitaId_fkey"
            columns: ["visitaId"]
            isOneToOne: false
            referencedRelation: "Visita"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EquipoHojaVida_visitaId_fkey"
            columns: ["visitaId"]
            isOneToOne: false
            referencedRelation: "vw_CalendarioVisitas"
            referencedColumns: ["id"]
          },
        ]
      }
      Servicio: {
        Row: {
          activo: boolean | null
          createdAt: string | null
          descripcion: string
          duracionEstimadaMin: number | null
          id: number
          precio: number | null
          tipo: string | null
          updatedAt: string | null
        }
        Insert: {
          activo?: boolean | null
          createdAt?: string | null
          descripcion: string
          duracionEstimadaMin?: number | null
          id?: number
          precio?: number | null
          tipo?: string | null
          updatedAt?: string | null
        }
        Update: {
          activo?: boolean | null
          createdAt?: string | null
          descripcion?: string
          duracionEstimadaMin?: number | null
          id?: number
          precio?: number | null
          tipo?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      Tecnico: {
        Row: {
          createdAt: string | null
          email: string
          especialidad: string | null
          id: number
          nombre: string
          telefono: string | null
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          email: string
          especialidad?: string | null
          id?: number
          nombre: string
          telefono?: string | null
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          email?: string
          especialidad?: string | null
          id?: number
          nombre?: string
          telefono?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      Vendedor: {
        Row: {
          createdAt: string | null
          email: string
          id: number
          nombre: string
          telefono: string | null
          updatedAt: string | null
        }
        Insert: {
          createdAt?: string | null
          email: string
          id?: number
          nombre: string
          telefono?: string | null
          updatedAt?: string | null
        }
        Update: {
          createdAt?: string | null
          email?: string
          id?: number
          nombre?: string
          telefono?: string | null
          updatedAt?: string | null
        }
        Relationships: []
      }
      Visita: {
        Row: {
          calendarEventId: string | null
          clienteId: number
          codigo: string | null
          costoManoObra: number | null
          costoRepuestos: number | null
          createdAt: string | null
          descripcion: string | null
          duracionMin: number | null
          equipoId: number | null
          estado: string | null
          fecha: string
          fechaCierre: string | null
          fechaFinProgramada: string | null
          fechaProgramada: string | null
          id: number
          notasTecnicas: string | null
          prioridad: string | null
          servicioId: number
          tecnicoId: number
          tipoVisita: string | null
          updatedAt: string | null
          vendedorId: number | null
        }
        Insert: {
          calendarEventId?: string | null
          clienteId: number
          codigo?: string | null
          costoManoObra?: number | null
          costoRepuestos?: number | null
          createdAt?: string | null
          descripcion?: string | null
          duracionMin?: number | null
          equipoId?: number | null
          estado?: string | null
          fecha: string
          fechaCierre?: string | null
          fechaFinProgramada?: string | null
          fechaProgramada?: string | null
          id?: number
          notasTecnicas?: string | null
          prioridad?: string | null
          servicioId: number
          tecnicoId: number
          tipoVisita?: string | null
          updatedAt?: string | null
          vendedorId?: number | null
        }
        Update: {
          calendarEventId?: string | null
          clienteId?: number
          codigo?: string | null
          costoManoObra?: number | null
          costoRepuestos?: number | null
          createdAt?: string | null
          descripcion?: string | null
          duracionMin?: number | null
          equipoId?: number | null
          estado?: string | null
          fecha?: string
          fechaCierre?: string | null
          fechaFinProgramada?: string | null
          fechaProgramada?: string | null
          id?: number
          notasTecnicas?: string | null
          prioridad?: string | null
          servicioId?: number
          tecnicoId?: number
          tipoVisita?: string | null
          updatedAt?: string | null
          vendedorId?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_visita_cliente"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "Cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visita_cliente"
            columns: ["clienteId"]
            isOneToOne: false
            referencedRelation: "vw_CalendarioVisitas"
            referencedColumns: ["clienteId"]
          },
          {
            foreignKeyName: "fk_visita_equipo"
            columns: ["equipoId"]
            isOneToOne: false
            referencedRelation: "Equipo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visita_equipo"
            columns: ["equipoId"]
            isOneToOne: false
            referencedRelation: "vw_HojaVidaEquipo"
            referencedColumns: ["equipoId"]
          },
          {
            foreignKeyName: "fk_visita_servicio"
            columns: ["servicioId"]
            isOneToOne: false
            referencedRelation: "Servicio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visita_tecnico"
            columns: ["tecnicoId"]
            isOneToOne: false
            referencedRelation: "Tecnico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_visita_vendedor"
            columns: ["vendedorId"]
            isOneToOne: false
            referencedRelation: "Vendedor"
            referencedColumns: ["id"]
          },
        ]
      }
      VisitaActividad: {
        Row: {
          actividadId: number | null
          createdAt: string
          descripcion: string | null
          duracionMin: number | null
          estado: string
          fechaProgramada: string | null
          fechaReal: string | null
          id: number
          observaciones: string | null
          orden: number
          responsableTecnicoId: number | null
          titulo: string
          updatedAt: string
          visitaId: number
        }
        Insert: {
          actividadId?: number | null
          createdAt?: string
          descripcion?: string | null
          duracionMin?: number | null
          estado?: string
          fechaProgramada?: string | null
          fechaReal?: string | null
          id?: number
          observaciones?: string | null
          orden?: number
          responsableTecnicoId?: number | null
          titulo: string
          updatedAt?: string
          visitaId: number
        }
        Update: {
          actividadId?: number | null
          createdAt?: string
          descripcion?: string | null
          duracionMin?: number | null
          estado?: string
          fechaProgramada?: string | null
          fechaReal?: string | null
          id?: number
          observaciones?: string | null
          orden?: number
          responsableTecnicoId?: number | null
          titulo?: string
          updatedAt?: string
          visitaId?: number
        }
        Relationships: [
          {
            foreignKeyName: "VisitaActividad_actividadId_fkey"
            columns: ["actividadId"]
            isOneToOne: false
            referencedRelation: "Actividad"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "VisitaActividad_responsableTecnicoId_fkey"
            columns: ["responsableTecnicoId"]
            isOneToOne: false
            referencedRelation: "Tecnico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "VisitaActividad_visitaId_fkey"
            columns: ["visitaId"]
            isOneToOne: false
            referencedRelation: "Visita"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "VisitaActividad_visitaId_fkey"
            columns: ["visitaId"]
            isOneToOne: false
            referencedRelation: "vw_CalendarioVisitas"
            referencedColumns: ["id"]
          },
        ]
      }
      VisitaEquipo: {
        Row: {
          createdAt: string
          equipoId: number
          id: number
          visitaId: number
        }
        Insert: {
          createdAt?: string
          equipoId: number
          id?: number
          visitaId: number
        }
        Update: {
          createdAt?: string
          equipoId?: number
          id?: number
          visitaId?: number
        }
        Relationships: [
          {
            foreignKeyName: "VisitaEquipo_equipoId_fkey"
            columns: ["equipoId"]
            isOneToOne: false
            referencedRelation: "Equipo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "VisitaEquipo_equipoId_fkey"
            columns: ["equipoId"]
            isOneToOne: false
            referencedRelation: "vw_HojaVidaEquipo"
            referencedColumns: ["equipoId"]
          },
          {
            foreignKeyName: "VisitaEquipo_visitaId_fkey"
            columns: ["visitaId"]
            isOneToOne: false
            referencedRelation: "Visita"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "VisitaEquipo_visitaId_fkey"
            columns: ["visitaId"]
            isOneToOne: false
            referencedRelation: "vw_CalendarioVisitas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_CalendarioVisitas: {
        Row: {
          cliente: string | null
          clienteId: number | null
          codigo: string | null
          equipos: string | null
          estado: string | null
          fechaFinProgramada: string | null
          fechaProgramada: string | null
          id: number | null
          prioridad: string | null
          servicio: string | null
          tecnico: string | null
        }
        Relationships: []
      }
      vw_CotizacionesResumen: {
        Row: {
          cliente: string | null
          estado: string | null
          fecha: string | null
          id: number | null
          moneda: string | null
          numero: string | null
          total: number | null
          vendedor: string | null
        }
        Relationships: []
      }
      vw_HojaVidaEquipo: {
        Row: {
          cliente: string | null
          codigoInterno: string | null
          costo: number | null
          criticidad: string | null
          detalle: string | null
          equipoId: number | null
          estadoOperativo: string | null
          eventoId: number | null
          fechaEvento: string | null
          modelo: string | null
          nombre: string | null
          proximaMantencion: string | null
          serial: string | null
          tipoEvento: string | null
          titulo: string | null
          ubicacion: string | null
          visitaId: number | null
        }
        Relationships: [
          {
            foreignKeyName: "EquipoHojaVida_visitaId_fkey"
            columns: ["visitaId"]
            isOneToOne: false
            referencedRelation: "Visita"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EquipoHojaVida_visitaId_fkey"
            columns: ["visitaId"]
            isOneToOne: false
            referencedRelation: "vw_CalendarioVisitas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_recalcular_totales_cotizacion: {
        Args: { p_cotizacion_id: number }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
