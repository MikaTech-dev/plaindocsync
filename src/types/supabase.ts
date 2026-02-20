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
            documents: {
                Row: {
                    id: string
                    created_at: string
                    owner_id: string
                    title: string
                    content: Json | null
                    is_public: boolean
                    last_updated: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    owner_id: string
                    title?: string
                    content?: Json | null
                    is_public?: boolean
                    last_updated?: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    owner_id?: string
                    title?: string
                    content?: Json | null
                    is_public?: boolean
                    last_updated?: string
                }
            }
        }
    }
}

export type Document = Database['public']['Tables']['documents']['Row'];
