// Brand settings: fetched from `brand_settings` singleton (id = true).
// Provides a hook + defaults + a plain-object loader for PDF generation.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/elsewedy-logo.png.asset.json";

export interface BrandSettings {
  logo_url: string;
  signature_url: string | null;
  stamp_url: string | null;
  company_name_ar: string;
  company_name_en: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  tax_number: string;
  commercial_register: string;
  pdf_footer: string;
  default_terms: string;
  default_payment_terms: string;
  default_validity_days: number;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  show_qr: boolean;
  show_bank_details: boolean;
  bank_name: string;
  bank_account: string;
  bank_iban: string;
  bank_swift: string;
}

export const DEFAULT_BRAND: BrandSettings = {
  logo_url: logoAsset.url,
  signature_url: null,
  stamp_url: null,
  company_name_ar: "دار مدحت السويدي للطباعة",
  company_name_en: "Medhat Elsewedy Printhouse",
  address: "المنطقة الصناعية، العاشر من رمضان، الشرقية، مصر",
  phone: "+20 100 000 0000",
  whatsapp: "+20 100 000 0000",
  email: "info@elsewedy-print.com",
  website: "www.elsewedy-print.com",
  tax_number: "",
  commercial_register: "",
  pdf_footer: "شكراً لتعاملكم مع دار مدحت السويدي للطباعة — نلتزم بأعلى معايير الجودة والدقة.",
  default_terms: "الأسعار سارية خلال فترة الصلاحية الموضحة. أي تعديل في المواصفات قد يؤثر على السعر النهائي.",
  default_payment_terms: "50٪ مقدم — 50٪ عند الاستلام",
  default_validity_days: 15,
  primary_color: "#C8102E",
  secondary_color: "#EE5A24",
  accent_color: "#2C3E50",
  show_qr: true,
  show_bank_details: false,
  bank_name: "",
  bank_account: "",
  bank_iban: "",
  bank_swift: "",
};

export function useBrand() {
  const { data } = useQuery({
    queryKey: ["brand-settings"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("brand_settings").select("*").eq("id", true).maybeSingle();
      if (!data) return DEFAULT_BRAND;
      return { ...DEFAULT_BRAND, ...(data as any), logo_url: (data as any).logo_url || logoAsset.url };
    },
  });
  return data ?? DEFAULT_BRAND;
}

export async function fetchBrand(): Promise<BrandSettings> {
  const { data } = await supabase.from("brand_settings").select("*").eq("id", true).maybeSingle();
  if (!data) return DEFAULT_BRAND;
  return { ...DEFAULT_BRAND, ...(data as any), logo_url: (data as any).logo_url || logoAsset.url };
}
