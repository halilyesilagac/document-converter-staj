#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Excel Dosyalarını PDF'e Çeviren Script
======================================
Bu scriptte Excel dosyalarini Microsoft Excel'in kendi motoruyla PDF'e ceviriyorum.
Fontlar, hucre formatlari, sayfa duzeni ve yazdirma ayarlari korunuyor.

Nasıl Çalışır?
- Windows COM Automation kullanır
- Excel uygulamasını arka planda açar
- Çalışma kitabını yükler
- Her çalışma sayfası için sayfa ayarlarını optimize eder
- PDF olarak dışa aktarır
- Excel'i kapatır ve temizlik yapar

Desteklediği Formatlar:
- .xlsx (Excel 2007 ve sonrası)
- .xls (Excel 97-2003)

Özellikler:
- Sayfa düzenini korur
- Yazdırma alanını otomatik tespit eder
- Sayfa genişliğine sığdırır
- Başlık ve altlıkları korur
"""
import sys
import os
import win32com.client  # Windows COM automation için
import pythoncom         # COM başlatma/kapatma için

def convert_excel_to_pdf(input_path, output_path):
    """
    Excel çalışma kitabını PDF'e çeviren ana fonksiyon
    
    Parametreler:
        input_path: Excel dosyasının tam yolu (.xls veya .xlsx)
        output_path: PDF'in kaydedileceği tam yol
    
    Döner:
        True: Başarılı
        False: Hata oluştu
    """
    # Dosya yollarını normalize et (tam yol yap)
    input_path = os.path.abspath(input_path)
    output_path = os.path.abspath(output_path)
    
    # Dosya var mı kontrol et
    if not os.path.exists(input_path):
        print(f"HATA: Dosya bulunamadı: {input_path}", file=sys.stderr)
        return False
    
    # Excel ve çalışma kitabı değişkenleri (temizlik için)
    excel = None
    workbook = None
    
    try:
        # COM sistemini başlat (Windows için gerekli)
        pythoncom.CoInitialize()
        
        # Excel uygulamasını oluştur
        print(f"Excel uygulaması başlatılıyor...", file=sys.stderr)
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False          # Görünmez mod (arka planda çalışsın)
        excel.DisplayAlerts = False    # Uyarıları gösterme
        
        # Çalışma kitabını aç
        print(f"Çalışma kitabı açılıyor: {input_path}", file=sys.stderr)
        workbook = excel.Workbooks.Open(input_path)
        
        # Her çalışma sayfası için sayfa ayarlarını optimize et
        print(f"Çalışma sayfaları yapılandırılıyor...", file=sys.stderr)
        for ws in workbook.Worksheets:
            print(f"  - {ws.Name} sayfası ayarlanıyor", file=sys.stderr)
            
            # Yazdırma alanı tanımlı mı kontrol et
            if ws.PageSetup.PrintArea == "":
                # Yazdırma alanı yoksa, kullanılan alanı otomatik tespit et
                used_range = ws.UsedRange
                if used_range:
                    # Kullanılan alanı yazdırma alanı olarak ayarla
                    ws.PageSetup.PrintArea = used_range.Address
                    print(f"    Yazdırma alanı: {used_range.Address}", file=sys.stderr)
            
            # Sayfa ölçeğini ayarla - sayfa genişliğine sığdır
            # Bu, içeriğin kesilmesini engeller
            try:
                ws.PageSetup.Zoom = False             # Sabit zoom'u devre dışı bırak
                ws.PageSetup.FitToPagesWide = 1       # 1 sayfa genişliğinde
                ws.PageSetup.FitToPagesTall = False   # Yükseklikte birden fazla sayfa olabilir
                print(f"    Sayfa ölçeği: Genişliğe sığdır", file=sys.stderr)
            except Exception as e:
                # Bazı ayarlar kullanılamayabilir, devam et
                print(f"    Sayfa ayar uyarisi: {e}", file=sys.stderr)
                pass
        
        # PDF olarak dışa aktar (yüksek kalite)
        print(f"PDF'e aktarılıyor: {output_path}", file=sys.stderr)
        workbook.ExportAsFixedFormat(
            Type=0,                       # PDF formatı
            Filename=output_path,         # Çıkış dosyası
            Quality=0,                    # Standart kalite (yüksek)
            IncludeDocProperties=True,    # Belge özelliklerini dahil et
            IgnorePrintAreas=False,       # Yazdırma alanlarına uy
            OpenAfterPublish=False        # Oluşturduktan sonra açma
        )
        
        print(f"PDF başarıyla oluşturuldu", file=sys.stderr)
        
        # Çalışma kitabını kapat (değişiklikleri kaydetme)
        workbook.Close(False)
        
        print(f"BAŞARILI: {output_path} oluşturuldu")
        return True
        
    except Exception as e:
        # Hata oluşursa detaylı bilgi göster
        print(f"HATA: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)  # Tam hata bilgisi
        return False
        
    finally:
        # Her durumda temizlik yap (hata olsa bile)
        # Excel'ı ve COM'u düzgün kapat
        
        # Çalışma kitabını kapat
        try:
            if workbook:
                workbook.Close(False)
        except:
            pass
            
        # Excel'ı kapat
        try:
            if excel:
                excel.Quit()
        except:
            pass
            
        # COM'u temizle
        try:
            pythoncom.CoUninitialize()
        except:
            pass

# Script doğrudan çalıştırıldığında buradan başlar
# Örnek kullanım: python excel_to_pdf.py dosya.xlsx ciktiz.pdf
if __name__ == "__main__":
    # Komut satırı parametrelerini kontrol et
    if len(sys.argv) != 3:
        print("Kullanım: excel_to_pdf.py <giris_dosyasi> <cikis_dosyasi>")
        print("Örnek: excel_to_pdf.py tablo.xlsx output.pdf")
        sys.exit(1)
    
    # Parametreleri al
    input_file = sys.argv[1]   # İlk parametre: giriş dosyası
    output_file = sys.argv[2]  # İkinci parametre: çıkış dosyası
    
    # Dönüştürmeyi başlat
    print(f"\nExcel -> PDF Dönüştürme Başlatılıyor...", file=sys.stderr)
    print(f"Giriş: {input_file}", file=sys.stderr)
    print(f"Çıkış: {output_file}", file=sys.stderr)
    print("-" * 50, file=sys.stderr)
    
    # Dönüştür ve sonuç kodu döndür
    success = convert_excel_to_pdf(input_file, output_file)
    sys.exit(0 if success else 1)  # 0: başarılı, 1: hata
