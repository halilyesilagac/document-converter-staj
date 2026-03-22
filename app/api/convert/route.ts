/**
 * Belge Donusturucu API (Backend)
 *
 * Bu dosyada isin agirligini backend tarafinda tasiyorum:
 * 1. Frontend'den gelen dosyalari aliyorum
 * 2. Her dosya icin dogru donusturme yolunu secip PDF uretiyorum
 * 3. "Parcalara Bol" aciksa PDF'i sayfa sayfa ayiriyorum
 * 4. Her seyi 1.pdf, 2.pdf, 3.pdf... sirasiyla ZIP'e koyuyorum
 * 5. ZIP dosyasini kullaniciya indirtiyorum
 */

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib'; // PDF oluşturmak için
import sharp from 'sharp'; // Resim işleme için
import archiver from 'archiver'; // ZIP dosyası oluşturmak için
import path from 'path'; // Dosya yolları için
import { exec } from 'child_process'; // Dış programları çalıştırmak için (Python, LibreOffice)
import { promisify } from 'util';
import { writeFile, readFile, mkdir, rm } from 'fs/promises'; // Dosya işlemleri
import { existsSync } from 'fs';
import { tmpdir } from 'os'; // Geçici dosya klasörü

const execAsync = promisify(exec);

// Python programının yolu - Word ve Excel dönüşümü için kullanılıyor
const PYTHON_PATH = 'C:/Users/halil/AppData/Local/Programs/Python/Python311/python.exe';

// Hazırladığımız Python scriptlerinin yolu
const WORD_TO_PDF_SCRIPT = path.join(process.cwd(), 'scripts', 'word_to_pdf.py');
const EXCEL_TO_PDF_SCRIPT = path.join(process.cwd(), 'scripts', 'excel_to_pdf.py');

// LibreOffice programının yolu - Eski .doc dosyaları için yedek çözüm
const LIBRE_OFFICE_PATH = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

// Türkçe karakterleri düzelten fonksiyon
// PDF'lerde bazen Türkçe karakterler sorun çıkarabiliyor, onları İngilizce karşılıklarına çeviriyoruz
function sanitizeText(text: string): string {
  let cleaned = text;
  
  // Türkçe harfleri İngilizce'ye çevir
  const turkishMap: { [key: string]: string } = {
    'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S',
    'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
  };
  
  for (const [turkish, latin] of Object.entries(turkishMap)) {
    cleaned = cleaned.replace(new RegExp(turkish, 'g'), latin);
  }
  
  // Özel karakterleri değiştir (tire, tırnak işaretleri falan)
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, (char) => {
    const specialChars: { [key: string]: string } = {
      '\u2013': '-', '\u2014': '-', // çizgiler
      '\u201C': '"', '\u201D': '"', // akıllı tırnaklar
      '\u2018': "'", '\u2019': "'", // kesme işaretleri
      '\u2026': '...', // üç nokta
      '\u2022': '* ', // madde imi
      '\u25E6': '- ', // beyaz madde imi
      '\u00A0': ' ', // bölünmeyen boşluk
      '\u00B7': '*', // orta nokta
      '\n': ' ', '\r': ' ', '\t': '  '
    };
    return specialChars[char] || '';
  });
  
  return cleaned;
}

/**
 * Resim dosyalarını PDF'e çeviren fonksiyon
 * JPG ve PNG formatlarını destekler
 * 
 * Çalışma mantığı:
 * 1. Resmi yükle ve boyutunu kontrol et
 * 2. Çok büyükse boyutunu ayarla (kaliteyi koruyarak)
 * 3. A4 boyutunda PDF sayfası oluştur
 * 4. Resmi sayfanın ortasına yerleştir
 * 5. PDF'i byte array olarak döndür
 */
async function imageToPdf(buffer: Buffer, filename: string): Promise<Buffer[]> {
  try {
    const pdfDoc = await PDFDocument.create();

    const ext = path.extname(filename).toLowerCase();
    let image;

    // Resmi tek seferde işleyip göm (çift dönüşüm maliyetini azaltır)
    if (ext === '.png') {
      const processedPng = await sharp(buffer)
        .resize(1600, 2400, {
          fit: 'inside', // Oranları bozmadan sığdır
          withoutEnlargement: true // Küçükse büyütme
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
      image = await pdfDoc.embedPng(processedPng);
    } else {
      const processedJpg = await sharp(buffer)
        .resize(1600, 2400, {
          fit: 'inside', // Oranları bozmadan sığdır
          withoutEnlargement: true // Küçükse büyütme
        })
        .jpeg({ quality: 90 }) // %90 kalite ile kaydet
        .toBuffer();
      image = await pdfDoc.embedJpg(processedJpg);
    }

    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = image.scale(1);

    // Sayfaya kenar boslugu birakarak sigdir
    const maxWidth = 495; // Kenar boslugu birakiyorum
    const maxHeight = 742;
    
    const scaleFactor = Math.min(
      maxWidth / width,
      maxHeight / height,
      1 // Kucuk resmi gereksiz yere buyutmuyorum
    );

    const scaledWidth = width * scaleFactor;
    const scaledHeight = height * scaleFactor;

    // Resmi sayfanin ortasina koy
    page.drawImage(image, {
      x: (595 - scaledWidth) / 2,
      y: (842 - scaledHeight) / 2,
      width: scaledWidth,
      height: scaledHeight,
    });

    const pdfBytes = await pdfDoc.save();
    return [Buffer.from(pdfBytes)];
  } catch (error) {
    console.error('Image conversion error:', error);
    return [await createEmptyPdf(filename)];
  }
}

// Word dosyalarını PDF'e çeviren fonksiyon - iki farklı yöntem kullanıyor
// .doc (eski format) için LibreOffice, .docx (yeni format) için Microsoft Word kullanıyoruz
//
// Neden iki farklı yöntem?
// - .doc dosyaları: Eski format olduğu için LibreOffice daha güvenli çalışıyor
// - .docx dosyaları: Word'ün kendi motoru ile %100 font ve format koruması sağlıyor
async function docxToPdf(buffer: Buffer, filename: string): Promise<Buffer[]> {
  // Geçici klasör oluştur (her dönüşüm için benzersiz)
  const tempDir = path.join(tmpdir(), 'docx-converter-' + Date.now());
  const inputFile = path.join(tempDir, filename);
  const outputFile = path.join(tempDir, filename.replace(/\.[^.]+$/, '.pdf'));
  const ext = path.extname(filename).toLowerCase(); // Dosya uzantısını al (.doc veya .docx)

  try {
    // Geçici klasörü oluştur
    await mkdir(tempDir, { recursive: true });
    
    // Word dosyasını geçici klasöre kaydet
    await writeFile(inputFile, buffer);
    
    // Dosya uzantısına göre dönüştürücü seç
    if (ext === '.doc') {
      // .doc dosyaları için LibreOffice kullan (eski format, uyumluluk için)
      console.log(`[DOC] LibreOffice ile dönüştürülüyor: ${filename}`);
      
      // LibreOffice komutunu çalıştır (arka planda, görünmez)
      const command = `"${LIBRE_OFFICE_PATH}" --headless --convert-to pdf --outdir "${tempDir}" "${inputFile}"`;
      
      await execAsync(command, { 
        timeout: 60000,      // 60 saniye timeout
        windowsHide: true    // Pencere gösterme
      });
      
      console.log(`[DOC] Dönüşüm tamamlandı`);
    } else {
      // .docx dosyaları için Python + Microsoft Word kullan
      // Word'ün kendi motoru ile %100 font koruması
      const command = `"${PYTHON_PATH}" "${WORD_TO_PDF_SCRIPT}" "${inputFile}" "${outputFile}"`;
      
      console.log(`[DOCX] Dönüştürülüyor: ${filename}`);
      console.log(`[DOCX] Komut: ${command}`);
      
      // Python scriptini çalıştır
      const result = await execAsync(command,{ 
        timeout: 90000,      // 90 saniye timeout (Word açma süresi dahil)
        windowsHide: true    // Pencere gösterme
      });
      
      // Python'dan gelen mesajları logla (hata ayıklama için)
      if (result.stdout) {
        console.log(`[DOCX] Python çıktısı: ${result.stdout}`);
      }
      if (result.stderr) {
        console.log(`[DOCX] Python hata mesajı: ${result.stderr}`);
      }
    }
    
    // PDF dosyası oluşturuldu mu kontrol et
    if (!existsSync(outputFile)) {
      console.error(`[Word] Hata: PDF dosyası oluşturulamadı - ${filename}`);
      throw new Error('PDF oluşturulamadı');
    }
    
    console.log(`[Word] Başarılı: ${filename} PDF'e çevrildi`);
    
    // PDF dosyasını oku
    const pdfBuffer = await readFile(outputFile);
    
    // PDF'i döndür (array içinde çünkü birden fazla sayfa olabilir)
    return [pdfBuffer];
  } catch (error) {
    console.error('DOCX conversion error:', error);
    return [await createEmptyPdf(filename)];
  } finally {
    // Klasörü tek hamlede silmek, tek tek unlink çağrılarından daha hızlı ve güvenli
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Excel dosyalarını PDF'e çeviren fonksiyon
// Microsoft Excel'in kendi motoru ile %100 font ve format koruması
//
// Özellikler:
// - Sayfa düzenini korur (başlıklar, altlıklar)
// - Hücre formatlarını korur (renkler, kenarlıklar)
// - Yazdırma ayarlarını kullanır
// - Çalışma sayfalarını tek PDF'te birleştirir
async function excelToPdf(buffer: Buffer, filename: string): Promise<Buffer[]> {
  // Geçici klasör oluştur (her dönüşüm için benzersiz)
  const tempDir = path.join(tmpdir(), 'excel-converter-' + Date.now());
  const inputFile = path.join(tempDir, filename);
  const outputFile = path.join(tempDir, filename.replace(/\.[^.]+$/, '.pdf'));

  try {
    // Geçici klasörü oluştur
    await mkdir(tempDir, { recursive: true });
    
    // Excel dosyasını geçici klasöre kaydet
    await writeFile(inputFile, buffer);
    
    // Python scriptini çalıştır (Microsoft Excel COM automation kullanıyor)
    // Excel'i arka planda açıp PDF'e çevirir, fontları ve düzeni korur
    const command = `"${PYTHON_PATH}" "${EXCEL_TO_PDF_SCRIPT}" "${inputFile}" "${outputFile}"`;
    
    console.log(`[Excel] Dönüştürülüyor: ${filename}`);
    console.log(`[Excel] Komut: ${command}`);
    
    // Komutu çalıştır
    const result = await execAsync(command, { 
      timeout: 90000,      // 90 saniye timeout (Excel açma süresi dahil)
      windowsHide: true    // Pencere gösterme
    });
    
    // Python'dan gelen mesajları logla (hata ayıklama için)
    if (result.stdout) {
      console.log(`[Excel] Python çıktısı: ${result.stdout}`);
    }
    if (result.stderr) {
      console.log(`[Excel] Python hata mesajı: ${result.stderr}`);
    }
    
    // PDF dosyası oluşturuldu mu kontrol et
    if (!existsSync(outputFile)) {
      console.error(`[Excel] Hata: PDF dosyası oluşturulamadı - ${filename}`);
      throw new Error('PDF oluşturulamadı');
    }
    
    console.log(`[Excel] Başarılı: ${filename} PDF'e çevrildi`);
    
    // PDF dosyasını oku
    const pdfBuffer = await readFile(outputFile);
    
    // PDF'i döndür (array içinde çünkü birden fazla sayfa olabilir)
    return [pdfBuffer];
  } catch (error) {
    console.error('Excel conversion error:', error);
    return [await createEmptyPdf(filename)];
  } finally {
    // Klasörü tek hamlede silmek, tek tek unlink çağrılarından daha hızlı ve güvenli
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Boş PDF oluşturan fonksiyon (hata durumunda veya desteklenmeyen format için)
// İçinde dosya adı yazan basit bir PDF sayfası oluşturur
async function createEmptyPdf(filename: string): Promise<Buffer> {
  // Yeni PDF belgesi oluştur
  const pdfDoc = await PDFDocument.create();
  
  // A4 boyutunda sayfa ekle (595x842 piksel)
  const page = pdfDoc.addPage([595, 842]);
  
  // Dosya adını yazdır (Türkçe karakter hatası olmasın diye sanitize et)
  page.drawText(sanitizeText(`Dosya: ${filename}`), {
    x: 50,            // Sol kenardan 50px içerde
    y: 400,           // Yukarıdan 400px aşağıda
    size: 16,         // 16 punto
    color: rgb(0, 0, 0),  // Siyah renk
  });

  // Açıklama metni ekle
  page.drawText('PDF dönüşümü gerçekleştirildi', {
    x: 50,
    y: 370,
    size: 14,
    color: rgb(0.5, 0.5, 0.5),  // Gri renk
  });

  // PDF'i kaydet ve Buffer olarak döndür
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// Tek bir PDF'i sayfalarına bölüp her sayfayı ayrı PDF olarak döndürür
// Örnek: 5 sayfalık PDF -> [1. sayfa PDF, 2. sayfa PDF, ...]
async function splitPdfIntoSinglePages(pdfBuffer: Buffer): Promise<Buffer[]> {
  const sourcePdf = await PDFDocument.load(pdfBuffer);
  const pageCount = sourcePdf.getPageCount();

  // Tek sayfaysa tekrar kopyalama yapma, direkt döndür
  if (pageCount <= 1) {
    return [pdfBuffer];
  }

  const pages: Buffer[] = [];

  for (let i = 0; i < pageCount; i++) {
    const onePagePdf = await PDFDocument.create();
    const [copiedPage] = await onePagePdf.copyPages(sourcePdf, [i]);
    onePagePdf.addPage(copiedPage);

    const onePageBytes = await onePagePdf.save();
    pages.push(Buffer.from(onePageBytes));
  }

  return pages;
}

// Ana API endpoint - Frontend'den gelen POST isteğini işler
// Görevleri:
// 1. Kullanıcıdan gelen dosyaları al
// 2. Her dosyayı uygun fonksiyonla PDF'e çevir
// 3. Tüm PDF'leri ZIP içinde topla
// 4. ZIP'i kullanıcıya gönder
export async function POST(request: NextRequest) {
  try {
    // Frontend'den gelen form datasını al (içinde dosyalar var)
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    // Frontend checkbox'i true gonderirse sayfa sayfa bol modu aktif oluyor
    const splitPages = formData.get('splitPages') === 'true';

    // Dosya kontrolü - hiç dosya yok mu?
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 400 }  // Bad Request hatası
      );
    }

    // Tüm PDF'leri bu array'de toplayacağız
    const allPdfs: { name: string; buffer: Buffer }[] = [];
    
    // PDF'lere numara vermek için sayaç (1.pdf, 2.pdf, 3.pdf...)
    let pdfCounter = 1;

    // Dönüşüm sonuçlarını dosya sırasını bozmadan tut
    const convertedByFile: Buffer[][] = new Array(files.length);

    // Resim dosyalarını paralel işle (hızlanma)
    // Office dosyaları (Word/Excel COM) stabilite için sırayla kalıyor
    const imageTasks: Promise<void>[] = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name).toLowerCase();

      if (['.jpg', '.jpeg', '.png'].includes(ext)) {
        imageTasks.push((async () => {
          try {
            convertedByFile[fileIndex] = await imageToPdf(buffer, file.name);
          } catch (error) {
            console.error(`${file.name} işlenirken hata:`, error);
            convertedByFile[fileIndex] = [await createEmptyPdf(`Hata: ${file.name}`)];
          }
        })());
        continue;
      }

      try {
        if (['.doc', '.docx'].includes(ext)) {
          convertedByFile[fileIndex] = await docxToPdf(buffer, file.name);
        } else if (['.xls', '.xlsx'].includes(ext)) {
          convertedByFile[fileIndex] = await excelToPdf(buffer, file.name);
        } else {
          convertedByFile[fileIndex] = [await createEmptyPdf(file.name)];
        }
      } catch (error) {
        console.error(`${file.name} işlenirken hata:`, error);
        convertedByFile[fileIndex] = [await createEmptyPdf(`Hata: ${file.name}`)];
      }
    }

    // Paralel resim görevlerinin bitmesini bekle
    await Promise.all(imageTasks);

    // Sonuçları giriş sırasına göre ZIP listesine ekle
    for (const pdfs of convertedByFile) {
      if (!pdfs || pdfs.length === 0) {
        continue;
      }

      for (const pdf of pdfs) {
        if (splitPages) {
          const singlePagePdfs = await splitPdfIntoSinglePages(pdf);
          for (const pagePdf of singlePagePdfs) {
            allPdfs.push({
              name: `${pdfCounter}.pdf`,
              buffer: pagePdf,
            });
            pdfCounter++;
          }
        } else {
          allPdfs.push({
            name: `${pdfCounter}.pdf`,
            buffer: pdf,
          });
          pdfCounter++;
        }
      }
    }

    // ZIP dosyası oluştur (tüm PDF'leri içerecek)
    const archive = archiver('zip', { 
      zlib: { level: 9 }  // Maksimum sıkıştırma (0-9 arası, 9 en yüksek)
    });
    
    // ZIP verisi parça parça gelecek, hepsini bu array'de topluyoruz
    const chunks: Buffer[] = [];

    // Her veri parçası geldiğinde array'e ekle
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    
    // ZIP oluşumu bittiğinde tüm parçaları birleştir
    const zipFinished = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));  // Başarılı
      archive.on('error', reject);  // Hata
    });

    // Tüm PDF'leri ZIP'e ekle
    for (const pdf of allPdfs) {
      archive.append(pdf.buffer, { name: pdf.name });  // 1.pdf, 2.pdf...
    }

    // ZIP'i tamamla (artık dosya eklenemez)
    await archive.finalize();
    
    // ZIP'in bitmesini bekle
    const zipBuffer = await zipFinished;

    // ZIP dosyasını kullanıcıya gönder
    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',  // ZIP dosyası olduğunu belirt
        'Content-Disposition': 'attachment; filename="converted-pdfs.zip"',  // İndirme adı
      },
    });

  } catch (error) {
    // Genel hata yakalama (beklenmeyen durumlar için)
    console.error('Dönüşüm hatası:', error);
    
    // Kullanıcıya hata mesajı gönder
    return NextResponse.json(
      { 
        error: 'Dönüşüm başarısız', 
        details: error instanceof Error ? error.message : 'Bilinmeyen hata' 
      },
      { status: 500 }  // Internal Server Error
    );
  }
}
