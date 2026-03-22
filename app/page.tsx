/*
 * Ana Sayfa (Frontend)
 *
 * Bu ekranda kullanicidan dosyalari aliyorum ve backend'e gonderiyorum.
 * Ayrica iki farkli calisma modunu buradan secilebilecek hale getirdim:
 * - Normal mod: Her belge tek PDF
 * - Parcalara bol modu: Her PDF sayfa sayfa 1.pdf, 2.pdf... diye ZIP'e girer
 */

'use client';  // Next.js 13+ için client component işaretlemesi

import { useState, useRef } from 'react';

export default function Home() {
  // State (durum) yönetimi
  const [files, setFiles] = useState<File[]>([]);          // Seçilen dosyalar
  const [converting, setConverting] = useState(false);     // Dönüştürme işlemi devam ediyor mu?
  const [progress, setProgress] = useState('');            // İlerleme mesajı
  const [splitPages, setSplitPages] = useState(false);     // Sayfa sayfa bölme modu açık mı?
  const fileInputRef = useRef<HTMLInputElement>(null);     // Dosya input elementine referans

  // Dosya seçildiğinde çalışır (input'tan)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // FileList'i Array'e çevir ve state'e kaydet
      setFiles(Array.from(e.target.files));
    }
  };

  // Dosya sürüklenip bırakıldığında çalışır (drag & drop)
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();  // Varsayılan davranışı engelle (tarayıcıda dosyayı açma)
    if (e.dataTransfer.files) {
      // Sürüklenen dosyaları state'e kaydet
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Dosya sürüklenirken çalışır (gerekli, yoksa drop çalışmaz)
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();  // Varsayılan davranışı engelle
  };

  // "Dönüştür" butonuna basıldığında çalışır
  const handleConvert = async () => {
    // Dosya kontrol - en az 1 dosya seçilmeli
    if (files.length === 0) {
      alert('Lütfen önce dosya seçin!');
      return;
    }

    // Dönüştürme başladı
    setConverting(true);
    setProgress('Dosyalar yükleniyor...');

    // FormData oluştur (dosyaları sunucuya göndermek için)
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);  // Her dosyayı 'files' anahtarı ile ekle
    });
    formData.append('splitPages', splitPages ? 'true' : 'false');

    try {
      // Backend API'ye POST isteği gönder
      setProgress('Dosyalar dönüştürülüyor...');
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,  // Dosyaları gönder
      });

      // Hata kontrolü
      if (!response.ok) {
        throw new Error('Dönüştürme başarısız oldu');
      }

      setProgress('PDF dosyaları oluşturuluyor...');

      // ZIP dosyasını al (binary data)
      const blob = await response.blob();
      
      // ZIP'i indirmek için geçici link oluştur
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');  // Link elementi oluştur
      a.href = url;                           // Link'e ZIP URL'ini ata
      a.download = 'converted-pdfs.zip';      // İndirme dosya adı
      document.body.appendChild(a);           // Link'i sayfaya ekle
      a.click();                              // Link'e tıkla (indirme başlar)
      window.URL.revokeObjectURL(url);        // Geçici URL'i temizle (bellek)
      document.body.removeChild(a);           // Link'i sayfadan kaldır

      // Başarılı mesajı göster
      setProgress('Başarılı! İndirme başladı.');
      
      // 3 saniye sonra formu temizle
      setTimeout(() => {
        setProgress('');
        setFiles([]);  // Dosya listesini temizle
        if (fileInputRef.current) {
          fileInputRef.current.value = '';  // Input'u temizle
        }
      }, 3000);
      
    } catch (error) {
      // Hata oluştu
      console.error('Hata:', error);
      alert('Bir hata oluştu. Lütfen tekrar deneyin.');
      setProgress('');
    } finally {
      // Her durumda dönüştürme durumunu sıfırla
      setConverting(false);
    }
  };

  // Dosyayı listeden çıkaran fonksiyon
  const removeFile = (index: number) => {
    // index'i eşleşmeyen dosyaları filtrele (seçilen dosyayı çıkar)
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    // Ana container - gradient arka plan, ortalanmış içerik
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* İçerik kartı - beyaz arka plan, yuvarlak köşeler, gölge */}
      <main className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl p-8">
        
        {/* Başlık Bölümü */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📄 Doküman Converter
          </h1>
          <p className="text-gray-600">
            Dosyalarınızı kolayca PDF'e dönüştürün
          </p>
        </div>

        {/* Dosya Yükleme Alanı - Drag & Drop + Click */}
        <div
          onDrop={handleDrop}          // Dosya bırakıldığında
          onDragOver={handleDragOver}  // Dosya üzerindeyken
          className="border-4 border-dashed border-blue-300 rounded-xl p-12 mb-6 text-center hover:border-blue-500 transition-colors bg-blue-50 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}  // Tıklandığında dosya seçici aç
        >
          <div className="text-6xl mb-4">📁</div>
          <p className="text-xl font-semibold text-gray-700 mb-2">
            Dosyaları buraya sürükleyin
          </p>
          <p className="text-gray-500 mb-4">veya tıklayarak seçin</p>
          
          {/* Gizli dosya input'u (görünmez ama çalışır) */}
          <input
            ref={fileInputRef}  // Referans (programatik erişim için)
            type="file"
            multiple            // Çoklu dosya seçimi
            accept=".doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"  // Kabul edilen formatlar
            onChange={handleFileChange}  // Dosya seçildiğinde
            className="hidden"  // Gizli (custom UI kullanıyoruz)
          />
          <p className="text-sm text-gray-400">
            Desteklenen formatlar: DOC, DOCX, JPG, PNG, XLS, XLSX
          </p>
        </div>

        {/* Mod seçimi - iki versiyon aynı anda kullanılabilsin */}
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={splitPages}
              onChange={(e) => setSplitPages(e.target.checked)}
              className="mt-1 h-4 w-4 accent-indigo-600"
            />
            <div>
              <p className="font-semibold text-indigo-900">Parçalara Böl (Yeni Versiyon)</p>
              <p className="text-sm text-indigo-700">
                Açıkken her doküman sayfa sayfa ayrılır ve ZIP içinde 1.pdf, 2.pdf, 3.pdf... olarak iner.
                Kapalıyken mevcut sürüm gibi her dosya tek PDF olarak eklenir.
              </p>
            </div>
          </label>
        </div>

        {/* Seçilen Dosyalar Listesi - En az 1 dosya varsa göster */}
        {files.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">
              Seçilen Dosyalar ({files.length})
            </h3>
            {/* Kaydırılabilir liste (max 240px yükseklik) */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                >
                  {/* Dosya bilgisi */}
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">📎</span>
                    <div>
                      <p className="font-medium text-gray-700">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB  {/* Byte'ı KB'ye çevir */}
                      </p>
                    </div>
                  </div>
                  
                  {/* Silme butonu */}
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 font-bold text-xl"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dönüştür Butonu */}
        <button
          onClick={handleConvert}
          disabled={converting || files.length === 0}  // Dönüştürme sırasında veya dosya yoksa devre dışı
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            converting || files.length === 0
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'  // Devre dışı görünüm
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'  // Aktif görünüm
          }`}
        >
          {converting ? '🔄 Dönüştürülüyor...' : splitPages ? '🚀 PDF\'e Dönüştür (Sayfa Sayfa)' : '🚀 PDF\'e Dönüştür'}
        </button>

        {/* İlerleme Mesajı - Mesaj varsa göster */}
        {progress && (
          <div className="mt-4 p-4 bg-blue-100 border border-blue-300 rounded-lg text-center">
            <p className="text-blue-800 font-medium">{progress}</p>
          </div>
        )}
      </main>
    </div>
  );
}
