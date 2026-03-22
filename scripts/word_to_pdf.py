#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Word Dosyalarını PDF'e Çeviren Script
=====================================
Bu scriptte Word dosyalarini Microsoft Word'un kendi motoruyla PDF'e ceviriyorum.
Boylece font, format ve sayfa duzeni oldugu gibi korunuyor.

Nasıl Çalışır?
- Windows COM Automation kullanır
- Word uygulamasını arka planda açar
- Belgeyi yükler ve PDF olarak dışa aktarır
- Word'ü kapatır ve temizlik yapar

Desteklediği Formatlar:
- .docx (Word 2007 ve sonrası) - Doğrudan PDF'e çevirir
- .doc (Word 97-2003) - Önce .docx'e sonra PDF'e çevirir
"""
import sys
import os
import win32com.client  # Windows COM automation için
import pythoncom         # COM başlatma/kapatma için

def convert_word_to_pdf(input_path, output_path):
    """
    Word belgesini PDF'e çeviren ana fonksiyon
    
    Parametreler:
        input_path: Word dosyasının tam yolu (.doc veya .docx)
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
    
    # Word ve belge değişkenleri (temizlik için)
    word = None
    doc = None
    
    try:
        # COM sistemini başlat (Windows için gerekli)
        pythoncom.CoInitialize()
        
        # Word uygulamasını oluştur
        print(f"Word uygulaması başlatılıyor...", file=sys.stderr)
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False        # Görünmez mod (arka planda çalışsın)
        word.DisplayAlerts = 0      # Uyarıları gösterme
        
        # Belgeyi aç
        print(f"Belge açılıyor: {input_path}", file=sys.stderr)
        doc = word.Documents.Open(
            FileName=input_path,
            ConfirmConversions=False,  # Dönüştürme isteği gösterme
            ReadOnly=False,            # Düzenlemeye açık mod
            AddToRecentFiles=False,    # Son dosyalara ekleme
            Visible=False              # Görünmez
        )
        
        print(f"Belge başarıyla açıldı", file=sys.stderr)
        print(f"PDF'e çevriliyor: {output_path}", file=sys.stderr)
        
        # Dosya uzantısını kontrol et (.doc mu .docx mi?)
        file_ext = os.path.splitext(input_path)[1].lower()
        print(f"Dosya uzantısı: {file_ext}", file=sys.stderr)
        
        # .doc dosyaları için özel işlem gerekiyor
        # Önce .docx'e sonra PDF'e çevir (uyumluluk için)
        if file_ext == '.doc':
            try:
                print(f".doc formatı tespit edildi, önce .docx'e çevriliyor", file=sys.stderr)
                
                # Geçici .docx dosyası oluştur
                temp_docx = input_path.replace('.doc', '_temp.docx')
                
                # .docx olarak kaydet (FileFormat=12 -> .docx formatı)
                print(f"Geçici .docx dosyası oluşturuluyor: {temp_docx}", file=sys.stderr)
                doc.SaveAs2(temp_docx, FileFormat=12)
                doc.Close(False)  # Önceki belgeyi kapat
                
                # .docx dosyasını tekrar aç
                print(f"Geçici .docx dosyası açılıyor", file=sys.stderr)
                doc = word.Documents.Open(temp_docx)
                
                # Şimdi PDF'e aktar
                print(f".docx'den PDF'e aktarılıyor", file=sys.stderr)
                doc.ExportAsFixedFormat(
                    OutputFileName=output_path,
                    ExportFormat=17,          # PDF formatı
                    OpenAfterExport=False,    # Açma
                    OptimizeFor=0,            # Yazdırma için optimize et (yüksek kalite)
                    CreateBookmarks=0,        # Yer işareti ekleme
                    DocStructureTags=True,    # Belge yapısı etiketleri ekle
                    BitmapMissingFonts=True,  # Eksik fontları bitmap yap
                    UseISO19005_1=False       # PDF/A standardı kullanma
                )
                
                # Geçici .docx dosyasını sil
                print(f"Geçici dosya temizleniyor", file=sys.stderr)
                try:
                    os.remove(temp_docx)
                except:
                    pass
                
                print(f".doc -> .docx -> PDF dönüşümü başarılı", file=sys.stderr)
            except Exception as e:
                print(f"İki aşamalı dönüşüm başarısız: {e}", file=sys.stderr)
                raise
        else:
            # .docx dosyaları için direkt PDF'e aktar
            print(f".docx formatı için direkt PDF aktarımı", file=sys.stderr)
            doc.ExportAsFixedFormat(
                OutputFileName=output_path,
                ExportFormat=17,          # PDF formatı
                OpenAfterExport=False,    # Açma
                OptimizeFor=0,            # Yazdırma için optimize et (yüksek kalite)
                CreateBookmarks=0,        # Yer işareti ekleme
                DocStructureTags=True,    # Belge yapısı etiketleri ekle
                BitmapMissingFonts=True,  # Eksik fontları bitmap yap
                UseISO19005_1=False       # PDF/A standardı kullanma
            )
        
        print(f"PDF başarıyla oluşturuldu: {output_path}", file=sys.stderr)
        
        # Belgeyi kapat (değişiklikleri kaydetme)
        doc.Close(False)
        
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
        # Word'ü ve COM'u düzgün kapat
        
        # Belgeyi kapat
        try:
            if doc:
                doc.Close(False)
        except Exception as e:
            print(f"Belge kapatma uyarisi: {e}", file=sys.stderr)
            
        # Word'ü kapat
        try:
            if word:
                word.Quit()
        except Exception as e:
            print(f"Word kapatma uyarısı: {e}", file=sys.stderr)
            
        # COM'u temizle
        try:
            pythoncom.CoUninitialize()
        except:
            pass

# Script doğrudan çalıştırıldığında buradan başlar
# Örnek kullanım: python word_to_pdf.py belge.docx ciktiz.pdf
if __name__ == "__main__":
    # Komut satırı parametrelerini kontrol et
    if len(sys.argv) != 3:
        print("Kullanım: word_to_pdf.py <giris_dosyasi> <cikis_dosyasi>")
        print("Örnek: word_to_pdf.py belge.docx output.pdf")
        sys.exit(1)
    
    # Parametreleri al
    input_file = sys.argv[1]   # İlk parametre: giriş dosyası
    output_file = sys.argv[2]  # İkinci parametre: çıkış dosyası
    
    # Dönüştürmeyi başlat
    print(f"\nWord -> PDF Dönüştürme Başlatılıyor...", file=sys.stderr)
    print(f"Giriş: {input_file}", file=sys.stderr)
    print(f"Çıkış: {output_file}", file=sys.stderr)
    print("-" * 50, file=sys.stderr)
    
    # Dönüştür ve sonuç kodu döndür
    success = convert_word_to_pdf(input_file, output_file)
    sys.exit(0 if success else 1)  # 0: başarılı, 1: hata
