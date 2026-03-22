# Belge Donusturucu - Staj Projesi

## Proje Ozeti 
Bu projede benden istenen sey, farkli turdeki dokumanlari PDF'e cevirmekti. Ama is sadece tek PDF uretilmesi degildi. Asil onemli kisim, PDF ciktilarini ZIP icinde standart bir sekilde isimlendirip vermekti.

Yani kullanici 1 ya da birden fazla dosya yuklediginde sistem:
- Dosyalari uygun yontemle PDF'e ceviriyor
- Gerekirse PDF'i sayfa sayfa ayiriyor
- ZIP icinde ciktilari 1.pdf, 2.pdf, 3.pdf... diye veriyor

Bu gorevi garantiye almak icin projeyi iki modlu yaptim:
- Normal Mod: Her dosya tek PDF
- Parcalara Bol Modu: PDF cikti sayfa sayfa ayrilir

## Gorevle Uyum Tablosu
| Istenen | Durum |
|---|---|
| Web tabanli cozum | Tamam |
| DOC, DOCX, JPG, PNG, XLS, XLSX destegi | Tamam |
| PDF donusumu | Tamam |
| ZIP olarak indirme | Tamam |
| ZIP icinde 1.pdf, 2.pdf, 3.pdf... | Tamam |
| Sayfa sayfa ayirma (opsiyonel mod) | Tamam |

## Kullanicinin Gordugu Akis
1. Siteye giriyor
2. Dosyalari secip yukluyor (veya surukle birak yapiyor)
3. Istiyorsa "Parcalara Bol" secenegini aciyor
4. Donustur butonuna basiyor
5. ZIP dosyasini indiriyor
6. ZIP icinde sirayla 1.pdf, 2.pdf, 3.pdf... dosyalarini goruyor

## Iki Modun Farki
### 1) Normal Mod
- Secenek kapaliysa calisir
- Her dosya tek bir PDF olarak ZIP'e eklenir
- Ornek: 3 dosya yuklenirse 3 PDF gelir

### 2) Parcalara Bol Modu
- Secenek aciksa calisir
- Olusan PDF sayfa sayfa ayrilir
- Ornek: 5 sayfa docx yuklenirse 1.pdf..5.pdf olur
- Orijinal dosya adini degil, sadece sirali adlandirmayi kullanirim

## Teknik Mimari
### Frontend
- Next.js + React + TypeScript
- Dosya secme / drag-drop
- API'ye dosyalari FormData ile gonderme
- Zip sonucunu kullaniciya otomatik indirtme

### Backend
- Next.js API Route
- Dosya uzantisina gore uygun donusum yolu secimi
- Sonuclarin tek listede toplanmasi
- Sayfa bolme secenegi aciksa PDF splitting
- ZIP olusturma ve response donme

### Donusum Motorlari
- JPG/PNG: sharp + pdf-lib
- DOCX: Python + Microsoft Word COM
- DOC: LibreOffice fallback
- XLS/XLSX: Python + Microsoft Excel COM

## Neden Bu Yapiyi Sectim?
- Font/duzen koruma benim icin kritikti, bu yuzden Word/Excel dosyalarinda Office COM kullandim.
- Eski DOC uyumlulugu icin LibreOffice fallback ekledim.
- Gorevde istenen parcalama mantigini gostermek icin ayri bir "Parcalara Bol" modu ekledim.
- Cikti standardini bozmayip her durumda sirali adlandirma kullandim.

## Performans Tarafinda Yaptigim Iyilestirmeler
- Resim tarafinda gereksiz cift donusum adimlarini azalttim
- Dosya okuma/yazma akislarini daha verimli hale getirdim
- Gecici dosya temizligini tek adimla topladim
- Uygun kisimlarda paralel isleme kullandim

## Dosya Yapisi
```text
document-converter/
├─ app/
│  ├─ api/convert/route.ts
│  ├─ page.tsx
│  ├─ layout.tsx
│  └─ globals.css
├─ scripts/
│  ├─ word_to_pdf.py
│  └─ excel_to_pdf.py
├─ next.config.ts
├─ eslint.config.mjs
├─ postcss.config.mjs
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Kurulum ve Calistirma
### Gereksinimler
- Node.js 18+
- Python 3.11+
- Microsoft Office (Word + Excel)
- LibreOffice (onerilir)

### Kurulum
```bash
npm install
python -m pip install pywin32
```

### Gelistirme Modu
```bash
cd document-converter
npm run dev
```

### Production Modu
```bash
cd document-converter
npm run build
npm start
```



## Bilinen Sinirlar
- Word/Excel COM tarafi Windows ortamina bagimli
- Cok buyuk dosyalarda sure artabilir
- Eski DOC formatinda nadiren gorunum farki olabilir


Son guncelleme: 22 Mart 2026
